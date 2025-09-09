import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export async function GET() {
  try {
    const redis = await getRedisClient();
    
    // Get ALL keys in Redis
    const allKeys = await redis.keys('*');
    
    console.log('[DEBUG] Found keys:', allKeys);
    
    const data: any = {
      totalKeys: allKeys.length,
      keyTypes: {},
      playlists: [],
      keywordHistories: [],
      otherData: []
    };
    
    // Categorize keys
    for (const key of allKeys) {
      if (key.startsWith('playlist:')) {
        const playlistData = await redis.hGetAll(key);
        data.playlists.push({
          key,
          hasData: !!playlistData.data,
          hasDeletedKeywords: !!playlistData.deleted_keywords,
          fields: Object.keys(playlistData)
        });
        
        if (playlistData.data) {
          try {
            const parsed = JSON.parse(playlistData.data);
            data.playlists[data.playlists.length - 1].keywordCount = parsed.keywords?.length || 0;
            data.playlists[data.playlists.length - 1].name = parsed.name;
            // Show first few keywords
            if (parsed.keywords && parsed.keywords.length > 0) {
              data.playlists[data.playlists.length - 1].sampleKeywords = parsed.keywords.slice(0, 3).map((k: any) => k.keyword);
            }
          } catch (e) {
            console.error('Error parsing playlist data:', e);
          }
        }
      } else if (key.includes('keyword-history')) {
        const historyData = await redis.get(key);
        data.keywordHistories.push({
          key,
          size: historyData?.length || 0,
          sample: historyData ? JSON.parse(historyData).slice(0, 2) : null
        });
      } else {
        const value = await redis.get(key);
        data.otherData.push({
          key,
          type: await redis.type(key),
          size: value?.length || 0
        });
      }
    }
    
    return NextResponse.json(data, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Failed to debug', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}