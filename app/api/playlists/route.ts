import { NextResponse } from 'next/server';
import { getAllPlaylists, savePlaylistData, PlaylistData } from '@/lib/redis';

export async function GET() {
  try {
    const playlists = await getAllPlaylists();
    return NextResponse.json(playlists);
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return NextResponse.json({ error: 'Failed to fetch playlists' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const playlistData: PlaylistData = await request.json();
    await savePlaylistData(playlistData.id, playlistData);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving playlist:', error);
    return NextResponse.json({ error: 'Failed to save playlist' }, { status: 500 });
  }
}