import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

// Add CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  
  if (secret !== process.env.MIGRATION_SECRET) {
    const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  return runMigration();
}

export async function POST(request: Request) {
  try {
    const { secret } = await request.json();
    
    // Simple security check - you can set this in your Vercel environment
    if (secret !== process.env.MIGRATION_SECRET) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    return runMigration();
}

async function runMigration() {
  try {

    const redis = await getRedisClient();
    
    console.log('🔄 Starting playlist data migration...');
    
    // Migrate playlist data
    const playlistKeys = await redis.keys('playlist:*');
    let migratedPlaylists = 0;
    let migratedKeywords = 0;
    
    for (const key of playlistKeys) {
      try {
        const playlistDataStr = await redis.hGet(key, 'data');
        if (!playlistDataStr) continue;
        
        const playlistData = JSON.parse(playlistDataStr);
        let hasChanges = false;
        
        // Update keywords to include userId if missing
        playlistData.keywords = playlistData.keywords.map((keyword: any) => {
          if (!keyword.userId) {
            keyword.userId = 'legacy-user';
            hasChanges = true;
          }
          if (!keyword.sessionId) {
            keyword.sessionId = 'legacy-session';
            hasChanges = true;
          }
          return keyword;
        });
        
        if (hasChanges) {
          await redis.hSet(key, 'data', JSON.stringify(playlistData));
          migratedPlaylists++;
          migratedKeywords += playlistData.keywords.length;
        }
      } catch (error) {
        console.error(`❌ Error migrating playlist ${key}:`, error);
      }
    }
    
    console.log('🔄 Starting history data migration...');
    
    // Migrate history data
    const historyKeys = await redis.keys('history:*');
    let migratedHistories = 0;
    let migratedEntries = 0;
    
    for (const key of historyKeys) {
      try {
        const historyEntries = await redis.lRange(key, 0, -1);
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
          await redis.del(key);
          if (updatedEntries.length > 0) {
            await redis.lPush(key, ...updatedEntries);
          }
          migratedHistories++;
          migratedEntries += updatedEntries.length;
        }
      } catch (error) {
        console.error(`❌ Error migrating history ${key}:`, error);
      }
    }
    
    const result = {
      success: true,
      migratedPlaylists,
      migratedKeywords,
      migratedHistories,
      migratedEntries
    };
    
    console.log('🎉 Migration completed:', result);
    
    const response = NextResponse.json(result);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    const response = NextResponse.json({ 
      error: 'Migration failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
    
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }
}