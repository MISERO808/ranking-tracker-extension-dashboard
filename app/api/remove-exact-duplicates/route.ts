import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export async function GET() {
  try {
    console.log('🔍 EXACT DUPLICATE REMOVAL: Finding and removing identical entries...');
    
    const redis = await getRedisClient();
    
    // Get all playlist keys
    const keys = await redis.keys('playlist:*');
    console.log(`Found ${keys.length} playlist keys in Redis`);
    
    let totalOriginalKeywords = 0;
    let totalAfterRemoval = 0;
    let totalExactDuplicatesRemoved = 0;
    
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
      
      // Create signature for each keyword to identify exact duplicates
      const keywordSignatures = new Map<string, any[]>();
      
      playlist.keywords.forEach((keyword: any) => {
        // Create exact signature using ALL relevant fields
        const signature = JSON.stringify({
          keyword: keyword.keyword.toLowerCase().trim(),
          position: keyword.position,
          territory: keyword.territory.toLowerCase(),
          timestamp: keyword.timestamp,
          playlistId: keyword.playlistId || playlist.id,
          userId: keyword.userId,
          sessionId: keyword.sessionId
        });
        
        if (!keywordSignatures.has(signature)) {
          keywordSignatures.set(signature, []);
        }
        keywordSignatures.get(signature)!.push(keyword);
      });
      
      // Find and log exact duplicates
      let exactDuplicatesInPlaylist = 0;
      const uniqueKeywords: any[] = [];
      
      keywordSignatures.forEach((duplicates, signature) => {
        if (duplicates.length > 1) {
          console.log(`  🎯 EXACT DUPLICATE found: "${duplicates[0].keyword}" #${duplicates[0].position} at ${duplicates[0].timestamp}`);
          console.log(`    - Found ${duplicates.length} identical copies`);
          
          // Show the exact duplicate entries
          duplicates.forEach((dup, index) => {
            console.log(`    [${index + 1}] ID: ${dup.id || 'no-id'} | Time: ${dup.timestamp}`);
          });
          
          exactDuplicatesInPlaylist += duplicates.length - 1;
          
          // Keep only the first one (arbitrary choice since they're identical)
          uniqueKeywords.push(duplicates[0]);
          console.log(`    ✂️ Kept 1, removed ${duplicates.length - 1} exact duplicates`);
        } else {
          // No duplicates, keep the single entry
          uniqueKeywords.push(duplicates[0]);
        }
      });
      
      console.log(`  📊 ${playlist.name}: ${originalCount} → ${uniqueKeywords.length} (removed ${exactDuplicatesInPlaylist} exact duplicates)`);
      
      totalExactDuplicatesRemoved += exactDuplicatesInPlaylist;
      totalAfterRemoval += uniqueKeywords.length;
      
      // Update playlist with deduplicated keywords
      const updatedPlaylist = {
        ...playlist,
        keywords: uniqueKeywords.sort((a: any, b: any) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
      };
      
      // Save back to Redis
      await redis.hSet(key, 'data', JSON.stringify(updatedPlaylist));
      console.log(`✅ Updated playlist: ${playlist.name}`);
    }
    
    console.log(`\n🎉 EXACT DUPLICATE REMOVAL COMPLETE!`);
    console.log(`📊 Stats:`);
    console.log(`- Original keywords: ${totalOriginalKeywords}`);
    console.log(`- After exact duplicate removal: ${totalAfterRemoval}`);
    console.log(`- Exact duplicates removed: ${totalExactDuplicatesRemoved}`);
    console.log(`- Data cleaned: ${((totalExactDuplicatesRemoved / totalOriginalKeywords) * 100).toFixed(1)}%`);
    
    return NextResponse.json({
      success: true,
      message: 'Exact duplicate removal completed',
      stats: {
        originalKeywords: totalOriginalKeywords,
        afterRemoval: totalAfterRemoval,
        exactDuplicatesRemoved: totalExactDuplicatesRemoved,
        dataCleanedPercentage: ((totalExactDuplicatesRemoved / totalOriginalKeywords) * 100).toFixed(1),
        playlistsProcessed: keys.length
      }
    });
    
  } catch (error) {
    console.error('❌ Exact duplicate removal failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}