import { NextResponse } from 'next/server';
import { getPlaylistData, savePlaylistData } from '@/lib/redis';

async function getSpotifyPlaylistImage(playlistId: string) {
  try {
    const clientId = process.env.SPOTIFY_API_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_API_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      console.log('Spotify API credentials not configured');
      return null;
    }
    
    // Get access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });
    
    if (!tokenResponse.ok) {
      console.log('Failed to get Spotify access token');
      return null;
    }
    
    const { access_token } = await tokenResponse.json();
    
    // Fetch playlist details
    const playlistResponse = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}`,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      }
    );
    
    if (!playlistResponse.ok) {
      console.log('Failed to fetch playlist from Spotify');
      return null;
    }
    
    const playlistData = await playlistResponse.json();
    return playlistData.images?.[0]?.url || null;
    
  } catch (error) {
    console.error('Error fetching Spotify playlist image:', error);
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const playlist = await getPlaylistData(params.id);

    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }

    // Try to fetch image from Spotify if not already present
    if (!playlist.image) {
      const spotifyImage = await getSpotifyPlaylistImage(params.id);
      if (spotifyImage) {
        playlist.image = spotifyImage;
        // Save the image URL for future use
        await savePlaylistData(params.id, playlist);
      }
    }

    return NextResponse.json(playlist);
  } catch (error) {
    console.error('Error fetching playlist:', error);
    return NextResponse.json({ error: 'Failed to fetch playlist' }, { status: 500 });
  }
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

    // Check if this is a data point deletion (has keyword, territory, timestamp params)
    if (keyword && territory && timestamp) {
      const playlist = await getPlaylistData(playlistId);

      if (!playlist) {
        return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
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
        return NextResponse.json(
          { error: 'Data point not found' },
          { status: 404 }
        );
      }

      await savePlaylistData(playlistId, playlist);

      return NextResponse.json({ success: true, deletedCount });
    }

    // If no data point params, return error (we don't want to delete entire playlists)
    return NextResponse.json(
      { error: 'Missing required parameters for data point deletion' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error deleting data point:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete data point',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}