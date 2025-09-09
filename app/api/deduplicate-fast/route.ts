import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export async function POST(request: Request) {
  try {
    const redis = await getRedisClient();
    
    console.log('[DEDUP-FAST] Starting fast deduplication...');
    
    // Get all playlist keys
    const playlistKeys = await redis.keys('playlist:*');
    let totalRemoved = 0;
    let totalProcessed = 0;
    
    for (const key of playlistKeys) {
      const data = await redis.hGet(key, 'data');
      if (!data) continue;
      
      const playlist = JSON.parse(data);
      const originalCount = playlist.keywords?.length || 0;
      if (originalCount === 0) continue;
      
      totalProcessed += originalCount;
      
      // Use a Map for O(1) lookups - key is minute+position+keyword+territory
      const uniqueMap = new Map();
      
      playlist.keywords.forEach((k: any) => {
        const d = new Date(k.timestamp);
        const minuteKey = `${k.keyword.toLowerCase()}-${k.territory}-${k.position}-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
        
        // Keep the latest timestamp for each minute key
        if (!uniqueMap.has(minuteKey) || new Date(k.timestamp) > new Date(uniqueMap.get(minuteKey).timestamp)) {
          uniqueMap.set(minuteKey, k);
        }
      });
      
      const deduped = Array.from(uniqueMap.values());
      const removed = originalCount - deduped.length;
      totalRemoved += removed;
      
      if (removed > 0) {
        // Sort by timestamp desc
        deduped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        playlist.keywords = deduped;
        playlist.lastUpdated = new Date().toISOString();
        
        await redis.hSet(key, 'data', JSON.stringify(playlist));
        console.log(`[DEDUP-FAST] ${key}: Removed ${removed} duplicates (${originalCount} → ${deduped.length})`);
      }
    }
    
    console.log(`[DEDUP-FAST] Complete! Processed ${totalProcessed} entries, removed ${totalRemoved} duplicates`);
    
    return NextResponse.json({
      success: true,
      message: `Removed ${totalRemoved} duplicates from ${totalProcessed} total entries`,
      reductionPercent: ((totalRemoved / totalProcessed) * 100).toFixed(1)
    });
    
  } catch (error) {
    console.error('[DEDUP-FAST] Error:', error);
    return NextResponse.json(
      { error: 'Deduplication failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}