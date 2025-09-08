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
  
  // Get settings - FORCE enable auto-sync for real-time sync
  let { autoSync = false, backendUrl } = await chrome.storage.sync.get(['autoSync', 'backendUrl']);
  
  // Enable auto-sync and set correct backend URL if not configured
  if (!autoSync || !backendUrl || backendUrl.includes('your-backend')) {
    console.log('[Background] Enabling auto-sync and setting correct backend URL...');
    autoSync = true;
    backendUrl = 'https://ranking-tracker-extension-dashboard.vercel.app';
    
    await chrome.storage.sync.set({
      autoSync: true,
      backendUrl: backendUrl
    });
  }
  
  if (autoSync && backendUrl) {
    console.log('[Background] 🚀 Auto-syncing to dashboard:', backendUrl);
    await syncToBackend(rankings, backendUrl);
  } else {
    console.log('[Background] ⚠️ Auto-sync disabled or no backend URL');
  }
}

async function syncToBackend(rankings, backendUrl) {
  try {
    const { tokens = {} } = await chrome.storage.local.get('tokens');
    
    // Convert rankings to playlist format expected by dashboard
    const playlistData = await buildPlaylistData(rankings);
    
    console.log('[Background] Syncing playlist data:', {
      name: playlistData.name,
      keywordCount: playlistData.keywords.length,
      url: `${backendUrl}/api/playlists`
    });
    
    const response = await fetch(`${backendUrl}/api/playlists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.accessToken || ''}`
      },
      body: JSON.stringify(playlistData)
    });
    
    if (response.ok) {
      console.log('[Background] ✅ Sync successful to dashboard!');
    } else {
      console.error('[Background] ❌ Sync failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('[Background] Error details:', errorText);
    }
  } catch (error) {
    console.error('[Background] ❌ Sync error:', error);
  }
}

async function buildPlaylistData(rankings) {
  // Get all ranking history to build complete playlist data
  const { rankingHistory = [], watchedPlaylists = {} } = await chrome.storage.local.get(['rankingHistory', 'watchedPlaylists']);
  
  // Group rankings by playlist
  const playlistGroups = {};
  
  // Add both new rankings and existing history
  [...rankingHistory, ...rankings].forEach(ranking => {
    if (!playlistGroups[ranking.playlistId]) {
      playlistGroups[ranking.playlistId] = {
        rankings: [],
        playlist: ranking
      };
    }
    playlistGroups[ranking.playlistId].rankings.push(ranking);
  });
  
  // Convert to dashboard format - send the main playlist (first one)
  const mainPlaylistId = Object.keys(playlistGroups)[0];
  if (!mainPlaylistId) return null;
  
  const mainPlaylist = playlistGroups[mainPlaylistId];
  const watchedPlaylist = watchedPlaylists[mainPlaylistId];
  
  // Filter out entries with invalid territories
  const validRankings = mainPlaylist.rankings.filter(ranking => {
    const territory = ranking.territory?.toLowerCase().trim();
    // Only keep entries with valid 2-letter country codes
    return territory && territory !== 'unknown' && territory.length === 2 && /^[a-z]{2}$/i.test(territory);
  });

  // Don't send if no valid rankings
  if (validRankings.length === 0) {
    console.log('[Background] No valid rankings to sync (all have invalid territories)');
    return null;
  }

  return {
    id: mainPlaylistId,
    name: mainPlaylist.playlist.playlistName || watchedPlaylist?.name || 'Unknown Playlist',
    image: mainPlaylist.playlist.playlistImage || '',
    keywords: validRankings.map(ranking => ({
      keyword: ranking.keyword,
      position: ranking.position,
      territory: ranking.territory.toLowerCase().trim(), // Normalize to lowercase
      timestamp: ranking.timestamp,
      userId: ranking.userId,
      sessionId: ranking.sessionId
    })),
    lastUpdated: new Date().toISOString()
  };
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
    
    // Set default settings - ENABLE AUTO-SYNC by default
    chrome.storage.sync.set({
      autoSync: true,
      backendUrl: 'https://ranking-tracker-extension-dashboard.vercel.app'
    });
    
    // Create a default icon if you haven't added one
    chrome.action.setBadgeBackgroundColor({ 
      color: '#667eea' 
    });
  }
});