// popup.js - Enhanced popup interface logic with starred keywords

document.addEventListener('DOMContentLoaded', async () => {
  await loadWatchedPlaylists();
  await loadStats();
  await loadRecentRankings();
  await loadStarredKeywords();
  
  // Add playlist
  document.getElementById('add-playlist-btn').addEventListener('click', addPlaylist);
  document.getElementById('playlist-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addPlaylist();
  });
  
  // Export options
  document.getElementById('export-csv-all').addEventListener('click', () => exportCSV('all'));
  document.getElementById('export-csv-playlist').addEventListener('click', () => exportCSV('byPlaylist'));
  document.getElementById('export-json').addEventListener('click', exportJSON);
  
  // Clear all rankings
  document.getElementById('clear-all').addEventListener('click', clearAllRankings);
  
  // Sync to backend
  document.getElementById('sync-btn').addEventListener('click', syncToBackend);
  
  // Open in new tab button
  document.getElementById('open-tab-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
  });
  
  // Tab switching
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
      switchTab(e.target.dataset.tab);
    });
  });
});

function switchTab(tabName) {
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(content => {
    content.style.display = 'none';
  });
  
  // Remove active class from all buttons
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.remove('active');
  });
  
  // Show selected tab
  document.getElementById(`${tabName}-tab`).style.display = 'block';
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  
  // Load content for the tab
  if (tabName === 'starred') {
    loadStarredKeywords();
  }
}

async function loadStarredKeywords() {
  const { starredKeywords = [], rankingHistory = [] } = await chrome.storage.local.get(['starredKeywords', 'rankingHistory']);
  const container = document.getElementById('starred-keywords');
  
  if (starredKeywords.length === 0) {
    container.innerHTML = '<div class="empty-state">No starred keywords yet. Star keywords from recent rankings!</div>';
    return;
  }
  
  container.innerHTML = '';
  
  starredKeywords.forEach(keyword => {
    // Get all rankings for this keyword
    const keywordRankings = rankingHistory
      .filter(r => r.keyword === keyword)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (keywordRankings.length === 0) return;
    
    const latestRanking = keywordRankings[0];
    const bestRanking = keywordRankings.reduce((best, current) => 
      (!best || current.position < best.position) ? current : best, null);
    
    const item = document.createElement('div');
    item.className = 'starred-keyword-item';
    item.innerHTML = `
      <div class="keyword-header">
        <span class="keyword-text keyword-link" data-keyword="${keyword}">"${keyword}"</span>
        <span class="unstar-btn" data-keyword="${keyword}">⭐</span>
      </div>
      <div class="keyword-stats">
        <span>Latest: #${latestRanking.position} ${getCountryFlag(latestRanking.territory)}</span>
        <span>Best: #${bestRanking.position}</span>
        <span>${keywordRankings.length} rankings</span>
      </div>
    `;
    
    item.querySelector('.unstar-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleStarKeyword(keyword);
    });
    
    // Add keyword click handler
    item.querySelector('.keyword-link').addEventListener('click', (e) => {
      e.stopPropagation();
      openSpotifySearch(keyword);
    });
    
    container.appendChild(item);
  });
}

async function toggleStarKeyword(keyword) {
  const { starredKeywords = [] } = await chrome.storage.local.get('starredKeywords');
  
  const index = starredKeywords.indexOf(keyword);
  if (index > -1) {
    // Unstar
    starredKeywords.splice(index, 1);
  } else {
    // Star
    starredKeywords.push(keyword);
  }
  
  await chrome.storage.local.set({ starredKeywords });
  
  // Refresh both tabs
  await loadRecentRankings();
  await loadStarredKeywords();
  
  showNotification(index > -1 ? 'Keyword unstarred' : 'Keyword starred');
}

// Function to open Spotify search
async function openSpotifySearch(keyword) {
  // Find or create a Spotify tab
  const tabs = await chrome.tabs.query({ url: '*://open.spotify.com/*' });
  
  const searchUrl = `https://open.spotify.com/search/${encodeURIComponent(keyword)}/playlists`;
  
  if (tabs.length > 0) {
    // Update existing Spotify tab
    await chrome.tabs.update(tabs[0].id, { 
      url: searchUrl,
      active: true 
    });
    // Focus on the tab
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    // Open new tab
    await chrome.tabs.create({ url: searchUrl });
  }
}

