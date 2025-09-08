import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasSpotifyClientId: !!process.env.SPOTIFY_CLIENT_ID,
    hasSpotifyClientSecret: !!process.env.SPOTIFY_CLIENT_SECRET,
    spotifyClientIdLength: process.env.SPOTIFY_CLIENT_ID?.length || 0,
    spotifyClientSecretLength: process.env.SPOTIFY_CLIENT_SECRET?.length || 0,
    // Check for common mistakes
    hasSpotifyApiClientId: !!process.env.SPOTIFY_API_CLIENT_ID,
    hasSpotifyApiClientSecret: !!process.env.SPOTIFY_API_CLIENT_SECRET,
    hasSpotify_API_Client_ID: !!process.env.Spotify_API_Client_ID,
    hasSpotify_API_Client_Secret: !!process.env.Spotify_API_Client_Secret,
    // List all env vars that contain SPOTIFY (just the keys, not values)
    spotifyEnvVars: Object.keys(process.env).filter(key => key.toUpperCase().includes('SPOTIFY'))
  });
}