import { NextResponse } from 'next/server';
import { getRedisClient, getPlaylistData, savePlaylistData } from '@/lib/redis';

export async function POST(request: Request) {
  try {
    const redis = await getRedisClient();
    
    console.log('[RECOVERY] Starting data recovery process...');
    
    // Get all history keys
    const historyKeys = await redis.keys('history:*');
    console.log(`[RECOVERY] Found ${historyKeys.length} history keys`);
    
    if (historyKeys.length === 0) {
      return NextResponse.json({ 
        error: 'No history data found to recover',
        keysChecked: 0
      }, { status: 404 });
    }
    
    // Group by playlist
    const playlistHistories: { [playlistId: string]: any[] } = {};
    
    for (const historyKey of historyKeys) {
      // Parse key format: history:playlistId:keyword:territory
      const parts = historyKey.split(':');
      if (parts.length < 4) continue;
      
      const playlistId = parts[1];
      const keyword = parts.slice(2, -1).join(':'); // Handle keywords with colons
      const territory = parts[parts.length - 1];
      
      // Get history data
      const historyData = await redis.lRange(historyKey, 0, -1);
      
      if (!playlistHistories[playlistId]) {
        playlistHistories[playlistId] = [];
      }
      
      // Add each history entry as a keyword ranking
      for (const entry of historyData) {
        try {
          const parsed = JSON.parse(entry);
          playlistHistories[playlistId].push({
            keyword,
            territory: territory.toLowerCase(),
            position: parsed.position,
            timestamp: parsed.timestamp,
            userId: parsed.userId,
            sessionId: parsed.sessionId
          });
        } catch (e) {
          console.error(`[RECOVERY] Error parsing history entry: ${e}`);
        }
      }
    }
    
    // Now rebuild playlist data
    const recoveredPlaylists: string[] = [];
    
    for (const [playlistId, keywords] of Object.entries(playlistHistories)) {
      console.log(`[RECOVERY] Recovering playlist ${playlistId} with ${keywords.length} keyword entries`);
      
      // Get existing playlist data to preserve name and image
      const existingData = await getPlaylistData(playlistId);
      
      // Create recovered playlist data
      const recoveredData = {
        id: playlistId,
        name: existingData?.name || `Recovered Playlist ${playlistId}`,
        image: existingData?.image || '',
        keywords: keywords.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ),
        lastUpdated: new Date().toISOString()
      };
      
      // Clear any deleted keywords flag
      await redis.hDel(`playlist:${playlistId}`, 'deleted_keywords');
      
      // Save recovered data
      await savePlaylistData(playlistId, recoveredData);
      recoveredPlaylists.push(playlistId);
      
      console.log(`[RECOVERY] Successfully recovered playlist ${playlistId}`);
    }
    
    return NextResponse.json({ 
      success: true,
      message: `Successfully recovered ${recoveredPlaylists.length} playlists`,
      recoveredPlaylists,
      totalKeywords: Object.values(playlistHistories).flat().length,
      historyKeysProcessed: historyKeys.length
    });
    
  } catch (error) {
    console.error('[RECOVERY] Recovery error:', error);
    return NextResponse.json(
      { 
        error: 'Recovery failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}