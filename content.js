// content.js - Injected into Spotify pages
// This script intercepts API calls and shows ranking overlays

console.log('[Spotify Tracker] Content script loaded');

// Inject our interceptor script into the page
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() {
  this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Track current search results to avoid duplicates
let currentSearchKeyword = '';
let currentSearchSession = new Set();
let overlayElements = [];

// Create and inject styles for overlay - FIXED with safety check
const style = document.createElement('style');
style.textContent = `
  .spotify-tracker-overlay {
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: slideIn 0.3s ease-out;
    max-width: 320px;
    cursor: pointer;
    transition: transform 0.2s;
  }
  
  .spotify-tracker-overlay:hover {
    transform: scale(1.05);
  }
  
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
  
  .tracker-overlay-header {
    font-size: 12px;
    opacity: 0.9;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  
  .tracker-overlay-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .tracker-overlay-playlist {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }
  
  .tracker-overlay-keyword {
    font-size: 13px;
    opacity: 0.95;
  }
  
  .tracker-overlay-position {
    font-size: 32px;
    font-weight: bold;
    margin-left: 16px;
    background: rgba(255, 255, 255, 0.2);
    padding: 8px 16px;
    border-radius: 8px;
  }
  
  .tracker-overlay-change {
    font-size: 14px;
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .position-improved {
    color: #4ade80;
  }
  
  .position-declined {
    color: #fca5a5;
  }
  
  .position-same {
    color: rgba(255, 255, 255, 0.8);
  }
  
  .position-new {
    background: rgba(255, 255, 255, 0.2);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
  }
  
  .tracker-overlay-close {
    position: absolute;
    top: 8px;
    right: 8px;
    cursor: pointer;
    opacity: 0.7;
    font-size: 18px;
    line-height: 1;
  }
  
  .tracker-overlay-close:hover {
    opacity: 1;
  }
  
  .spotify-tracker-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: bold;
    z-index: 10;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    pointer-events: none;
    animation: fadeIn 0.3s ease-out;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  .tracker-multi-results {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.3);
  }
  
  .tracker-result-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
    font-size: 14px;
  }
  
  .tracker-result-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    margin-right: 8px;
  }
  
  .tracker-result-pos {
    font-weight: bold;
    background: rgba(255, 255, 255, 0.2);
    padding: 2px 8px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
`;

// Safely inject styles
function injectStyles() {
  if (document.head) {
    document.head.appendChild(style);
  } else if (document.documentElement) {
    document.documentElement.appendChild(style);
  } else {
    // Wait for DOM to be ready
    setTimeout(injectStyles, 10);
  }
}
injectStyles();

// Debounce timer for search results
let searchDebounceTimer = null;
let pendingSearchData = null;

// Listen for messages from the injected script
window.addEventListener('spotify-ranking-data', async (event) => {
  const data = event.detail;
  
  if (data.type === 'search-results') {
    // Reset tracking for new searches
    if (data.keyword !== currentSearchKeyword) {
      currentSearchKeyword = data.keyword;
      currentSearchSession.clear();
      removeAllOverlays();
    }
    
    console.log(`[Spotify Tracker] Search detected: "${data.keyword}" (${data.capturedResults} results captured)`);
    
    // Store the latest data and debounce
    pendingSearchData = data;
    
    // Clear existing timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    
    // Wait 1.5 seconds for page to fully load and no more updates
    searchDebounceTimer = setTimeout(async () => {
      console.log(`[Spotify Tracker] Processing final results for "${pendingSearchData.keyword}"`);
      await processSearchResults(pendingSearchData);
      pendingSearchData = null;
    }, 1500);
    
  } else if (data.type === 'tokens-captured') {
    console.log('[Spotify Tracker] Tokens captured');
    await saveTokens(data.tokens);
  }
});

async function processSearchResults(data) {
  // Get watched playlists from storage
  const { watchedPlaylists = {} } = await chrome.storage.local.get('watchedPlaylists');
  const watchedIds = Object.keys(watchedPlaylists);
  
  if (watchedIds.length === 0) {
    console.log('[Spotify Tracker] No playlists being watched');
    return;
  }
  
  // Get ranking history to check for changes
  const { rankingHistory = [] } = await chrome.storage.local.get('rankingHistory');
  
  // Find our playlists in ALL search results
  const foundRankings = [];
  const overlayData = [];
  
  data.results.forEach((item) => {
    const playlistId = extractPlaylistId(item.uri);
    
    // Check if this is a watched playlist
    if (watchedIds.includes(playlistId)) {
      // Skip if no valid territory
      if (!data.territory || data.territory === 'Unknown' || data.territory.length !== 2) {
        console.log('[Content] Skipping - invalid territory:', data.territory);
        continue;
      }
      
      // Include territory and minute in the session key to prevent same-minute duplicates
      const currentTime = new Date();
      const minute = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), 
                             currentTime.getHours(), currentTime.getMinutes(), 0, 0).toISOString();
      const sessionKey = `${data.keyword}-${playlistId}-${data.territory}-${minute}`;
      
      // Build overlay data for ALL watched playlists (should always show)
      // IMPORTANT: Filter by territory for accurate comparison
      const historicalData = rankingHistory
        .filter(r => 
          r.playlistId === playlistId && 
          r.keyword === data.keyword &&
          r.territory === data.territory  // Only compare within same territory!
        )
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      overlayData.push({
        playlistId,
        playlistName: item.name,
        position: item.position,
        territory: data.territory,
        previousPosition: historicalData[0]?.position || null,
        bestPosition: historicalData.length > 0 
          ? Math.min(...historicalData.map(h => h.position), item.position)
          : item.position,
        isNew: historicalData.length === 0
      });
      
      // Only save once per search session (avoid duplicates in same search)
      if (!currentSearchSession.has(sessionKey)) {
        // Find previous rankings IN THE SAME TERRITORY
        const previousRankings = rankingHistory
          .filter(r => 
            r.playlistId === playlistId && 
            r.keyword === data.keyword &&
            r.territory === data.territory  // Territory-specific comparison
          )
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        const lastRanking = previousRankings[0];
        const bestRanking = previousRankings.reduce((best, current) => 
          (!best || current.position < best.position) ? current : best, null);
        
        // Always save the new ranking (for historical tracking)
        foundRankings.push({
          playlistId,
          playlistName: item.name,
          playlistImage: item.image || '',
          keyword: data.keyword,
          position: item.position,
          totalResults: data.totalResults,
          capturedResults: data.capturedResults,
          timestamp: new Date().toISOString(),
          territory: data.territory,
          userId: data.userId || 'unknown',
          sessionId: data.sessionId,
          id: `${playlistId}-${data.keyword}-${data.territory}-${Date.now()}`,
          previousPosition: lastRanking?.position || null,
          bestPosition: bestRanking?.position || item.position,
          isImprovement: lastRanking ? item.position < lastRanking.position : null
        });
        
        currentSearchSession.add(sessionKey);
      }
      
      // Update the watched playlist name and image if needed
      if (watchedPlaylists[playlistId].name === `Playlist ${playlistId.substring(0, 8)}...` || !watchedPlaylists[playlistId].image) {
        watchedPlaylists[playlistId].name = item.name;
        watchedPlaylists[playlistId].image = item.image || '';
        chrome.storage.local.set({ watchedPlaylists });
      }
    }
  });
  
  // Show overlay if we found watched playlists
  if (overlayData.length > 0) {
    console.log('[Spotify Tracker] Showing overlay for', overlayData);
    showRankingOverlay(overlayData, data.keyword, data.territory);
    addBadgesToPlaylistElements(overlayData);
  }
  
  if (foundRankings.length > 0) {
    console.log(`[Spotify Tracker] Saving ${foundRankings.length} rankings for historical tracking`);
    await saveRankings(foundRankings);
    
    // Update badge to show we found something
    chrome.runtime.sendMessage({
      type: 'rankings-found',
      count: foundRankings.length,
      keyword: data.keyword
    });
  }
}

