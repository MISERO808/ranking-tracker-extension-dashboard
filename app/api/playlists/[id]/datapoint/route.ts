import { NextResponse } from 'next/server';
import { getPlaylistData, savePlaylistData } from '@/lib/redis';

// Add CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword');
    const territory = searchParams.get('territory');
    const timestamp = searchParams.get('timestamp');
    const playlistId = params.id;

    if (!keyword || !territory || !timestamp) {
      const response = NextResponse.json(
        { error: 'keyword, territory, and timestamp are required' },
        { status: 400 }
      );
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    console.log(`DELETE /api/playlists/${playlistId}/datapoint - Deleting data point: ${keyword} / ${territory} @ ${timestamp}`);

    const playlist = await getPlaylistData(playlistId);
    if (!playlist) {
      const response = NextResponse.json(
        { error: 'Playlist not found' },
        { status: 404 }
      );
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    // Filter out the specific data point
    const originalCount = playlist.keywords.length;
    playlist.keywords = playlist.keywords.filter(k => {
      return !(
        k.keyword.toLowerCase() === keyword.toLowerCase() &&
        k.territory.toLowerCase() === territory.toLowerCase() &&
        k.timestamp === timestamp
      );
    });

    const deletedCount = originalCount - playlist.keywords.length;

    if (deletedCount === 0) {
      const response = NextResponse.json(
        { error: 'Data point not found' },
        { status: 404 }
      );
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    await savePlaylistData(playlistId, playlist);
    console.log(`DELETE /api/playlists/${playlistId}/datapoint - Deleted ${deletedCount} data point(s)`);

    const response = NextResponse.json({ success: true, deletedCount });
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    console.error('Error deleting data point:', error);
    const response = NextResponse.json(
      {
        error: 'Failed to delete data point',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );

    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }
}
