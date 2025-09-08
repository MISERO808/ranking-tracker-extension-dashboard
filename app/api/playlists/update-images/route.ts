import { NextResponse } from 'next/server';
import { getAllPlaylists, getPlaylistData, savePlaylistData } from '@/lib/redis';
import { getPlaylistImage } from '@/lib/spotify';

export async function POST() {
  try {
    console.log('Starting playlist image update...');
    
    // Get all playlists
    const playlists = await getAllPlaylists();
    console.log(`Found ${playlists.length} playlists to update`);
    
    let updated = 0;
    let failed = 0;
    const results = [];
    
    for (const playlist of playlists) {
      try {
        // Skip if already has a valid image
        if (playlist.image && playlist.image.trim() !== '') {
          console.log(`Playlist ${playlist.name} already has an image, skipping`);
          results.push({
            id: playlist.id,
            name: playlist.name,
            status: 'skipped',
            reason: 'already has image'
          });
          continue;
        }
        
        // Fetch image from Spotify
        console.log(`Fetching image for ${playlist.name} (${playlist.id})`);
        const imageUrl = await getPlaylistImage(playlist.id);
        
        if (imageUrl) {
          // Update the playlist with the image
          playlist.image = imageUrl;
          await savePlaylistData(playlist.id, playlist);
          
          console.log(`✅ Updated image for ${playlist.name}`);
          updated++;
          results.push({
            id: playlist.id,
            name: playlist.name,
            status: 'updated',
            imageUrl
          });
        } else {
          console.log(`❌ No image found for ${playlist.name}`);
          failed++;
          results.push({
            id: playlist.id,
            name: playlist.name,
            status: 'no_image_found'
          });
        }
      } catch (error) {
        console.error(`Error updating playlist ${playlist.id}:`, error);
        failed++;
        results.push({
          id: playlist.id,
          name: playlist.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Updated ${updated} playlists, ${failed} failed`,
      updated,
      failed,
      total: playlists.length,
      results
    });
    
  } catch (error) {
    console.error('Error updating playlist images:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update playlist images',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to check Spotify API configuration
export async function GET() {
  const hasClientId = !!process.env.SPOTIFY_CLIENT_ID;
  const hasClientSecret = !!process.env.SPOTIFY_CLIENT_SECRET;
  
  if (!hasClientId || !hasClientSecret) {
    return NextResponse.json({
      configured: false,
      message: 'Spotify API credentials not configured',
      instructions: {
        1: 'Go to https://developer.spotify.com/dashboard',
        2: 'Create an app or use existing one',
        3: 'Copy Client ID and Client Secret',
        4: 'Add to .env.local:',
        example: 'SPOTIFY_CLIENT_ID=your_client_id\nSPOTIFY_CLIENT_SECRET=your_client_secret'
      }
    }, { status: 503 });
  }
  
  return NextResponse.json({
    configured: true,
    message: 'Spotify API is configured and ready'
  });
}