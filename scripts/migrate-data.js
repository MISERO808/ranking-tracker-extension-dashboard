// Migration script to transfer Chrome extension data to Redis dashboard
// This script reads extension data from Chrome storage and sends it to the dashboard API

class DataMigrator {
  constructor() {
    this.dashboardUrl = 'https://ranking-tracker-extension-dashboard.vercel.app';
    this.migrationStats = {
      playlists: 0,
      rankings: 0,
      errors: 0
    };
  }

  async migrate() {
    console.log('🚀 Starting data migration...');
    
    try {
      // Get all data from Chrome storage
      const data = await this.getChromeStorageData();
      
      if (!data) {
        console.log('❌ No extension data found');
        return;
      }

      console.log('📊 Found extension data:');
      console.log(`- ${Object.keys(data.watchedPlaylists || {}).length} playlists`);
      console.log(`- ${(data.rankingHistory || []).length} rankings`);
      console.log(`- ${(data.starredKeywords || []).length} starred keywords`);

      // Transform and migrate data
      await this.migratePlaylistData(data);
      
      console.log('✅ Migration completed!');
      console.log(`📈 Stats: ${this.migrationStats.playlists} playlists, ${this.migrationStats.rankings} rankings, ${this.migrationStats.errors} errors`);
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
    }
  }

  async getChromeStorageData() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        // Running in extension context
        chrome.storage.local.get(['rankingHistory', 'watchedPlaylists', 'starredKeywords'], resolve);
      } else {
        // Running outside extension - show instructions
        console.log('⚠️  This script must be run in the browser extension context');
        console.log('📋 Instructions:');
        console.log('1. Open your browser');
        console.log('2. Go to chrome://extensions/');
        console.log('3. Find "Spotify Playlist Ranking Tracker"');
        console.log('4. Click "Inspect views: service worker" or "background page"');
        console.log('5. In the DevTools console, paste this entire script');
        console.log('6. Run: new DataMigrator().migrate()');
        resolve(null);
      }
    });
  }

  async migratePlaylistData(extensionData) {
    const { rankingHistory = [], watchedPlaylists = {} } = extensionData;
    
    // Group rankings by playlist
    const playlistGroups = {};
    
    rankingHistory.forEach(ranking => {
      const playlistId = ranking.playlistId;
      if (!playlistGroups[playlistId]) {
        playlistGroups[playlistId] = {
          rankings: [],
          playlistInfo: watchedPlaylists[playlistId] || null
        };
      }
      playlistGroups[playlistId].rankings.push(ranking);
    });

    // Migrate each playlist
    for (const [playlistId, group] of Object.entries(playlistGroups)) {
      try {
        await this.migratePlaylist(playlistId, group);
        this.migrationStats.playlists++;
      } catch (error) {
        console.error(`❌ Failed to migrate playlist ${playlistId}:`, error);
        this.migrationStats.errors++;
      }
    }
  }

  async migratePlaylist(playlistId, group) {
    const { rankings, playlistInfo } = group;
    
    // Transform rankings to dashboard format
    const keywordRankings = this.transformRankings(rankings);
    
    // Create playlist data in dashboard format
    const playlistData = {
      id: playlistId,
      name: playlistInfo?.name || `Playlist ${playlistId.substring(0, 8)}...`,
      image: null, // Extension doesn't store images
      keywords: keywordRankings,
      lastUpdated: rankings.length > 0 
        ? new Date(Math.max(...rankings.map(r => new Date(r.timestamp)))).toISOString()
        : new Date().toISOString()
    };

    console.log(`📤 Migrating playlist: ${playlistData.name} (${keywordRankings.length} keywords)`);

    // Send to dashboard API
    const response = await fetch(`${this.dashboardUrl}/api/playlists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(playlistData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Migrate keyword history for trending analysis
    await this.migrateKeywordHistory(playlistId, rankings);
    
    this.migrationStats.rankings += rankings.length;
  }

  transformRankings(rankings) {
    // Preserve ALL historical rankings instead of just the latest
    return rankings.map(ranking => {
      // Fix unknown territories to DE
      const territory = (ranking.territory === 'unknown' || !ranking.territory) ? 'DE' : ranking.territory;
      
      return {
        keyword: ranking.keyword,
        position: ranking.position,
        territory: territory.toLowerCase(),
        timestamp: ranking.timestamp,
        trend: this.calculateTrend(rankings, ranking.keyword, territory),
        userId: ranking.userId || 'migrated-user',
        sessionId: ranking.sessionId || 'migration-session'
      };
    });
  }

  calculateTrend(rankings, keyword, territory) {
    // Get all rankings for this keyword+territory, sorted by time
    // Also fix unknown territories to DE for trend calculation
    const keywordRankings = rankings
      .map(r => ({
        ...r,
        territory: (r.territory === 'unknown' || !r.territory) ? 'DE' : r.territory
      }))
      .filter(r => r.keyword === keyword && r.territory === territory)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (keywordRankings.length < 2) return 'stable';

    const latest = keywordRankings[keywordRankings.length - 1];
    const previous = keywordRankings[keywordRankings.length - 2];

    if (latest.position < previous.position) return 'up';
    if (latest.position > previous.position) return 'down';
    return 'stable';
  }

  async migrateKeywordHistory(playlistId, rankings) {
    // Group by keyword+territory and create history entries
    const historyGroups = new Map();
    
    rankings.forEach(ranking => {
      const key = `${ranking.keyword}-${ranking.territory}`;
      if (!historyGroups.has(key)) {
        historyGroups.set(key, []);
      }
      historyGroups.get(key).push({
        position: ranking.position,
        timestamp: ranking.timestamp
      });
    });

    // Send each history to the API (this would normally be done via Redis directly)
    // For now, we'll store them when the extension sends new data
    console.log(`📈 Would migrate ${historyGroups.size} keyword histories for trending analysis`);
  }
}

// Usage instructions
console.log(`
🎯 Spotify Ranking Tracker - Data Migration Script
=================================================

To migrate your extension data to the dashboard:

1. Copy this entire script
2. Open Chrome DevTools in your extension (chrome://extensions/ > inspect service worker)
3. Paste the script in the console
4. Run: new DataMigrator().migrate()

The script will transfer all your playlist rankings to: 
${new DataMigrator().dashboardUrl}
`);

// Auto-run if in extension context
if (typeof chrome !== 'undefined' && chrome.storage) {
  console.log('🔄 Extension context detected - you can run: new DataMigrator().migrate()');
}