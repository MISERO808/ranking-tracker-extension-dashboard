import { NextResponse } from 'next/server';
import { getAllPlaylists, savePlaylistData, saveKeywordHistory, PlaylistData } from '@/lib/redis';

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
    console.log('GET /api/playlists - Fetching playlists...');
    const playlists = await getAllPlaylists();
    console.log(`GET /api/playlists - Found ${playlists.length} playlists`);
    
    const response = NextResponse.json(playlists);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    console.error('Error fetching playlists:', error);
    const response = NextResponse.json({ 
      error: 'Failed to fetch playlists', 
      details: error instanceof Error ? error.message : 'Unknown error',
      env: {
        hasRedisUrl: !!process.env.REDIS_URL,
        hasKvUrl: !!process.env.KV_URL
      }
    }, { status: 500 });
    
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }
}

export async function POST(request: Request) {
  try {
    const requestTime = new Date().toISOString();
    console.log(`🚀 POST /api/playlists - NEW REQUEST at ${requestTime}`);
    
    // Log request headers for debugging
    console.log('Headers:', Object.fromEntries(request.headers.entries()));
    
    const playlistData: PlaylistData = await request.json();
    console.log(`📝 POST /api/playlists - Playlist: ${playlistData.name} (${playlistData.keywords.length} keywords)`);
    console.log(`📅 Request timestamp: ${requestTime}`);
    
    // DEBUG: Log keyword timestamps to verify historical data
    const keywordsByDate = playlistData.keywords.reduce((acc, k) => {
      const date = new Date(k.timestamp).toISOString().split('T')[0];
      if (!acc[date]) acc[date] = 0;
      acc[date]++;
      return acc;
    }, {} as { [date: string]: number });
    console.log('📊 POST /api/playlists - Keywords by date:', keywordsByDate);
    
    // Log the most recent keywords in this batch
    const sortedKeywords = playlistData.keywords.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    console.log('🔍 Most recent keywords in this request:');
    sortedKeywords.slice(0, 3).forEach((k, i) => {
      console.log(`  ${i + 1}. "${k.keyword}" at ${k.timestamp} (${new Date(k.timestamp).toLocaleString()})`);
    });
    
    await savePlaylistData(playlistData.id, playlistData);
    
    // Save keyword history for trending analysis
    for (const keyword of playlistData.keywords) {
      await saveKeywordHistory(
        playlistData.id, 
        keyword.keyword, 
        keyword.territory, 
        keyword.position,
        keyword.userId,
        keyword.sessionId
      );
    }
    
    console.log('POST /api/playlists - Playlist and history saved successfully');
    console.log(`POST /api/playlists - Total keywords after save: ${playlistData.keywords.length}`);
    
    const response = NextResponse.json({ success: true });
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    console.error('Error saving playlist:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    const response = NextResponse.json({ 
      error: 'Failed to save playlist',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
    
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }
}