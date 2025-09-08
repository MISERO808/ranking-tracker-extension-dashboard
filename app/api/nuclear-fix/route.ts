import { NextResponse } from 'next/server';
import { getAllPlaylists, savePlaylistData } from '@/lib/redis';

export async function GET() {
  try {
    console.log('☢️ NUCLEAR FIX INITIATED - COMPLETE TERRITORY CLEANUP');
    
    const playlists = await getAllPlaylists();
    let totalFixed = 0;
    let totalRemoved = 0;
    const report: any[] = [];
    
    for (const playlist of playlists) {
      const originalCount = playlist.keywords.length;
      console.log(`\nProcessing playlist: ${playlist.name}`);
      console.log(`Original keyword count: ${originalCount}`);
      
      // Create a map to deduplicate by keyword-territory-position-timestamp
      const uniqueMap = new Map<string, any>();
      
      for (const keyword of playlist.keywords) {
        // Skip completely invalid entries
        if (!keyword.territory || 
            keyword.territory === 'Unknown' || 
            keyword.territory === 'unknown' ||
            keyword.territory === 'UNKNOWN' ||
            keyword.territory.length !== 2) {
          console.log(`  ❌ Removing invalid territory: "${keyword.territory}" for "${keyword.keyword}"`);
          totalRemoved++;
          continue;
        }
        
        // Normalize territory to lowercase
        const normalizedTerritory = keyword.territory.toLowerCase().trim();
        
        // Create unique key for deduplication
        const uniqueKey = `${keyword.keyword.toLowerCase()}-${normalizedTerritory}-${keyword.position}-${keyword.timestamp}`;
        
        // Store with normalized territory
        if (!uniqueMap.has(uniqueKey)) {
          uniqueMap.set(uniqueKey, {
            ...keyword,
            territory: normalizedTerritory  // FORCE lowercase
          });
          totalFixed++;
        } else {
          console.log(`  🔄 Duplicate found and removed: ${keyword.keyword} in ${keyword.territory}`);
          totalRemoved++;
        }
      }
      
      // Get the cleaned keywords
      const cleanedKeywords = Array.from(uniqueMap.values());
      
      // Sort by timestamp for consistency
      cleanedKeywords.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      // Update the playlist with cleaned data
      playlist.keywords = cleanedKeywords;
      await savePlaylistData(playlist.id, playlist);
      
      const finalCount = cleanedKeywords.length;
      report.push({
        playlistId: playlist.id,
        playlistName: playlist.name,
        originalCount,
        finalCount,
        removed: originalCount - finalCount,
        territoryDistribution: cleanedKeywords.reduce((acc, k) => {
          acc[k.territory] = (acc[k.territory] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });
      
      console.log(`✅ Playlist cleaned: ${originalCount} → ${finalCount} keywords`);
    }
    
    console.log('\n🏁 NUCLEAR FIX COMPLETE');
    console.log(`Total processed: ${totalFixed + totalRemoved}`);
    console.log(`Total fixed: ${totalFixed}`);
    console.log(`Total removed: ${totalRemoved}`);
    
    return NextResponse.json({
      success: true,
      message: 'NUCLEAR FIX COMPLETE - All territories normalized, all invalids removed',
      totalFixed,
      totalRemoved,
      report
    });
    
  } catch (error) {
    console.error('NUCLEAR FIX FAILED:', error);
    return NextResponse.json({
      error: 'Nuclear fix failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}