function getCountryFlag(territory) {
  const flags = {
    'US': '🇺🇸', 'GB': '🇬🇧', 'UK': '🇬🇧', 'DE': '🇩🇪', 'FR': '🇫🇷', 
    'ES': '🇪🇸', 'IT': '🇮🇹', 'NL': '🇳🇱', 'PL': '🇵🇱', 'BR': '🇧🇷',
    'CA': '🇨🇦', 'AU': '🇦🇺', 'JP': '🇯🇵', 'MX': '🇲🇽', 'AR': '🇦🇷',
    'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰', 'FI': '🇫🇮', 'BE': '🇧🇪',
    'CH': '🇨🇭', 'AT': '🇦🇹', 'IE': '🇮🇪', 'NZ': '🇳🇿', 'PT': '🇵🇹'
  };
  return flags[territory?.toUpperCase()] || '';
}

function showRankingOverlay(playlists, keyword, territory) {
  // Remove any existing overlay
  removeAllOverlays();
  
  // Create overlay element
  const overlay = document.createElement('div');
  overlay.className = 'spotify-tracker-overlay';
  
  // Get flag for the territory
  const flag = getCountryFlag(territory);
  
  if (playlists.length === 1) {
    // Single playlist found
    const playlist = playlists[0];
    const changeIndicator = getChangeIndicator(playlist);
    
    overlay.innerHTML = `
      <div class="tracker-overlay-close">×</div>
      <div class="tracker-overlay-header">🎉 Playlist Found! ${flag}</div>
      <div class="tracker-overlay-content">
        <div>
          <div class="tracker-overlay-playlist" title="${playlist.playlistName}">${playlist.playlistName}</div>
          <div class="tracker-overlay-keyword">"${keyword}"</div>
          ${changeIndicator}
        </div>
        <div class="tracker-overlay-position">#${playlist.position}</div>
      </div>
    `;
  } else {
    // Multiple playlists found
    overlay.innerHTML = `
      <div class="tracker-overlay-close">×</div>
      <div class="tracker-overlay-header">🎉 ${playlists.length} Playlists Found! ${flag}</div>
      <div class="tracker-overlay-keyword">"${keyword}"</div>
      <div class="tracker-multi-results">
        ${playlists.slice(0, 5).map(p => `
          <div class="tracker-result-item">
            <div class="tracker-result-name" title="${p.playlistName}">${p.playlistName}</div>
            <div class="tracker-result-pos">
              #${p.position}
              ${getChangeSymbol(p)}
            </div>
          </div>
        `).join('')}
        ${playlists.length > 5 ? `<div style="font-size: 12px; opacity: 0.8; margin-top: 8px;">...and ${playlists.length - 5} more</div>` : ''}
      </div>
    `;
  }
  
  document.body.appendChild(overlay);
  overlayElements.push(overlay);
  
  // Add click handlers
  const closeBtn = overlay.querySelector('.tracker-overlay-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.remove();
    });
  }
  
  // Click overlay to open extension popup
  overlay.addEventListener('click', (e) => {
    // Don't trigger if clicking the close button
    if (!e.target.classList.contains('tracker-overlay-close')) {
      console.log('[Spotify Tracker] Overlay clicked - opening popup');
      // Try to open the extension popup
      chrome.runtime.sendMessage({ 
        type: 'open-popup' 
      }, response => {
        if (chrome.runtime.lastError) {
          console.log('[Spotify Tracker] Could not open popup:', chrome.runtime.lastError);
        }
      });
    }
  });
  
  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (overlay.parentNode) {
      overlay.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => overlay.remove(), 300);
    }
  }, 10000);
}

