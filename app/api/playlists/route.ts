import { NextResponse } from 'next/server';
import { getAllPlaylists, savePlaylistData, PlaylistData } from '@/lib/redis';

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
    console.log('POST /api/playlists - Saving playlist...');
    const playlistData: PlaylistData = await request.json();
    console.log(`POST /api/playlists - Playlist: ${playlistData.name} (${playlistData.keywords.length} keywords)`);
    
    await savePlaylistData(playlistData.id, playlistData);
    console.log('POST /api/playlists - Playlist saved successfully');
    
    const response = NextResponse.json({ success: true });
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    console.error('Error saving playlist:', error);
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