import { NextResponse } from 'next/server';
import { getAllPlaylists, savePlaylistData, PlaylistData } from '@/lib/redis';

export async function GET() {
  try {
    console.log('GET /api/playlists - Fetching playlists...');
    const playlists = await getAllPlaylists();
    console.log(`GET /api/playlists - Found ${playlists.length} playlists`);
    return NextResponse.json(playlists);
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch playlists', 
      details: error instanceof Error ? error.message : 'Unknown error',
      env: {
        hasRedisUrl: !!process.env.REDIS_URL,
        hasKvUrl: !!process.env.KV_URL
      }
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    console.log('POST /api/playlists - Saving playlist...');
    const playlistData: PlaylistData = await request.json();
    console.log(`POST /api/playlists - Playlist: ${playlistData.name} (${playlistData.keywords.length} keywords)`);
    
    await savePlaylistData(playlistData.id, playlistData);
    console.log('POST /api/playlists - Playlist saved successfully');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving playlist:', error);
    return NextResponse.json({ 
      error: 'Failed to save playlist',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}