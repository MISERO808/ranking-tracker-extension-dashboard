import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export async function GET() {
  try {
    console.log('🔧 NORMALIZE TERRITORIES: Fixing mixed case territory data...');
    
    const redis = await getRedisClient();
    
    // Get all playlist keys
    const keys = await redis.keys('playlist:*');
    console.log(`Found ${keys.length} playlist keys in Redis`);
    
    let totalProcessed = 0;
    let totalNormalized = 0;
    let territoryStats: { [key: string]: number } = {};
    
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
      
      let normalizedInThisPlaylist = 0;
      
      // Normalize all territories to lowercase
      const normalizedKeywords = playlist.keywords.map((keyword: any) => {
        totalProcessed++;
        const originalTerritory = keyword.territory;
        
        if (!originalTerritory) {
          console.log(`  ⚠️  Keyword "${keyword.keyword}" has no territory, setting to 'de'`);
          normalizedInThisPlaylist++;
          totalNormalized++;
          
          // Count in stats
          territoryStats['de'] = (territoryStats['de'] || 0) + 1;
          
          return {
            ...keyword,
            territory: 'de'
          };
        }
        
        const normalizedTerritory = originalTerritory.toLowerCase();
        
        // Count in stats
        territoryStats[normalizedTerritory] = (territoryStats[normalizedTerritory] || 0) + 1;
        
        if (originalTerritory !== normalizedTerritory) {
          console.log(`  🔄 Normalizing: "${keyword.keyword}" from "${originalTerritory}" to "${normalizedTerritory}"`);
          normalizedInThisPlaylist++;
          totalNormalized++;
          
          return {
            ...keyword,
            territory: normalizedTerritory
          };
        }
        
        return keyword;
      });
      
      // Update playlist with normalized territories
      const updatedPlaylist = {
        ...playlist,
        keywords: normalizedKeywords
      };
      
      // SAME-MINUTE DEDUPLICATION - Remove duplicates within same minute, keep latest
      const minuteGroups = new Map<string, any[]>();
      
      normalizedKeywords.forEach((keyword: any) => {
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
      let duplicatesRemoved = 0;
      
      minuteGroups.forEach((duplicates, minuteKey) => {
        if (duplicates.length > 1) {
          console.log(`  ⏱️ SAME-MINUTE DUPLICATES: "${duplicates[0].keyword}" #${duplicates[0].position}`);
          console.log(`     ${duplicates.length} entries within same minute`);
          
          // Sort by timestamp (latest first) and keep the latest one
          const sortedDuplicates = duplicates.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          
          // Keep only the latest (first after sorting)
          uniqueKeywords.push(sortedDuplicates[0]);
          duplicatesRemoved += duplicates.length - 1;
          console.log(`     ✅ Kept latest: ${sortedDuplicates[0].timestamp}`);
          console.log(`     🗑️ Removed ${duplicates.length - 1} earlier entries`);
        } else {
          // No duplicates within this minute, keep as is
          uniqueKeywords.push(duplicates[0]);
        }
      });
      
      console.log(`  🧹 Removed ${duplicatesRemoved} exact timestamp duplicates`);
      
      const finalPlaylist = {
        ...playlist,
        keywords: uniqueKeywords
      };
      
      // Save back to Redis
      await redis.hSet(key, 'data', JSON.stringify(finalPlaylist));
      console.log(`✅ Updated playlist: ${playlist.name} (${normalizedInThisPlaylist} territories normalized, ${duplicatesRemoved} duplicates removed)`);
    }
    
    console.log(`\n🎉 TERRITORY NORMALIZATION COMPLETE!`);
    console.log(`📊 Stats:`);
    console.log(`- Total keywords processed: ${totalProcessed}`);
    console.log(`- Territories normalized: ${totalNormalized}`);
    console.log(`- Territory distribution:`, territoryStats);
    
    return NextResponse.json({
      success: true,
      message: 'Territory normalization completed',
      stats: {
        totalProcessed,
        totalNormalized,
        territoryDistribution: territoryStats,
        playlistsProcessed: keys.length
      }
    });
    
  } catch (error) {
    console.error('❌ Territory normalization failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}