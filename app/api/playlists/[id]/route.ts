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