// Helper function to get country flag emoji
function getCountryFlag(territory) {
  const flags = {
    'US': '🇺🇸', 'GB': '🇬🇧', 'UK': '🇬🇧', 'DE': '🇩🇪', 'FR': '🇫🇷', 
    'ES': '🇪🇸', 'IT': '🇮🇹', 'NL': '🇳🇱', 'PL': '🇵🇱', 'BR': '🇧🇷',
    'CA': '🇨🇦', 'AU': '🇦🇺', 'JP': '🇯🇵', 'MX': '🇲🇽', 'AR': '🇦🇷',
    'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰', 'FI': '🇫🇮', 'BE': '🇧🇪',
    'CH': '🇨🇭', 'AT': '🇦🇹', 'IE': '🇮🇪', 'NZ': '🇳🇿', 'PT': '🇵🇹',
    'IN': '🇮🇳', 'SG': '🇸🇬', 'MY': '🇲🇾', 'TH': '🇹🇭', 'ID': '🇮🇩',
    'PH': '🇵🇭', 'VN': '🇻🇳', 'KR': '🇰🇷', 'TW': '🇹🇼', 'HK': '🇭🇰',
    'CN': '🇨🇳', 'RU': '🇷🇺', 'TR': '🇹🇷', 'GR': '🇬🇷', 'IL': '🇮🇱',
    'SA': '🇸🇦', 'AE': '🇦🇪', 'EG': '🇪🇬', 'ZA': '🇿🇦', 'NG': '🇳🇬',
    'KE': '🇰🇪', 'CL': '🇨🇱', 'CO': '🇨🇴', 'PE': '🇵🇪', 'VE': '🇻🇪',
    'UY': '🇺🇾', 'EC': '🇪🇨', 'CR': '🇨🇷', 'PA': '🇵🇦', 'DO': '🇩🇴'
  };
  return flags[territory?.toUpperCase()] || '🌍';
}

async function loadWatchedPlaylists() {
  const { watchedPlaylists = {} } = await chrome.storage.local.get('watchedPlaylists');
  const playlistList = document.getElementById('playlist-list');
  const count = Object.keys(watchedPlaylists).length;
  
  document.getElementById('playlist-count').textContent = `(${count})`;
  
  if (count === 0) {
    playlistList.innerHTML = '<div class="empty-state">No playlists watched yet</div>';
    return;
  }
  
  playlistList.innerHTML = '';
  
  Object.entries(watchedPlaylists).forEach(([id, playlist]) => {
    const item = document.createElement('div');
    item.className = 'playlist-item';
    item.innerHTML = `
      <span class="name" title="${playlist.name}">${playlist.name || id}</span>
      <span class="remove" data-id="${id}">✕</span>
    `;
    
    item.querySelector('.remove').addEventListener('click', () => removePlaylist(id));
    playlistList.appendChild(item);
  });
}

async function addPlaylist() {
  const input = document.getElementById('playlist-input');
  const value = input.value.trim();
  
  if (!value) return;
  
  // Extract playlist ID from URL or use as-is
  let playlistId = value;
  
  // Handle different URL formats
  if (value.includes('spotify.com/playlist/')) {
    playlistId = value.split('/playlist/')[1].split('?')[0];
  } else if (value.includes('spotify:playlist:')) {
    playlistId = value.split('spotify:playlist:')[1];
  }
  
  // Get existing playlists
  const { watchedPlaylists = {} } = await chrome.storage.local.get('watchedPlaylists');
  
  // Add new playlist
  watchedPlaylists[playlistId] = {
    name: `Playlist ${playlistId.substring(0, 8)}...`, // Will be updated when we see it in search
    addedAt: new Date().toISOString()
  };
  
  // Save and reload
  await chrome.storage.local.set({ watchedPlaylists });
  input.value = '';
  await loadWatchedPlaylists();
  
  showNotification('Playlist added!');
}

