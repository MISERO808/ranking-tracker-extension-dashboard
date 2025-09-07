import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export async function GET() {
  try {
    console.log('🧠 SMART DEDUPLICATION: Removing entries too close in time...');
    
    const redis = await getRedisClient();
    
    // Get all playlist keys
    const keys = await redis.keys('playlist:*');
    console.log(`Found ${keys.length} playlist keys in Redis`);
    
    let totalOriginalKeywords = 0;
    let totalAfterDeduplication = 0;
    let totalSmartDuplicatesRemoved = 0;
    
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
      
      // Sort by timestamp (newest first)
      const sortedKeywords = playlist.keywords.sort((a: any, b: any) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      // EXACT deduplication: remove entries with IDENTICAL timestamp, keyword, position, territory
      const uniqueKeywords: any[] = [];
      const seenExactEntries = new Set<string>();
      
      sortedKeywords.forEach((keyword: any) => {
        // Create EXACT signature including timestamp
        const exactSignature = `${keyword.keyword.toLowerCase().trim()}-${keyword.territory.toLowerCase()}-${keyword.position}-${keyword.timestamp}`;
        
        if (seenExactEntries.has(exactSignature)) {
          console.log(`  🎯 EXACT DUPLICATE FOUND: "${keyword.keyword}" #${keyword.position}`);
          console.log(`      Timestamp: ${keyword.timestamp}`);
          console.log(`      Territory: ${keyword.territory}`);
          console.log(`      Signature: ${exactSignature}`);
          
          totalSmartDuplicatesRemoved++;
        } else {
          // First time seeing this exact combination
          seenExactEntries.add(exactSignature);
          uniqueKeywords.push(keyword);
        }
      });
      
      console.log(`  📊 ${playlist.name}: ${originalCount} → ${uniqueKeywords.length} (removed ${originalCount - uniqueKeywords.length} near-duplicates)`);
      
      totalAfterDeduplication += uniqueKeywords.length;
      
      // Update playlist with deduplicated keywords
      const updatedPlaylist = {
        ...playlist,
        keywords: uniqueKeywords
      };
      
      // Save back to Redis
      await redis.hSet(key, 'data', JSON.stringify(updatedPlaylist));
      console.log(`✅ Updated playlist: ${playlist.name}`);
    }
    
    console.log(`\n🎉 SMART DEDUPLICATION COMPLETE!`);
    console.log(`📊 Stats:`);
    console.log(`- Original keywords: ${totalOriginalKeywords}`);
    console.log(`- After smart deduplication: ${totalAfterDeduplication}`);
    console.log(`- Near-duplicates removed: ${totalSmartDuplicatesRemoved}`);
    console.log(`- Data cleaned: ${((totalSmartDuplicatesRemoved / totalOriginalKeywords) * 100).toFixed(1)}%`);
    
    return NextResponse.json({
      success: true,
      message: 'Smart deduplication completed',
      stats: {
        originalKeywords: totalOriginalKeywords,
        afterDeduplication: totalAfterDeduplication,
        nearDuplicatesRemoved: totalSmartDuplicatesRemoved,
        dataCleanedPercentage: ((totalSmartDuplicatesRemoved / totalOriginalKeywords) * 100).toFixed(1),
        playlistsProcessed: keys.length
      }
    });
    
  } catch (error) {
    console.error('❌ Smart deduplication failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}