function getChangeIndicator(playlist) {
  if (playlist.isNew) {
    return '<div class="tracker-overlay-change"><span class="position-new">NEW</span> First time tracking!</div>';
  }
  
  if (!playlist.previousPosition) return '';
  
  const diff = playlist.previousPosition - playlist.position;
  if (diff > 0) {
    return `<div class="tracker-overlay-change position-improved">↑ ${diff} (was #${playlist.previousPosition})</div>`;
  } else if (diff < 0) {
    return `<div class="tracker-overlay-change position-declined">↓ ${Math.abs(diff)} (was #${playlist.previousPosition})</div>`;
  } else {
    return '<div class="tracker-overlay-change position-same">→ Same position</div>';
  }
}

function getChangeSymbol(playlist) {
  if (playlist.isNew) return '<span style="font-size: 10px;">NEW</span>';
  if (!playlist.previousPosition) return '';
  
  const diff = playlist.previousPosition - playlist.position;
  if (diff > 0) return `<span style="color: #4ade80;">↑${diff}</span>`;
  if (diff < 0) return `<span style="color: #fca5a5;">↓${Math.abs(diff)}</span>`;
  return '<span style="color: rgba(255,255,255,0.5);">→</span>';
}

function addBadgesToPlaylistElements(playlists) {
  // Try to find playlist elements on the page and add badges
  setTimeout(() => {
    // Try different selectors that Spotify might use
    const selectors = [
      '[data-testid="playlist-entity-card"]',
      '[data-testid="card-click-handler"]',
      '[aria-label*="playlist"]',
      'a[href*="/playlist/"]'
    ];
    
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        // Try to find the playlist ID in the element
        const href = element.href || element.querySelector('a')?.href || '';
        const match = href.match(/playlist\/([a-zA-Z0-9]+)/);
        
        if (match) {
          const playlistId = match[1];
          const foundPlaylist = playlists.find(p => p.playlistId === playlistId);
          
          if (foundPlaylist && !element.querySelector('.spotify-tracker-badge')) {
            const badge = document.createElement('div');
            badge.className = 'spotify-tracker-badge';
            badge.textContent = `#${foundPlaylist.position}`;
            
            // Make the parent position relative if needed
            const parent = element.querySelector('[data-testid="card"]') || element;
            if (parent.style.position === '' || parent.style.position === 'static') {
              parent.style.position = 'relative';
            }
            
            parent.appendChild(badge);
          }
        }
      });
    });
  }, 500);
}

