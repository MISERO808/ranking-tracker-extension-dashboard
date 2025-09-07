// Migration script to add user ID to existing Redis data
const { createClient } = require('redis');

class UserIdMigration {
  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || process.env.KV_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD || undefined,
      socket: {
        tls: process.env.REDIS_URL?.startsWith('rediss://') || process.env.KV_URL?.startsWith('rediss://'),
      },
    });
  }

  async connect() {
    await this.client.connect();
    console.log('✅ Connected to Redis');
  }

  async migratePlaylistData() {
    console.log('🔄 Starting playlist data migration...');
    
    const playlistKeys = await this.client.keys('playlist:*');
    let migratedPlaylists = 0;
    let migratedKeywords = 0;
    
    for (const key of playlistKeys) {
      try {
        const playlistDataStr = await this.client.hGet(key, 'data');
        if (!playlistDataStr) continue;
        
        const playlistData = JSON.parse(playlistDataStr);
        let hasChanges = false;
        
        // Update keywords to include userId if missing
        playlistData.keywords = playlistData.keywords.map(keyword => {
          if (!keyword.userId) {
            keyword.userId = 'legacy-user'; // Mark as legacy data
            hasChanges = true;
          }
          if (!keyword.sessionId) {
            keyword.sessionId = 'legacy-session'; // Mark as legacy data
            hasChanges = true;
          }
          return keyword;
        });
        
        if (hasChanges) {
          await this.client.hSet(key, 'data', JSON.stringify(playlistData));
          migratedPlaylists++;
          migratedKeywords += playlistData.keywords.length;
        }
      } catch (error) {
        console.error(`❌ Error migrating playlist ${key}:`, error);
      }
    }
    
    console.log(`✅ Migrated ${migratedPlaylists} playlists with ${migratedKeywords} keywords`);
  }

  async migrateHistoryData() {
    console.log('🔄 Starting history data migration...');
    
    const historyKeys = await this.client.keys('history:*');
    let migratedHistories = 0;
    let migratedEntries = 0;
    
    for (const key of historyKeys) {
      try {
        const historyEntries = await this.client.lRange(key, 0, -1);
        const updatedEntries = [];
        let hasChanges = false;
        
        for (const entryStr of historyEntries) {
          const entry = JSON.parse(entryStr);
          
          if (!entry.userId) {
            entry.userId = 'legacy-user';
            hasChanges = true;
          }
          if (!entry.sessionId) {
            entry.sessionId = 'legacy-session';
            hasChanges = true;
          }
          
          updatedEntries.push(JSON.stringify(entry));
        }
        
        if (hasChanges) {
          // Clear old data and insert updated data
          await this.client.del(key);
          if (updatedEntries.length > 0) {
            await this.client.lPush(key, ...updatedEntries);
          }
          migratedHistories++;
          migratedEntries += updatedEntries.length;
        }
      } catch (error) {
        console.error(`❌ Error migrating history ${key}:`, error);
      }
    }
    
    console.log(`✅ Migrated ${migratedHistories} keyword histories with ${migratedEntries} entries`);
  }

  async run() {
    try {
      await this.connect();
      await this.migratePlaylistData();
      await this.migrateHistoryData();
      console.log('🎉 Migration completed successfully!');
    } catch (error) {
      console.error('❌ Migration failed:', error);
    } finally {
      await this.client.quit();
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new UserIdMigration();
  migration.run();
}

module.exports = UserIdMigration;