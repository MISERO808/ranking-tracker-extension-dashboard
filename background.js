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
  
  // Track what we've already synced to avoid re-sending deleted items
  const { syncedRankings = {} } = await chrome.storage.local.get('syncedRankings');
  
  // Filter out rankings we've already synced AND prevent same-minute duplicates
  const newRankingsToSync = [];
  const syncKeysToAdd = [];
  const minuteKeys = new Set();
  
  for (const ranking of rankings) {
    const syncKey = `${ranking.playlistId}-${ranking.keyword}-${ranking.territory}-${ranking.timestamp}`;
    
    // Create a minute-level key to prevent same-minute duplicates
    const date = new Date(ranking.timestamp);
    const minuteKey = `${ranking.playlistId}-${ranking.keyword}-${ranking.territory}-${ranking.position}-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
    
    // Skip if we've already synced this exact ranking OR if we already have a ranking for this minute
    if (!syncedRankings[syncKey] && !minuteKeys.has(minuteKey)) {
      newRankingsToSync.push(ranking);
      syncKeysToAdd.push(syncKey);
      minuteKeys.add(minuteKey);
    } else if (minuteKeys.has(minuteKey)) {
      console.log(`[Background] Skipping duplicate same-minute ranking: ${ranking.keyword} at position ${ranking.position}`);
    }
  }
  
  if (newRankingsToSync.length === 0) {
    console.log('[Background] No new rankings to sync (all already synced)');
    return;
  }
  
  console.log(`[Background] ${newRankingsToSync.length} new rankings to sync (filtered from ${rankings.length})`)
  
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
    const success = await syncToBackend(newRankingsToSync, backendUrl);
    
    // Only mark as synced if the sync was successful
    if (success) {
      const updatedSyncedRankings = { ...syncedRankings };
      for (const key of syncKeysToAdd) {
        updatedSyncedRankings[key] = Date.now();
      }
      
      // Clean up old synced rankings (older than 7 days)
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      for (const [key, timestamp] of Object.entries(updatedSyncedRankings)) {
        if (timestamp < oneWeekAgo) {
          delete updatedSyncedRankings[key];
        }
      }
      
      await chrome.storage.local.set({ syncedRankings: updatedSyncedRankings });
      console.log('[Background] ✅ Marked', syncKeysToAdd.length, 'rankings as synced');
    }
  } else {
    console.log('[Background] ⚠️ Auto-sync disabled or no backend URL');
  }
}

async function syncToBackend(rankings, backendUrl) {
  try {
    const { tokens = {} } = await chrome.storage.local.get('tokens');
    
    // Convert rankings to playlist format expected by dashboard
    // This now returns an array of playlists
    const playlistDataArray = await buildPlaylistData(rankings);
    
    // CRITICAL: Don't sync if we have no data
    if (!playlistDataArray || playlistDataArray.length === 0) {
      console.log('[Background] ⚠️ No valid data to sync');
      return false;
    }
    
    // Send each playlist separately to the dashboard
    let allSuccess = true;
    for (const playlistData of playlistDataArray) {
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
        console.log(`[Background] ✅ Sync successful for playlist: ${playlistData.name}`);
      } else {
        console.error(`[Background] ❌ Sync failed for playlist ${playlistData.name}:`, response.status, response.statusText);
        const errorText = await response.text();
        console.error('[Background] Error details:', errorText);
        allSuccess = false;
      }
    }
    
    return allSuccess;
  } catch (error) {
    console.error('[Background] ❌ Sync error:', error);
    return false;
  }
}

async function buildPlaylistData(rankings) {
  // Get watched playlists info
  const { watchedPlaylists = {} } = await chrome.storage.local.get(['watchedPlaylists']);
  
  // Group rankings by playlist
  const playlistGroups = {};
  
  // ONLY send NEW rankings, not historical data
  // Historical data may contain old/invalid territories
  rankings.forEach(ranking => {
    // Clean and validate territory BEFORE grouping
    const territory = ranking.territory?.toLowerCase().trim();
    if (!territory || territory === 'unknown' || territory.length !== 2) {
      console.log(`[Background] Skipping invalid territory: "${ranking.territory}"`);
      return; // Skip this ranking
    }
    
    if (!playlistGroups[ranking.playlistId]) {
      playlistGroups[ranking.playlistId] = {
        rankings: [],
        playlistInfo: {
          playlistId: ranking.playlistId,
          playlistName: ranking.playlistName,
          playlistImage: ranking.playlistImage
        }
      };
    }
    
    // Add with cleaned territory - each ranking maintains its own data
    playlistGroups[ranking.playlistId].rankings.push({
      ...ranking,
      territory: territory // Ensure lowercase
    });
  });
  
  // Convert to dashboard format - return ALL playlists as an array
  const allPlaylistData = [];
  
  console.log(`[Background] Processing ${Object.keys(playlistGroups).length} playlists:`, Object.keys(playlistGroups));
  
  for (const [playlistId, playlistGroup] of Object.entries(playlistGroups)) {
    console.log(`[Background] Processing playlist ${playlistId} with ${playlistGroup.rankings.length} rankings`);
    const watchedPlaylist = watchedPlaylists[playlistId];
    
    // Rankings are already filtered and validated
    if (playlistGroup.rankings.length === 0) {
      console.log(`[Background] No valid rankings to sync for playlist ${playlistId}`);
      continue; // Skip this playlist but continue with others
    }

    // Get the image from the most recent ranking or watched playlist
    const playlistImage = playlistGroup.rankings[0]?.playlistImage || 
                          watchedPlaylist?.image || 
                          playlistGroup.playlistInfo.playlistImage || 
                          '';
    
    console.log(`[Background] Image sources for ${playlistGroup.playlistInfo.playlistName}:`, {
      fromRanking: playlistGroup.rankings[0]?.playlistImage || 'none',
      fromWatched: watchedPlaylist?.image || 'none',
      fromPlaylist: playlistGroup.playlistInfo.playlistImage || 'none',
      final: playlistImage || 'none'
    });
    
    allPlaylistData.push({
      id: playlistId,
      name: playlistGroup.playlistInfo.playlistName || watchedPlaylist?.name || 'Unknown Playlist',
      image: playlistImage,
      keywords: playlistGroup.rankings.map(ranking => ({
        keyword: ranking.keyword,
        position: ranking.position,
        territory: ranking.territory, // Already normalized
        timestamp: ranking.timestamp,
        userId: ranking.userId,
        sessionId: ranking.sessionId
      })),
      lastUpdated: new Date().toISOString()
    });
  }
  
  return allPlaylistData.length > 0 ? allPlaylistData : null;
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