import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export async function GET() {
  try {
    console.log('🧹 DEDUPLICATE RANKINGS: Removing duplicate data points...');
    
    const redis = await getRedisClient();
    
    // Get all playlist keys
    const keys = await redis.keys('playlist:*');
    console.log(`Found ${keys.length} playlist keys in Redis`);
    
    let totalOriginalKeywords = 0;
    let totalDeduplicatedKeywords = 0;
    let totalDuplicatesRemoved = 0;
    
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
        console.log(`⚠️  No keywords array found for ${playlist.name}`);
        continue;
      }
      
      const originalCount = playlist.keywords.length;
      totalOriginalKeywords += originalCount;
      
      // Group keywords by unique identifier (keyword + territory + position + rounded timestamp)
      const keywordGroups: { [key: string]: any[] } = {};
      
      playlist.keywords.forEach((keyword: any) => {
        // Round timestamp to nearest 30 seconds to catch near-duplicates
        const timestamp = new Date(keyword.timestamp);
        const roundedTimestamp = new Date(Math.round(timestamp.getTime() / 30000) * 30000);
        
        // Create unique key: keyword + territory + position + rounded time
        const uniqueKey = `${keyword.keyword.toLowerCase().trim()}-${keyword.territory.toLowerCase()}-${keyword.position}-${roundedTimestamp.toISOString()}`;
        
        if (!keywordGroups[uniqueKey]) {
          keywordGroups[uniqueKey] = [];
        }
        keywordGroups[uniqueKey].push(keyword);
      });
      
      // For each group, keep only the most recent entry (by actual timestamp)
      const deduplicatedKeywords: any[] = [];
      let duplicatesInThisPlaylist = 0;
      
      Object.entries(keywordGroups).forEach(([uniqueKey, duplicates]) => {
        if (duplicates.length > 1) {
          console.log(`  🔍 Found ${duplicates.length} duplicates for: ${duplicates[0].keyword} #${duplicates[0].position}`);
          duplicatesInThisPlaylist += duplicates.length - 1; // All but one are duplicates
          
          // Sort by timestamp (most recent first) and keep the first one
          const sortedDuplicates = duplicates.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          
          // Keep the most recent one
          deduplicatedKeywords.push(sortedDuplicates[0]);
          
          console.log(`  ✂️  Removed ${duplicates.length - 1} duplicates, kept most recent: ${sortedDuplicates[0].timestamp}`);
        } else {
          // No duplicates, keep as is
          deduplicatedKeywords.push(duplicates[0]);
        }
      });
      
      console.log(`  📊 ${playlist.name}: ${originalCount} → ${deduplicatedKeywords.length} (removed ${duplicatesInThisPlaylist} duplicates)`);
      
      totalDuplicatesRemoved += duplicatesInThisPlaylist;
      totalDeduplicatedKeywords += deduplicatedKeywords.length;
      
      // Update playlist with deduplicated keywords
      const updatedPlaylist = {
        ...playlist,
        keywords: deduplicatedKeywords.sort((a: any, b: any) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
      };
      
      // Save back to Redis
      await redis.hSet(key, 'data', JSON.stringify(updatedPlaylist));
      console.log(`✅ Updated playlist: ${playlist.name}`);
    }
    
    console.log(`\n🎉 DEDUPLICATION COMPLETE!`);
    console.log(`📊 Stats:`);
    console.log(`- Original keywords: ${totalOriginalKeywords}`);
    console.log(`- After deduplication: ${totalDeduplicatedKeywords}`);
    console.log(`- Duplicates removed: ${totalDuplicatesRemoved}`);
    console.log(`- Space saved: ${((totalDuplicatesRemoved / totalOriginalKeywords) * 100).toFixed(1)}%`);
    
    return NextResponse.json({
      success: true,
      message: 'Ranking deduplication completed',
      stats: {
        originalKeywords: totalOriginalKeywords,
        deduplicatedKeywords: totalDeduplicatedKeywords,
        duplicatesRemoved: totalDuplicatesRemoved,
        spaceSavedPercentage: ((totalDuplicatesRemoved / totalOriginalKeywords) * 100).toFixed(1),
        playlistsProcessed: keys.length
      }
    });
    
  } catch (error) {
    console.error('❌ Ranking deduplication failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}