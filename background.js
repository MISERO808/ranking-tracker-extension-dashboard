// background.js - Service worker for handling backend sync and other background tasks

console.log('[Background] Service worker starting...');

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Message received:', request.type);
  
  if (request.type === 'new-rankings') {
    // Handle new rankings - could sync to backend here
    handleNewRankings(request.rankings);
  } else if (request.type === 'tokens-updated') {
    // Handle token updates
    console.log('[Background] Tokens updated');
  } else if (request.type === 'rankings-found') {
    // Update badge
    chrome.action.setBadgeText({ 
      text: request.count.toString(),
      tabId: sender.tab?.id 
    });
    chrome.action.setBadgeBackgroundColor({ 
      color: '#667eea' 
    });
    
    // Clear badge after 5 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ 
        text: '',
        tabId: sender.tab?.id 
      });
    }, 5000);
  } else if (request.type === 'open-popup') {
    // Handle opening the extension popup
    console.log('[Background] Opening popup requested');
    
    // Method 1: Try to open popup programmatically (Chrome 99+)
    chrome.action.openPopup()
      .then(() => {
        console.log('[Background] Popup opened successfully');
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.log('[Background] Could not open popup programmatically:', error);
        
        // Method 2: Focus on the extension icon (fallback)
        // This will highlight the extension icon to draw user attention
        chrome.action.setBadgeText({ 
          text: '!',
          tabId: sender.tab?.id 
        });
        chrome.action.setBadgeBackgroundColor({ 
          color: '#ef4444' 
        });
        
        // Show notification as alternative
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icon128.png'),
          title: 'Spotify Tracker',
          message: 'Click the extension icon to see ranking details',
          priority: 2
        });
        
        sendResponse({ success: false, fallback: true });
      });
    
    return true; // Keep message channel open for async response
  }
});

async function handleNewRankings(rankings) {
  console.log('[Background] Processing', rankings.length, 'new rankings');
  
  // Get settings
  const { autoSync = false, backendUrl } = await chrome.storage.sync.get(['autoSync', 'backendUrl']);
  
  if (autoSync && backendUrl) {
    console.log('[Background] Auto-syncing to backend...');
    syncToBackend(rankings, backendUrl);
  }
}

async function syncToBackend(rankings, backendUrl) {
  try {
    const { tokens = {} } = await chrome.storage.local.get('tokens');
    
    const response = await fetch(`${backendUrl}/api/rankings/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.accessToken || ''}`
      },
      body: JSON.stringify({ rankings })
    });
    
    if (response.ok) {
      console.log('[Background] Sync successful');
    } else {
      console.error('[Background] Sync failed:', response.status);
    }
  } catch (error) {
    console.error('[Background] Sync error:', error);
  }
}

// Listen for tab updates to detect Spotify navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('open.spotify.com')) {
    console.log('[Background] Spotify tab loaded:', tab.url);
    
    // Inject content script if needed (backup in case manifest injection fails)
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).catch(err => {
      // Script might already be injected, that's ok
      console.log('[Background] Content script may already be injected');
    });
  }
});

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Background] Extension installed');
    
    // Set default settings
    chrome.storage.sync.set({
      autoSync: false,
      backendUrl: 'https://your-backend.vercel.app'
    });
    
    // Create a default icon if you haven't added one
    chrome.action.setBadgeBackgroundColor({ 
      color: '#667eea' 
    });
  }
});