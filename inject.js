// inject.js - Injected directly into the page context
// This allows us to intercept fetch/XMLHttpRequest calls

// Delay initialization slightly to let Spotify load first
setTimeout(() => {
  console.log('[Spotify Tracker Inject] Script starting...');

  (function() {
    console.log('[Spotify Tracker Inject] Interceptor loaded - Version 1.3');
  
  let capturedTokens = {};
  let capturedUserId = null;  // Define at top level
  let capturedMarket = null;  // Define at top level
  let sessionId = generateSessionId();
  let currentSearchKeyword = '';
  let allSearchResults = new Map(); // Store all results by keyword
  let bestPositions = new Map(); // Track best position for each playlist
  
  // Override fetch to intercept API calls (more subtly)
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const [url, options = {}] = args;
    
    // Call original fetch FIRST to avoid timing issues
    let response;
    try {
      response = await originalFetch.apply(this, args);
    } catch (error) {
      // If fetch fails, just throw the error without interfering
      throw error;
    }
    
    // Now process the request/response AFTER the original call succeeded
    // This prevents interfering with Spotify's initial page load
    
    // PRIORITY: Capture market from masthead API (most reliable)
    if (url.includes('/api/masthead/v1/masthead')) {
      console.log(`[Spotify Tracker Inject] MASTHEAD API DETECTED: ${url}`);
      const match = url.match(/market=([A-Z]{2})/i);
      if (match) {
        capturedMarket = match[1].toLowerCase();  // ALWAYS lowercase to prevent duplicates
        console.log(`[Spotify Tracker Inject] ✅ Captured market from masthead: ${capturedMarket}`);
        try {
          sessionStorage.setItem('spotify-tracker-market', capturedMarket);
        } catch(e) {}
      } else {
        console.log(`[Spotify Tracker Inject] ⚠️ Masthead API called but no market parameter found`);
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
    
    // Capture tokens from headers (after successful response)
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
    
    // Intercept search results
    if (url.includes('/pathfinder/v2/query') && options.body) {
      try {
        const requestBody = JSON.parse(options.body);
        const operationName = requestBody.operationName;
        
        // Try to capture market from variables if not already captured
        if (!capturedMarket && requestBody.variables && requestBody.variables.market) {
          capturedMarket = requestBody.variables.market.toLowerCase();  // ALWAYS lowercase to prevent duplicates
          console.log(`[Spotify Tracker Inject] Captured market from search: ${capturedMarket}`);
          sessionStorage.setItem('spotify-tracker-market', capturedMarket);
        }
        
        // ONLY capture from playlist-specific searches
        if (operationName === 'searchPlaylists') {
          console.log('[Spotify Tracker Inject] Detected playlist-specific search');
          
          // Clone response to read it
          const clonedResponse = response.clone();
          const responseData = await clonedResponse.json();
          
          // Process playlist-only search results (positions are accurate)
          processSearchResponse(responseData, requestBody, true);
        } else if (operationName === 'searchDesktop' || operationName === 'searchAll') {
          // Ignore general search results - they have different positions
          console.log('[Spotify Tracker Inject] Ignoring general search (searchDesktop/searchAll) - only capturing playlist tab results');
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
        capturedMarket = variables.market.toLowerCase();  // ALWAYS lowercase to prevent duplicates
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
        console.log('[Spotify Tracker Inject] Debug - Market sources:', {
          fromVariables: variables.market || 'none',
          capturedMarket: capturedMarket || 'none',
          sessionStorage: sessionStorage.getItem('spotify-tracker-market') || 'none',
          willUse: variables.market || capturedMarket || 'will default'
        });
        
        // Get existing results for this keyword
        const existingResults = allSearchResults.get(keyword) || [];
        
        // Process new playlists
        playlists.forEach((playlist, index) => {
          const playlistId = extractIdFromUri(playlist.data?.uri || playlist.uri);
          const playlistName = playlist.data?.name || playlist.name;
          const position = actualOffset + index + 1;
          
          // Extract image URL from the playlist data - try all possible structures
          let playlistImage = '';
          
          // Log the playlist structure to understand it better
          console.log('[Spotify Tracker Inject] Playlist structure:', {
            hasData: !!playlist.data,
            hasImages: !!playlist.images,
            hasCoverArt: !!playlist.coverArt,
            hasDataImages: !!playlist.data?.images,
            hasDataCoverArt: !!playlist.data?.coverArt
          });
          
          // Try different image property paths that Spotify uses
          if (playlist.data?.images?.items && playlist.data.images.items.length > 0) {
            playlistImage = playlist.data.images.items[0]?.sources?.[0]?.url || '';
          } else if (playlist.images?.items && playlist.images.items.length > 0) {
            playlistImage = playlist.images.items[0]?.sources?.[0]?.url || '';
          } else if (playlist.data?.coverArt?.sources && playlist.data.coverArt.sources.length > 0) {
            playlistImage = playlist.data.coverArt.sources[0]?.url || '';
          } else if (playlist.coverArt?.sources && playlist.coverArt.sources.length > 0) {
            playlistImage = playlist.coverArt.sources[0]?.url || '';
          } else if (playlist.data?.image) {
            playlistImage = playlist.data.image;
          } else if (playlist.image) {
            playlistImage = playlist.image;
          }
          
          if (playlistImage) {
            console.log(`[Spotify Tracker Inject] Found image for ${playlistName}: ${playlistImage.substring(0, 50)}...`);
          } else {
            console.log(`[Spotify Tracker Inject] No image found for ${playlistName}`);
          }
          
          // Check if we already have this playlist
          const existingIndex = existingResults.findIndex(r => r.id === playlistId);
          
          if (existingIndex >= 0) {
            // Update position and image
            existingResults[existingIndex].position = position;
            existingResults[existingIndex].image = playlistImage;
            console.log(`[Spotify Tracker Inject] Updated ${playlistName} to position #${position}`);
          } else {
            // Add new playlist
            existingResults.push({
              position: position,
              uri: playlist.data?.uri || playlist.uri,
              name: playlistName,
              id: playlistId,
              image: playlistImage
            });
            console.log(`[Spotify Tracker Inject] Added ${playlistName} at position #${position}`);
          }
        });
        
        // Sort by position
        existingResults.sort((a, b) => a.position - b.position);
        
        // Update stored results
        allSearchResults.set(keyword, existingResults);
        
        // Get territory - try multiple sources in priority order
        let territory = null;
        
        // Priority 1: From search variables
        if (variables.market && variables.market !== 'Unknown') {
          territory = variables.market.toLowerCase();  // ALWAYS lowercase to prevent duplicates
        }
        
        // Priority 2: From captured market (masthead API) - most reliable
        if (!territory && capturedMarket && capturedMarket !== 'Unknown') {
          territory = capturedMarket.toLowerCase();  // ALWAYS lowercase to prevent duplicates
        }
        
        // Priority 3: From sessionStorage
        if (!territory) {
          try {
            const storedMarket = sessionStorage.getItem('spotify-tracker-market');
            if (storedMarket && storedMarket !== 'Unknown') {
              territory = storedMarket.toLowerCase();  // ALWAYS lowercase to prevent duplicates
            }
          } catch(e) {}
        }
        
        // Priority 4: From URL or localStorage
        if (!territory) {
          const extractedTerritory = extractTerritoryFromUrl();
          if (extractedTerritory && extractedTerritory !== 'Unknown') {
            territory = extractedTerritory.toLowerCase();  // ALWAYS lowercase to prevent duplicates
          }
        }
        
        // If no territory found yet and this is the first batch of results, 
        // wait longer for masthead API to complete
        if ((!territory || territory === 'Unknown' || territory === 'unknown') && actualOffset === 0) {
          console.log('[Spotify Tracker Inject] No territory detected on first results - waiting for masthead API...');
          
          // Try multiple times with increasing delays
          let retryCount = 0;
          const maxRetries = 3;
          const retryDelays = [1000, 1500, 2000]; // Wait 1s, then 1.5s, then 2s
          
          const retryTerritoryDetection = () => {
            // Re-check for captured market
            let retryTerritory = capturedMarket || sessionStorage.getItem('spotify-tracker-market');
            
            if (!retryTerritory || retryTerritory === 'Unknown') {
              retryCount++;
              if (retryCount < maxRetries) {
                console.log(`[Spotify Tracker Inject] Territory not found (attempt ${retryCount}/${maxRetries}), retrying...`);
                setTimeout(retryTerritoryDetection, retryDelays[retryCount]);
                return;
              } else {
                console.log('[Spotify Tracker Inject] Territory not found after all retries, defaulting to DE');
                retryTerritory = 'de';
              }
            } else {
              console.log(`[Spotify Tracker Inject] Territory detected on retry ${retryCount + 1}: ${retryTerritory}`);
            }
            
            // Re-send the data with correct territory
            window.dispatchEvent(new CustomEvent('spotify-ranking-data', {
              detail: {
                type: 'search-results',
                keyword: keyword,
                results: existingResults,
                totalResults: totalCount,
                capturedResults: existingResults.length,
                offset: actualOffset,
                territory: retryTerritory.toLowerCase(),
                userId: capturedUserId || 'unknown',
                sessionId: sessionId,
                timestamp: new Date().toISOString()
              }
            }));
          };
          
          // Start retry process after first delay
          setTimeout(retryTerritoryDetection, retryDelays[0]);
          
          // Don't send initial data with potentially wrong territory
          return; // Skip sending the initial event
        }
        
        // Default to 'de' if no territory found (instead of blocking)
        if (!territory || territory === 'Unknown' || territory === 'unknown') {
          console.log('[Spotify Tracker Inject] WARNING: No valid territory found, defaulting to DE');
          territory = 'de'; // Default to DE instead of blocking
        }
        
        console.log(`[Spotify Tracker Inject] Final territory: ${territory}`);
        
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
    console.log('[Spotify Tracker Inject] Extracting territory from various sources...');
    
    // Try URL params first
    const urlParams = new URLSearchParams(window.location.search);
    const market = urlParams.get('market');
    if (market && market.length === 2) {
      console.log(`[Spotify Tracker Inject] Found market in URL: ${market}`);
      return market.toLowerCase();  // ALWAYS lowercase to prevent duplicates
    }
    
    // Try localStorage for Spotify settings
    try {
      // Check common Spotify localStorage keys
      const spotifyKeys = Object.keys(localStorage).filter(key => 
        key.includes('spotify') || key.includes('market') || key.includes('country')
      );
      
      for (const key of spotifyKeys) {
        try {
          const value = localStorage.getItem(key);
          if (!value) continue;
          
          // Try parsing as JSON first
          try {
            const parsed = JSON.parse(value);
            if (parsed.market && parsed.market.length === 2) {
              console.log(`[Spotify Tracker Inject] Found market in localStorage[${key}]: ${parsed.market}`);
              return parsed.market.toLowerCase();  // ALWAYS lowercase to prevent duplicates
            }
            if (parsed.country && parsed.country.length === 2) {
              console.log(`[Spotify Tracker Inject] Found country in localStorage[${key}]: ${parsed.country}`);
              return parsed.country.toLowerCase();  // ALWAYS lowercase to prevent duplicates
            }
          } catch (parseError) {
            // Not JSON, check if it's a direct country code
            if (value.length === 2 && /^[A-Z]{2}$/i.test(value)) {
              console.log(`[Spotify Tracker Inject] Found country code in localStorage[${key}]: ${value}`);
              return value.toLowerCase();  // ALWAYS lowercase to prevent duplicates
            }
          }
        } catch (e) {
          // Skip this key
        }
      }
      
      // Check sessionStorage too
      const sessionKeys = Object.keys(sessionStorage);
      for (const key of sessionKeys) {
        if (key.includes('market') || key.includes('country')) {
          const value = sessionStorage.getItem(key);
          if (value && value.length === 2 && /^[A-Z]{2}$/i.test(value)) {
            console.log(`[Spotify Tracker Inject] Found market in sessionStorage[${key}]: ${value}`);
            return value.toLowerCase();  // ALWAYS lowercase to prevent duplicates
          }
        }
      }
    } catch (e) {
      console.log('[Spotify Tracker Inject] Could not extract territory from storage:', e);
    }
    
    // Try Spotify's global objects
    try {
      if (window.Spotify?.Session?.get()?.market) {
        const market = window.Spotify.Session.get().market;
        console.log(`[Spotify Tracker Inject] Found market in Spotify.Session: ${market}`);
        return market.toLowerCase();  // ALWAYS lowercase to prevent duplicates
      }
      
      // Try other Spotify global objects
      if (window.__spotify && window.__spotify.market) {
        console.log(`[Spotify Tracker Inject] Found market in __spotify: ${window.__spotify.market}`);
        return window.__spotify.market.toLowerCase();  // ALWAYS lowercase to prevent duplicates
      }
    } catch (e) {
      console.log('[Spotify Tracker Inject] Could not extract territory from global objects:', e);
    }
    
    // Try to infer from page language or other indicators
    try {
      const htmlLang = document.documentElement.lang;
      if (htmlLang && htmlLang.includes('-')) {
        const country = htmlLang.split('-')[1];
        if (country && country.length === 2) {
          console.log(`[Spotify Tracker Inject] Inferred country from HTML lang: ${country}`);
          return country.toLowerCase();  // ALWAYS lowercase to prevent duplicates
        }
      }
    } catch (e) {}
    
    console.log('[Spotify Tracker Inject] No territory found from any source');
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
}, 100); // Delay by 100ms to let Spotify initialize first