function removeAllOverlays() {
  overlayElements.forEach(overlay => {
    if (overlay.parentNode) {
      overlay.remove();
    }
  });
  overlayElements = [];
  
  // Also remove badges
  document.querySelectorAll('.spotify-tracker-badge').forEach(badge => badge.remove());
}

function extractPlaylistId(uri) {
  if (!uri) return null;
  const parts = uri.split(':');
  return parts[parts.length - 1];
}

async function saveRankings(rankings) {
  // Get existing history
  const { rankingHistory = [] } = await chrome.storage.local.get('rankingHistory');
  
  // Add new rankings - ALWAYS save for historical tracking
  rankingHistory.push(...rankings);
  
  // Keep only last 10000 entries to prevent storage issues
  if (rankingHistory.length > 10000) {
    rankingHistory.splice(0, rankingHistory.length - 10000);
  }
  
  // Save back to storage
  await chrome.storage.local.set({ 
    rankingHistory,
    lastUpdated: new Date().toISOString()
  });
  
  // Also send to background for potential backend sync
  chrome.runtime.sendMessage({
    type: 'new-rankings',
    rankings
  });
}

async function saveTokens(tokens) {
  await chrome.storage.local.set({ 
    tokens: {
      ...tokens,
      capturedAt: new Date().toISOString()
    }
  });
  
  chrome.runtime.sendMessage({
    type: 'tokens-updated',
    tokens
  });
}

// Listen for changes to the URL (navigation in Spotify)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    console.log('[Spotify Tracker] Navigation detected:', url);
    
    // Reset tracking when navigating away from search
    if (!url.includes('/search/')) {
      currentSearchKeyword = '';
      currentSearchSession.clear();
      removeAllOverlays();
    }
  }
}).observe(document, {subtree: true, childList: true});