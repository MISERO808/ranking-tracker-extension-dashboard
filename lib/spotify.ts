// Spotify Web API integration
// Uses Client Credentials flow (no user auth needed for public playlists)

interface SpotifyToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  description: string;
  owner: {
    display_name: string;
  };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getSpotifyToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  // Support both naming conventions
  const clientId = process.env.SPOTIFY_CLIENT_ID || process.env.Spotify_API_Client_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || process.env.Spotify_API_Client_Secret;

  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not configured. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET (or Spotify_API_Client_ID and Spotify_API_Client_Secret) to environment variables');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    throw new Error(`Failed to get Spotify token: ${response.statusText}`);
  }

  const data: SpotifyToken = await response.json();
  
  // Cache the token (expires_in is in seconds, convert to milliseconds)
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000) - 60000 // Refresh 1 minute before expiry
  };

  return data.access_token;
}

export async function getPlaylistImage(playlistId: string): Promise<string | null> {
  try {
    const token = await getSpotifyToken();
    
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch playlist ${playlistId}: ${response.statusText}`);
      return null;
    }

    const playlist: SpotifyPlaylist = await response.json();
    
    // Get the highest quality image (first one is usually the largest)
    if (playlist.images && playlist.images.length > 0) {
      return playlist.images[0].url;
    }

    return null;
  } catch (error) {
    console.error('Error fetching playlist image:', error);
    return null;
  }
}

export async function getMultiplePlaylistImages(playlistIds: string[]): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();
  
  try {
    const token = await getSpotifyToken();
    
    // Spotify API allows fetching up to 50 playlists at once, but we need to do them individually
    // because the batch endpoint requires user auth. With client credentials, we fetch one by one.
    const promises = playlistIds.map(async (id) => {
      try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const playlist: SpotifyPlaylist = await response.json();
          if (playlist.images && playlist.images.length > 0) {
            imageMap.set(id, playlist.images[0].url);
          }
        }
      } catch (error) {
        console.error(`Error fetching playlist ${id}:`, error);
      }
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error fetching playlist images:', error);
  }

  return imageMap;
}