async function removePlaylist(playlistId) {
  const { watchedPlaylists = {} } = await chrome.storage.local.get('watchedPlaylists');
  delete watchedPlaylists[playlistId];
  await chrome.storage.local.set({ watchedPlaylists });
  await loadWatchedPlaylists();
}

async function loadStats() {
  const { rankingHistory = [] } = await chrome.storage.local.get('rankingHistory');
  
  // Filter for today's rankings
  const today = new Date().toDateString();
  const todayRankings = rankingHistory.filter(r => 
    new Date(r.timestamp).toDateString() === today
  );
  
  // Calculate stats
  const searches = new Set(todayRankings.map(r => r.keyword)).size;
  const positions = todayRankings.map(r => r.position);
  const avgPosition = positions.length ? 
    (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1) : '-';
  const bestPosition = positions.length ? Math.min(...positions) : '-';
  
  // Update UI
  document.getElementById('searches-today').textContent = searches;
  document.getElementById('rankings-found').textContent = todayRankings.length;
  document.getElementById('avg-position').textContent = avgPosition;
  document.getElementById('best-position').textContent = bestPosition;
}

async function loadRecentRankings() {
  const { rankingHistory = [], watchedPlaylists = {}, starredKeywords = [] } = 
    await chrome.storage.local.get(['rankingHistory', 'watchedPlaylists', 'starredKeywords']);
  const container = document.getElementById('recent-rankings');
  
  if (rankingHistory.length === 0) {
    container.innerHTML = '<div class="empty-state">No rankings captured yet</div>';
    return;
  }
  
  // Get last 20 rankings
  const recent = rankingHistory.slice(-20).reverse();
  
  container.innerHTML = '';
  recent.forEach(ranking => {
    const item = document.createElement('div');
    item.className = 'ranking-item';
    
    const time = getTimeAgo(ranking.timestamp);
    const playlistName = watchedPlaylists[ranking.playlistId]?.name || ranking.playlistName || 'Unknown Playlist';
    const flag = getCountryFlag(ranking.territory);
    const isStarred = starredKeywords.includes(ranking.keyword);
    
    item.innerHTML = `
      <div class="ranking-content">
        <span class="ranking-playlist" title="${playlistName}">${playlistName}</span>
        <span class="ranking-keyword">
          <span class="star-btn ${isStarred ? 'starred' : ''}" data-keyword="${ranking.keyword}">
            ${isStarred ? '⭐' : '☆'}
          </span>
          <span class="keyword-link" data-keyword="${ranking.keyword}">"${ranking.keyword}"</span>
        </span>
        <span class="ranking-position">#${ranking.position} ${flag}</span>
        <span class="ranking-time">${time}</span>
      </div>
      <span class="delete-ranking" data-id="${ranking.id || `${ranking.playlistId}-${ranking.keyword}-${ranking.timestamp}`}">✕</span>
    `;
    
    // Add star handler
    item.querySelector('.star-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleStarKeyword(ranking.keyword);
    });
    
    // Add keyword click handler
    item.querySelector('.keyword-link').addEventListener('click', (e) => {
      e.stopPropagation();
      openSpotifySearch(ranking.keyword);
    });
    
    // Add delete handler
    item.querySelector('.delete-ranking').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteRanking(ranking.id || `${ranking.playlistId}-${ranking.keyword}-${ranking.timestamp}`);
    });
    
    container.appendChild(item);
  });
}

async function deleteRanking(rankingId) {
  const { rankingHistory = [] } = await chrome.storage.local.get('rankingHistory');
  
  // Filter out the deleted ranking
  const updatedHistory = rankingHistory.filter(r => 
    (r.id || `${r.playlistId}-${r.keyword}-${r.timestamp}`) !== rankingId
  );
  
  await chrome.storage.local.set({ rankingHistory: updatedHistory });
  await loadRecentRankings();
  await loadStats();
  
  showNotification('Ranking deleted');
}

async function clearAllRankings() {
  if (confirm('Are you sure you want to clear all rankings? This cannot be undone.')) {
    await chrome.storage.local.set({ rankingHistory: [] });
    await loadRecentRankings();
    await loadStats();
    showNotification('All rankings cleared');
  }
}

function getTimeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

async function exportCSV(mode) {
  const { rankingHistory = [], watchedPlaylists = {} } = await chrome.storage.local.get(['rankingHistory', 'watchedPlaylists']);
  
  if (rankingHistory.length === 0) {
    alert('No data to export');
    return;
  }
  
  if (mode === 'byPlaylist') {
    // Group by playlist and create separate CSV files
    const playlistGroups = {};
    
    rankingHistory.forEach(ranking => {
      if (!playlistGroups[ranking.playlistId]) {
        playlistGroups[ranking.playlistId] = [];
      }
      playlistGroups[ranking.playlistId].push(ranking);
    });
    
    // Create a CSV for each playlist
    for (const [playlistId, rankings] of Object.entries(playlistGroups)) {
      const playlistName = watchedPlaylists[playlistId]?.name || rankings[0]?.playlistName || playlistId;
      const csv = createCSV(rankings, playlistName);
      downloadCSV(csv, `spotify-rankings-${sanitizeFilename(playlistName)}-${new Date().toISOString().split('T')[0]}.csv`);
    }
    
    showNotification(`Exported ${Object.keys(playlistGroups).length} CSV files`);
  } else {
    // Export all as single CSV
    const csv = createCSV(rankingHistory, 'All Rankings');
    downloadCSV(csv, `spotify-rankings-all-${new Date().toISOString().split('T')[0]}.csv`);
    showNotification('Data exported as CSV');
  }
}

function createCSV(rankings, title) {
  // CSV with semicolon separator for better Excel/Numbers compatibility
  let csv = `${title}\n`;
  csv += 'Playlist;Keyword;Position;Date;Time;Territory;User ID;Captured Results;Total Results\n';
  
  // Sort by date descending
  const sorted = rankings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Add data rows
  sorted.forEach(ranking => {
    const date = new Date(ranking.timestamp);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString();
    
    // Use semicolon as separator and don't quote unless necessary
    csv += `${escapeCSV(ranking.playlistName || '')};${escapeCSV(ranking.keyword || '')};`;
    csv += `${ranking.position};${dateStr};${timeStr};${ranking.territory || 'Unknown'};`;
    csv += `${ranking.userId || 'unknown'};`;
    csv += `${ranking.capturedResults || '-'};${ranking.totalResults || '-'}\n`;
  });
  
  return csv;
}

function escapeCSV(str) {
  if (!str) return '';
  // Only quote if contains semicolon, quote, or newline
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function sanitizeFilename(str) {
  return str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function downloadCSV(csv, filename) {
  // Use UTF-8 BOM for better Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportJSON() {
  const { rankingHistory = [], watchedPlaylists = {}, starredKeywords = [] } = 
    await chrome.storage.local.get(['rankingHistory', 'watchedPlaylists', 'starredKeywords']);
  
  const data = {
    exportDate: new Date().toISOString(),
    watchedPlaylists,
    starredKeywords,
    rankings: rankingHistory
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spotify-rankings-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showNotification('Data exported as JSON');
}

async function syncToBackend() {
  const btn = document.getElementById('sync-btn');
  btn.disabled = true;
  btn.textContent = 'Syncing...';
  
  try {
    const { rankingHistory = [], tokens = {}, starredKeywords = [] } = 
      await chrome.storage.local.get(['rankingHistory', 'tokens', 'starredKeywords']);
    
    // Get backend URL from storage or use default
    const { backendUrl = 'https://your-backend.vercel.app' } = await chrome.storage.sync.get('backendUrl');
    
    const response = await fetch(`${backendUrl}/api/rankings/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.accessToken || ''}`
      },
      body: JSON.stringify({ 
        rankings: rankingHistory,
        starredKeywords: starredKeywords
      })
    });
    
    if (response.ok) {
      showNotification('Synced successfully!');
    } else {
      throw new Error('Sync failed');
    }
  } catch (error) {
    console.error('Sync error:', error);
    showNotification('Sync failed!', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sync to Backend';
  }
}

function showNotification(message, type = 'success') {
  // Simple console log for now, could implement toast notifications
  console.log(`[${type}] ${message}`);
}