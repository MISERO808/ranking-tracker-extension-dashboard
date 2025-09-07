import { NextResponse } from 'next/server';
import { getAllPlaylists, savePlaylistData } from '@/lib/redis';

// Add CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function GET() {
  try {
    console.log('🔧 Starting DEEP territory fix...');
    
    const playlists = await getAllPlaylists();
    console.log(`Found ${playlists.length} playlists to fix`);
    
    let totalFixed = 0;
    let totalKeywords = 0;
    
    for (const playlist of playlists) {
      console.log(`\n📋 Processing playlist: ${playlist.name}`);
      console.log(`Original keywords: ${playlist.keywords.length}`);
      
      // Fix ALL territory variations
      const fixedKeywords = playlist.keywords.map(keyword => {
        totalKeywords++;
        const originalTerritory = keyword.territory;
        
        // Fix all possible "unknown" variations
        if (!keyword.territory || 
            keyword.territory === 'unknown' || 
            keyword.territory === 'Unknown' || 
            keyword.territory === 'UNKNOWN' ||
            keyword.territory.trim() === '' ||
            keyword.territory === null ||
            keyword.territory === undefined) {
          
          console.log(`  🔄 Fixing: "${keyword.keyword}" from "${originalTerritory}" to "de"`);
          totalFixed++;
          
          return {
            ...keyword,
            territory: 'de'
          };
        }
        
        // Also normalize existing territories to lowercase
        return {
          ...keyword,
          territory: keyword.territory.toLowerCase()
        };
      });
      
      // Always update the playlist to ensure normalization
      const updatedPlaylist = {
        ...playlist,
        keywords: fixedKeywords
      };
      
      await savePlaylistData(playlist.id, updatedPlaylist);
      console.log(`✅ Updated playlist: ${playlist.name}`);
      
      // Debug: Show territory distribution after fix
      const territoryCount = fixedKeywords.reduce((acc, k) => {
        const territory = k.territory || 'undefined';
        acc[territory] = (acc[territory] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number });
      
      console.log(`Territory distribution:`, territoryCount);
    }
    
    console.log(`\n🎉 DEEP territory fix complete!`);
    console.log(`📊 Stats:`);
    console.log(`- Total keywords processed: ${totalKeywords}`);
    console.log(`- Territories fixed: ${totalFixed}`);
    console.log(`- Playlists updated: ${playlists.length}`);
    
    const response = NextResponse.json({
      success: true,
      message: 'DEEP territory fix completed',
      stats: {
        playlistsProcessed: playlists.length,
        totalKeywords: totalKeywords,
        territoriesFixed: totalFixed
      }
    });
    
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
    
  } catch (error) {
    console.error('❌ DEEP territory fix failed:', error);
    const response = NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
    
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }
}