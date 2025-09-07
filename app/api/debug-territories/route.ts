import { NextResponse } from 'next/server';
import { getAllPlaylists, getRedisClient } from '@/lib/redis';

export async function GET() {
  try {
    console.log('🔍 DEBUGGING: What territories are actually in the database...');
    
    const playlists = await getAllPlaylists();
    const redis = await getRedisClient();
    
    let totalKeywords = 0;
    let territoryDistribution: { [key: string]: number } = {};
    let unknownExamples: any[] = [];
    
    for (const playlist of playlists) {
      console.log(`\n📋 Playlist: ${playlist.name}`);
      console.log(`Keywords count: ${playlist.keywords.length}`);
      
      // Also check raw Redis data
      const rawData = await redis.hGet(`playlist:${playlist.id}`, 'data');
      const parsedRaw = rawData ? JSON.parse(rawData) : null;
      
      if (parsedRaw) {
        console.log(`Raw Redis keywords count: ${parsedRaw.keywords.length}`);
        
        parsedRaw.keywords.forEach((keyword: any, index: number) => {
          totalKeywords++;
          const territory = keyword.territory || 'NULL_VALUE';
          territoryDistribution[territory] = (territoryDistribution[territory] || 0) + 1;
          
          // Collect examples of problematic territories
          if (!keyword.territory || 
              keyword.territory === 'unknown' || 
              keyword.territory.includes('unknown') ||
              keyword.territory.trim() === '') {
            unknownExamples.push({
              playlistName: playlist.name,
              keyword: keyword.keyword,
              territory: keyword.territory,
              territoryType: typeof keyword.territory,
              territoryLength: keyword.territory ? keyword.territory.length : 'null',
              index: index,
              timestamp: keyword.timestamp
            });
          }
        });
      }
    }
    
    console.log('\n📊 TERRITORY DISTRIBUTION:');
    Object.entries(territoryDistribution).forEach(([territory, count]) => {
      console.log(`  ${territory}: ${count} keywords`);
    });
    
    console.log('\n❌ UNKNOWN EXAMPLES:');
    unknownExamples.slice(0, 10).forEach((example, i) => {
      console.log(`  ${i + 1}. "${example.keyword}" = "${example.territory}" (type: ${example.territoryType}, length: ${example.territoryLength})`);
    });
    
    // Test a direct Redis write to see if saves work
    console.log('\n🧪 Testing direct Redis write...');
    const testKey = 'test:territory-fix';
    await redis.set(testKey, JSON.stringify({ test: 'territory-fix-test', timestamp: Date.now() }));
    const testRead = await redis.get(testKey);
    console.log('Redis write test:', testRead ? 'SUCCESS' : 'FAILED');
    
    return NextResponse.json({
      success: true,
      debug: {
        totalKeywords,
        territoryDistribution,
        unknownCount: unknownExamples.length,
        unknownExamples: unknownExamples.slice(0, 20), // First 20 examples
        playlistCount: playlists.length,
        redisWriteTest: testRead ? 'SUCCESS' : 'FAILED'
      }
    });
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}