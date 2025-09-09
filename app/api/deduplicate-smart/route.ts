import { NextResponse } from 'next/server';
import { getRedisClient, getAllPlaylists, savePlaylistData } from '@/lib/redis';

export async function POST(request: Request) {
  try {
    const redis = await getRedisClient();
    
    console.log('[DEDUP] Starting smart deduplication process...');
    
    const playlists = await getAllPlaylists();
    const stats = {
      totalProcessed: 0,
      totalRemoved: 0,
      playlistStats: [] as any[]
    };
    
    for (const playlist of playlists) {
      console.log(`[DEDUP] Processing playlist: ${playlist.name} (${playlist.id})`);
      
      const originalCount = playlist.keywords.length;
      const keywordGroups: { [key: string]: any[] } = {};
      
      // Group by keyword-territory-minute
      playlist.keywords.forEach((entry: any) => {
        const date = new Date(entry.timestamp);
        // Round to minute for grouping
        const minuteKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}`;
        const groupKey = `${entry.keyword.toLowerCase()}-${entry.territory}-${minuteKey}-${entry.position}`;
        
        if (!keywordGroups[groupKey]) {
          keywordGroups[groupKey] = [];
        }
        keywordGroups[groupKey].push(entry);
      });
      
      // Keep only the latest entry per group (same keyword, territory, minute, position)
      const dedupedKeywords: any[] = [];
      let duplicatesRemoved = 0;
      
      Object.values(keywordGroups).forEach(group => {
        if (group.length > 1) {
          // Sort by timestamp (latest first)
          group.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          
          // Log what we're removing
          console.log(`[DEDUP] Found ${group.length} duplicates for ${group[0].keyword} at position ${group[0].position} in ${group[0].territory}`);
          console.log(`[DEDUP]   Keeping: ${group[0].timestamp}`);
          group.slice(1).forEach(dup => {
            console.log(`[DEDUP]   Removing: ${dup.timestamp}`);
          });
          
          duplicatesRemoved += group.length - 1;
        }
        // Keep only the latest (first after sort)
        dedupedKeywords.push(group[0]);
      });
      
      // Sort by timestamp (newest first) for display
      dedupedKeywords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Update playlist with deduplicated data
      const updatedPlaylist = {
        ...playlist,
        keywords: dedupedKeywords,
        lastUpdated: new Date().toISOString()
      };
      
      await savePlaylistData(playlist.id, updatedPlaylist);
      
      const playlistStat = {
        playlistId: playlist.id,
        playlistName: playlist.name,
        originalCount,
        newCount: dedupedKeywords.length,
        duplicatesRemoved,
        reductionPercent: ((duplicatesRemoved / originalCount) * 100).toFixed(1)
      };
      
      stats.playlistStats.push(playlistStat);
      stats.totalProcessed += originalCount;
      stats.totalRemoved += duplicatesRemoved;
      
      console.log(`[DEDUP] Playlist ${playlist.name}: ${originalCount} → ${dedupedKeywords.length} (removed ${duplicatesRemoved} duplicates)`);
    }
    
    // Also deduplicate keyword history
    const historyKeys = await redis.keys('history:*');
    let historyDeduped = 0;
    
    for (const historyKey of historyKeys) {
      const historyData = await redis.lRange(historyKey, 0, -1);
      const uniqueEntries = new Map();
      
      // Group by minute and position
      historyData.forEach((entry: string) => {
        try {
          const parsed = JSON.parse(entry);
          const date = new Date(parsed.timestamp);
          const minuteKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}`;
          const key = `${minuteKey}-${parsed.position}`;
          
          // Keep the latest entry for each minute-position combination
          if (!uniqueEntries.has(key) || new Date(parsed.timestamp) > new Date(JSON.parse(uniqueEntries.get(key)).timestamp)) {
            uniqueEntries.set(key, entry);
          }
        } catch (e) {
          console.error('[DEDUP] Error parsing history entry:', e);
        }
      });
      
      if (uniqueEntries.size < historyData.length) {
        // Clear and repopulate with deduplicated data
        await redis.del(historyKey);
        const sortedEntries = Array.from(uniqueEntries.values()).sort((a, b) => {
          const timeA = new Date(JSON.parse(a).timestamp).getTime();
          const timeB = new Date(JSON.parse(b).timestamp).getTime();
          return timeB - timeA; // Newest first
        });
        
        for (const entry of sortedEntries) {
          await redis.rPush(historyKey, entry);
        }
        
        historyDeduped += historyData.length - uniqueEntries.size;
        console.log(`[DEDUP] History ${historyKey}: ${historyData.length} → ${uniqueEntries.size}`);
      }
    }
    
    stats.totalRemoved += historyDeduped;
    
    console.log(`[DEDUP] Complete! Removed ${stats.totalRemoved} total duplicates`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully removed ${stats.totalRemoved} duplicate entries`,
      stats,
      historyDuplicatesRemoved: historyDeduped
    });
    
  } catch (error) {
    console.error('[DEDUP] Error:', error);
    return NextResponse.json(
      { error: 'Deduplication failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}