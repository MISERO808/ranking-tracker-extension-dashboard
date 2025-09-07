// inject.js - Injected directly into the page context
// This allows us to intercept fetch/XMLHttpRequest calls

(function() {
  console.log('[Spotify Tracker Inject] Interceptor loaded');
  
  let capturedTokens = {};
  let capturedUserId = null;  // Define at top level
  let capturedMarket = null;  // Define at top level
  let sessionId = generateSessionId();
  let currentSearchKeyword = '';
  let allSearchResults = new Map(); // Store all results by keyword
  let bestPositions = new Map(); // Track best position for each playlist
  
  // Override fetch to intercept API calls
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const [url, options = {}] = args;
    
    // PRIORITY: Capture market from masthead API (most reliable)
    if (url.includes('/api/masthead/v1/masthead')) {
      const match = url.match(/market=([A-Z]{2})/i);
      if (match) {
        capturedMarket = match[1].toUpperCase();
        console.log(`[Spotify Tracker Inject] Captured market from masthead: ${capturedMarket}`);
        try {
          sessionStorage.setItem('spotify-tracker-market', capturedMarket);
        } catch(e) {}
      }
    }
    
    // Capture user ID from profile URLs
    if (url.includes('/user/') || url.includes('/v1/me')) {
      const userMatch = url.match(/\/user\/([a-z0-9]{24,})/);
      if (userMatch) {
        capturedUserId = userMatch[1];
        console.log(`[Spotify Tracker Inject] Captured user ID from URL: ${capturedUserId}`);
        try {
          sessionStorage.setItem('spotify-tracker-userid', capturedUserId);
        } catch(e) {}
      }
    }
    
    // Capture tokens from headers
    if (options.headers) {
      if (options.headers['Authorization']) {
        capturedTokens.accessToken = options.headers['Authorization'].replace('Bearer ', '');
      }
      if (options.headers['client-token']) {
        capturedTokens.clientToken = options.headers['client-token'];
      }
      
      // Send tokens if we have both
      if (capturedTokens.accessToken && capturedTokens.clientToken) {
        window.dispatchEvent(new CustomEvent('spotify-ranking-data', {
          detail: {
            type: 'tokens-captured',
            tokens: capturedTokens
          }
        }));
      }
    }
    
    // Call original fetch
    const response = await originalFetch.apply(this, args);
    
    // Intercept search results
    if (url.includes('/pathfinder/v2/query') && options.body) {
      try {
        const requestBody = JSON.parse(options.body);
        const operationName = requestBody.operationName;
        
        // Try to capture market from variables if not already captured
        if (!capturedMarket && requestBody.variables && requestBody.variables.market) {
          capturedMarket = requestBody.variables.market.toUpperCase();
          console.log(`[Spotify Tracker Inject] Captured market from search: ${capturedMarket}`);
          sessionStorage.setItem('spotify-tracker-market', capturedMarket);
        }
        
        // Check if this is a search query
        if (operationName === 'searchTracks' || 
            operationName === 'searchPlaylists' ||
            operationName === 'searchAll' ||
            operationName === 'searchDesktop') {
          
          // Clone response to read it
          const clonedResponse = response.clone();
          const responseData = await clonedResponse.json();
          
          // Process based on query type
          if (operationName === 'searchPlaylists') {
            // This is playlist-only search, positions are accurate
            processSearchResponse(responseData, requestBody, true);
          } else if (operationName === 'searchDesktop' || operationName === 'searchAll') {
            // Mixed results, positions need adjustment
            processSearchResponse(responseData, requestBody, false);
          }
        }
      } catch (e) {
        // Not a search query or couldn't parse
      }
    }
    
    return response;
  };
  
  function processSearchResponse(responseData, requestBody) {
    try {
      const operationName = requestBody.operationName;
      const variables = requestBody.variables || {};
      const keyword = variables.searchTerm || variables.query || '';
      
      // Try to capture market from variables
      if (variables.market && !capturedMarket) {
        capturedMarket = variables.market.toUpperCase();
        console.log(`[Spotify Tracker Inject] Captured market from search variables: ${capturedMarket}`);
        sessionStorage.setItem('spotify-tracker-market', capturedMarket);
      }
      
      if (!keyword) return;
      
      // Check if this is a new search
      if (keyword !== currentSearchKeyword) {
        currentSearchKeyword = keyword;
        allSearchResults.set(keyword, []);
        bestPositions.clear();
        console.log(`[Spotify Tracker Inject] New search: "${keyword}"`);
      }
      
      // Extract playlists from response - try different paths
      let playlists = [];
      let totalCount = 0;
      let actualOffset = variables.offset || 0;
      
      // Handle different response structures for searchPlaylists
      if (responseData.data?.searchV2?.playlists) {
        playlists = responseData.data.searchV2.playlists.items || [];
        totalCount = responseData.data.searchV2.playlists.totalCount || playlists.length;
      } else if (responseData.data?.search?.playlists) {
        playlists = responseData.data.search.playlists.items || [];
        totalCount = responseData.data.search.playlists.totalCount || playlists.length;
      } else if (responseData.data?.searchPlaylists) {
        playlists = responseData.data.searchPlaylists.items || [];
        totalCount = responseData.data.searchPlaylists.totalCount || playlists.length;
      }
      
      if (playlists.length > 0) {
        console.log(`[Spotify Tracker Inject] Found ${playlists.length} playlists for "${keyword}"`);
        
        // Get existing results for this keyword
        const existingResults = allSearchResults.get(keyword) || [];
        
        // Process new playlists
        playlists.forEach((playlist, index) => {
          const playlistId = extractIdFromUri(playlist.data?.uri || playlist.uri);
          const playlistName = playlist.data?.name || playlist.name;
          const position = actualOffset + index + 1;
          
          // Check if we already have this playlist
          const existingIndex = existingResults.findIndex(r => r.id === playlistId);
          
          if (existingIndex >= 0) {
            // Update position
            existingResults[existingIndex].position = position;
            console.log(`[Spotify Tracker Inject] Updated ${playlistName} to position #${position}`);
          } else {
            // Add new playlist
            existingResults.push({
              position: position,
              uri: playlist.data?.uri || playlist.uri,
              name: playlistName,
              id: playlistId
            });
            console.log(`[Spotify Tracker Inject] Added ${playlistName} at position #${position}`);
          }
        });
        
        // Sort by position
        existingResults.sort((a, b) => a.position - b.position);
        
        // Update stored results
        allSearchResults.set(keyword, existingResults);
        
        // Get territory
        let territory = variables.market || extractTerritoryFromUrl();
        if (!territory || territory === 'Unknown') {
          try {
            territory = capturedMarket || sessionStorage.getItem('spotify-tracker-market') || 'Unknown';
          } catch(e) {
            territory = 'Unknown';
          }
        }
        if (territory && territory !== 'Unknown') {
          territory = territory.toUpperCase();
        }
        
        // Get user ID
        if (!capturedUserId) {
          try {
            capturedUserId = sessionStorage.getItem('spotify-tracker-userid');
          } catch(e) {}
          
          if (!capturedUserId) {
            const userLink = document.querySelector('a[href*="/user/"]');
            if (userLink) {
              const match = userLink.href.match(/\/user\/([a-z0-9]{24,})/);
              if (match) {
                capturedUserId = match[1];
                sessionStorage.setItem('spotify-tracker-userid', capturedUserId);
              }
            }
          }
          
          if (!capturedUserId) {
            const keys = Object.keys(localStorage);
            const userPattern = /^([a-z0-9]{24,}):/;
            for (let i = keys.length - 1; i >= 0; i--) {
              const match = keys[i].match(userPattern);
              if (match) {
                capturedUserId = match[1];
                break;
              }
            }
          }
        }
        
        console.log(`[Spotify Tracker Inject] Sending data - User: ${capturedUserId}, Market: ${territory}`);
        
        // Send to content script
        window.dispatchEvent(new CustomEvent('spotify-ranking-data', {
          detail: {
            type: 'search-results',
            keyword: keyword,
            results: existingResults,
            totalResults: totalCount,
            capturedResults: existingResults.length,
            offset: actualOffset,
            territory: territory,
            userId: capturedUserId || 'unknown',
            sessionId: sessionId,
            timestamp: new Date().toISOString()
          }
        }));
      }
    } catch (error) {
      console.error('[Spotify Tracker Inject] Error processing search response:', error);
    }
  }
  
  function extractIdFromUri(uri) {
    if (!uri) return null;
    const parts = uri.split(':');
    return parts[parts.length - 1];
  }
  
  function extractTerritoryFromUrl() {
    // Try to extract territory from URL params or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const market = urlParams.get('market');
    if (market) return market;
    
    // Try localStorage for Spotify settings
    try {
      const spotifySettings = localStorage.getItem('spotify:settings');
      if (spotifySettings) {
        const settings = JSON.parse(spotifySettings);
        if (settings.market) return settings.market;
      }
      
      // Try other localStorage keys
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.includes('market') || key.includes('country')) {
          const value = localStorage.getItem(key);
          try {
            const parsed = JSON.parse(value);
            if (parsed.market) return parsed.market;
            if (parsed.country) return parsed.country;
          } catch (e) {
            // Not JSON, check if it's a country code
            if (value && value.length === 2) return value.toUpperCase();
          }
        }
      }
      
      // Check Spotify's session storage
      const sessionKeys = Object.keys(sessionStorage);
      for (const key of sessionKeys) {
        if (key.includes('market') || key.includes('country')) {
          const value = sessionStorage.getItem(key);
          if (value && value.length === 2) return value.toUpperCase();
        }
      }
    } catch (e) {
      console.log('[Spotify Tracker] Could not extract territory from storage');
    }
    
    // Try to get from Spotify's global object if available
    try {
      if (window.Spotify?.Session?.get()?.market) {
        return window.Spotify.Session.get().market;
      }
    } catch (e) {}
    
    return null;
  }
  
  function generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
  
  // Clear results when navigating away from search
  let lastUrl = window.location.href;
  setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      if (!currentUrl.includes('/search/')) {
        // Clear search state when leaving search
        currentSearchKeyword = '';
        allSearchResults.clear();
        bestPositions.clear();
      }
    }
  }, 1000);
  
  // On page load, try to capture user ID from the page
  setTimeout(() => {
    if (!capturedUserId) {
      // Try multiple selectors for user links
      const selectors = [
        'a[href*="/user/"]',
        '[data-testid="user-widget-link"]',
        'a[href*="spotify:user:"]'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.href) {
          const match = element.href.match(/\/user\/([a-z0-9]{24,})/);
          if (match) {
            capturedUserId = match[1];
            console.log(`[Spotify Tracker Inject] Captured user ID from page: ${capturedUserId}`);
            sessionStorage.setItem('spotify-tracker-userid', capturedUserId);
            break;
          }
        }
      }
    }
  }, 2000);
  
  // Also intercept XMLHttpRequest if Spotify uses it
  const originalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    const xhr = new originalXHR();
    
    const originalSetRequestHeader = xhr.setRequestHeader;
    xhr.setRequestHeader = function(header, value) {
      if (header === 'Authorization') {
        capturedTokens.accessToken = value.replace('Bearer ', '');
      }
      if (header === 'client-token') {
        capturedTokens.clientToken = value;
      }
      
      if (capturedTokens.accessToken && capturedTokens.clientToken) {
        window.dispatchEvent(new CustomEvent('spotify-ranking-data', {
          detail: {
            type: 'tokens-captured',
            tokens: capturedTokens
          }
        }));
      }
      
      return originalSetRequestHeader.apply(this, arguments);
    };
    
    return xhr;
  };
  
  console.log('[Spotify Tracker Inject] Interception ready');
})();