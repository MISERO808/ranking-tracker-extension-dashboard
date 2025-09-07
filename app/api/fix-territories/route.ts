import { NextResponse } from 'next/server';
import { getAllPlaylists, savePlaylistData, saveKeywordHistory } from '@/lib/redis';

// Add CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function GET() {
  try {
    console.log('GET /api/fix-territories - Starting territory fix...');
    
    const playlists = await getAllPlaylists();
    console.log(`Found ${playlists.length} playlists to fix`);
    
    let totalFixed = 0;
    
    for (const playlist of playlists) {
      console.log(`Processing playlist: ${playlist.name}`);
      
      // Fix territories
      const fixedKeywords = playlist.keywords.map(keyword => ({
        ...keyword,
        territory: keyword.territory === 'unknown' ? 'de' : keyword.territory
      }));
      
      const fixedCount = fixedKeywords.filter(k => k.territory === 'de' && playlist.keywords.find(orig => orig.territory === 'unknown' && orig.keyword === k.keyword)).length;
      
      if (fixedCount > 0) {
        // Update playlist with fixed territories
        const updatedPlaylist = {
          ...playlist,
          keywords: fixedKeywords
        };
        
        await savePlaylistData(playlist.id, updatedPlaylist);
        totalFixed += fixedCount;
        console.log(`Fixed ${playlist.name}: ${fixedCount} territories updated`);
      }
    }
    
    console.log(`Territory fix complete: ${totalFixed} territories fixed`);
    
    const response = NextResponse.json({
      success: true,
      message: 'Territory fix completed via GET',
      stats: {
        playlistsProcessed: playlists.length,
        territoriesFixed: totalFixed
      }
    });
    
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
    
  } catch (error) {
    console.error('Territory fix failed:', error);
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

export async function POST() {
  try {
    console.log('Starting territory fix and history migration...');
    
    const playlists = await getAllPlaylists();
    console.log(`Found ${playlists.length} playlists to fix`);
    
    let totalFixed = 0;
    let totalHistoryEntries = 0;
    
    for (const playlist of playlists) {
      console.log(`Processing playlist: ${playlist.name}`);
      
      // Fix territories and create history
      const fixedKeywords = playlist.keywords.map(keyword => ({
        ...keyword,
        territory: keyword.territory === 'unknown' ? 'de' : keyword.territory
      }));
      
      // Update playlist with fixed territories
      const updatedPlaylist = {
        ...playlist,
        keywords: fixedKeywords
      };
      
      await savePlaylistData(playlist.id, updatedPlaylist);
      totalFixed += fixedKeywords.filter(k => k.territory === 'de').length;
      
      // Create keyword history entries for each keyword
      for (const keyword of fixedKeywords) {
        try {
          await saveKeywordHistory(
            playlist.id,
            keyword.keyword,
            keyword.territory,
            keyword.position
          );
          totalHistoryEntries++;
        } catch (error) {
          console.error(`Failed to save history for ${keyword.keyword}:`, error);
        }
      }
      
      console.log(`Fixed ${playlist.name}: ${fixedKeywords.length} keywords`);
    }
    
    console.log(`Territory fix complete: ${totalFixed} territories fixed, ${totalHistoryEntries} history entries created`);
    
    const response = NextResponse.json({
      success: true,
      message: 'Territory fix and history migration completed',
      stats: {
        playlistsProcessed: playlists.length,
        territoriesFixed: totalFixed,
        historyEntriesCreated: totalHistoryEntries
      }
    });
    
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
    
  } catch (error) {
    console.error('Territory fix failed:', error);
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