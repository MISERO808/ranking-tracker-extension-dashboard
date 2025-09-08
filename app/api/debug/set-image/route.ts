import { NextResponse } from 'next/server';
import { getPlaylistData, savePlaylistData } from '@/lib/redis';

export async function POST(request: Request) {
  try {
    const { playlistId, imageUrl } = await request.json();
    
    if (!playlistId || !imageUrl) {
      return NextResponse.json({ 
        error: 'Missing playlistId or imageUrl' 
      }, { status: 400 });
    }
    
    // Get existing playlist data
    const existingData = await getPlaylistData(playlistId);
    
    if (!existingData) {
      return NextResponse.json({ 
        error: 'Playlist not found' 
      }, { status: 404 });
    }
    
    // Update the image
    existingData.image = imageUrl;
    
    // Save back to Redis (requires playlistId as first argument)
    await savePlaylistData(playlistId, existingData);
    
    return NextResponse.json({ 
      success: true,
      playlistId,
      imageUrl,
      message: 'Image updated successfully'
    });
    
  } catch (error) {
    console.error('Error setting image:', error);
    return NextResponse.json({ 
      error: 'Failed to set image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playlistId = searchParams.get('playlistId');
  
  if (!playlistId) {
    return NextResponse.json({ 
      error: 'Missing playlistId parameter' 
    }, { status: 400 });
  }
  
  try {
    const data = await getPlaylistData(playlistId);
    
    if (!data) {
      return NextResponse.json({ 
        error: 'Playlist not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json({
      playlistId,
      name: data.name,
      currentImage: data.image || null,
      hasImage: !!data.image,
      keywordCount: data.keywords.length
    });
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to get playlist data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}