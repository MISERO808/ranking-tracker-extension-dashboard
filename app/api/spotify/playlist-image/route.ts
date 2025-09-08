import { NextRequest, NextResponse } from 'next/server';

async function getSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_API_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_API_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Spotify API credentials not configured');
  }
  
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });
  
  if (!response.ok) {
    throw new Error('Failed to get Spotify access token');
  }
  
  const data = await response.json();
  return data.access_token;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const playlistId = searchParams.get('id');
    
    if (!playlistId) {
      return NextResponse.json({ error: 'Playlist ID required' }, { status: 400 });
    }
    
    // Get Spotify access token
    const accessToken = await getSpotifyAccessToken();
    
    // Fetch playlist details from Spotify
    const playlistResponse = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!playlistResponse.ok) {
      if (playlistResponse.status === 404) {
        return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
      }
      throw new Error('Failed to fetch playlist from Spotify');
    }
    
    const playlistData = await playlistResponse.json();
    
    // Extract the image URL (use the first/largest image)
    const imageUrl = playlistData.images?.[0]?.url || null;
    
    return NextResponse.json({
      id: playlistId,
      name: playlistData.name,
      description: playlistData.description,
      image: imageUrl,
      owner: playlistData.owner?.display_name || '',
      tracks: playlistData.tracks?.total || 0
    });
    
  } catch (error) {
    console.error('Error fetching playlist image:', error);
    return NextResponse.json({
      error: 'Failed to fetch playlist image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}