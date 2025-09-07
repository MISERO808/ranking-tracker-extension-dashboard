import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export async function GET() {
  try {
    console.log('⏱️ SAME-MINUTE DEDUPLICATION: Removing duplicates within same minute, keeping latest...');
    
    const redis = await getRedisClient();
    
    // Get all playlist keys
    const keys = await redis.keys('playlist:*');
    console.log(`Found ${keys.length} playlist keys in Redis`);
    
    let totalOriginalKeywords = 0;
    let totalAfterDeduplication = 0;
    let totalSameMinuteDuplicatesRemoved = 0;
    
    for (const key of keys) {
      const rawData = await redis.hGet(key, 'data');
      if (!rawData) continue;
      
      let playlist;
      try {
        playlist = JSON.parse(rawData);
      } catch (parseError) {
        console.error(`❌ Failed to parse data for ${key}:`, parseError);
        continue;
      }
      
      console.log(`\n📋 Processing ${playlist.name || 'Unknown Playlist'}: ${playlist.keywords?.length || 0} keywords`);
      
      if (!playlist.keywords || !Array.isArray(playlist.keywords)) {
        continue;
      }
      
      const originalCount = playlist.keywords.length;
      totalOriginalKeywords += originalCount;
      
      // Group keywords by keyword + territory + position + minute
      const minuteGroups = new Map<string, any[]>();
      
      playlist.keywords.forEach((keyword: any) => {
        // Round timestamp to the minute (remove seconds and milliseconds)
        const timestamp = new Date(keyword.timestamp);
        const minuteTimestamp = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), 
                                        timestamp.getHours(), timestamp.getMinutes(), 0, 0);
        
        // Create key for same keyword+territory+position within same minute
        const minuteKey = `${keyword.keyword.toLowerCase().trim()}-${keyword.territory.toLowerCase()}-${keyword.position}-${minuteTimestamp.toISOString()}`;
        
        if (!minuteGroups.has(minuteKey)) {
          minuteGroups.set(minuteKey, []);
        }
        minuteGroups.get(minuteKey)!.push(keyword);
      });
      
      // For each group, keep only the LATEST entry (highest timestamp)
      const uniqueKeywords: any[] = [];
      let duplicatesRemovedInThisPlaylist = 0;
      
      minuteGroups.forEach((duplicates, minuteKey) => {
        if (duplicates.length > 1) {
          console.log(`  ⏱️ SAME-MINUTE DUPLICATES found: "${duplicates[0].keyword}" #${duplicates[0].position}`);
          console.log(`     ${duplicates.length} entries within same minute:`);
          
          // Sort by timestamp (latest first) and keep the latest one
          const sortedDuplicates = duplicates.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          
          // Log all entries
          sortedDuplicates.forEach((dup, index) => {
            if (index === 0) {
              console.log(`     ✅ KEEPING (latest): ${dup.timestamp}`);
            } else {
              console.log(`     🗑️  REMOVING: ${dup.timestamp}`);
            }
          });
          
          // Keep only the latest (first after sorting)
          uniqueKeywords.push(sortedDuplicates[0]);
          duplicatesRemovedInThisPlaylist += duplicates.length - 1;
          totalSameMinuteDuplicatesRemoved += duplicates.length - 1;
        } else {
          // No duplicates within this minute, keep as is
          uniqueKeywords.push(duplicates[0]);
        }
      });
      
      console.log(`  📊 ${playlist.name}: ${originalCount} → ${uniqueKeywords.length} (removed ${duplicatesRemovedInThisPlaylist} same-minute duplicates)`);
      
      totalAfterDeduplication += uniqueKeywords.length;
      
      // Sort final keywords by timestamp (newest first)
      const sortedUniqueKeywords = uniqueKeywords.sort((a: any, b: any) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      // Update playlist with deduplicated keywords
      const updatedPlaylist = {
        ...playlist,
        keywords: sortedUniqueKeywords
      };
      
      // Save back to Redis
      await redis.hSet(key, 'data', JSON.stringify(updatedPlaylist));
      console.log(`✅ Updated playlist: ${playlist.name}`);
    }
    
    console.log(`\n🎉 SAME-MINUTE DEDUPLICATION COMPLETE!`);
    console.log(`📊 Stats:`);
    console.log(`- Original keywords: ${totalOriginalKeywords}`);
    console.log(`- After deduplication: ${totalAfterDeduplication}`);
    console.log(`- Same-minute duplicates removed: ${totalSameMinuteDuplicatesRemoved}`);
    console.log(`- Data cleaned: ${((totalSameMinuteDuplicatesRemoved / totalOriginalKeywords) * 100).toFixed(1)}%`);
    
    return NextResponse.json({
      success: true,
      message: 'Same-minute deduplication completed',
      stats: {
        originalKeywords: totalOriginalKeywords,
        afterDeduplication: totalAfterDeduplication,
        sameMinuteDuplicatesRemoved: totalSameMinuteDuplicatesRemoved,
        dataCleanedPercentage: ((totalSameMinuteDuplicatesRemoved / totalOriginalKeywords) * 100).toFixed(1),
        playlistsProcessed: keys.length
      }
    });
    
  } catch (error) {
    console.error('❌ Same-minute deduplication failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}