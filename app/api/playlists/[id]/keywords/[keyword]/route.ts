import { NextResponse } from 'next/server';
import { addDeletedKeyword, getPlaylistData, savePlaylistData } from '@/lib/redis';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; keyword: string } }
) {
  try {
    const playlistId = params.id;
    const keyword = decodeURIComponent(params.keyword);
    
    console.log(`[API] Deleting keyword "${keyword}" from playlist ${playlistId}`);
    
    // Mark keyword as deleted
    await addDeletedKeyword(playlistId, keyword);
    
    // Get current playlist data
    const playlist = await getPlaylistData(playlistId);
    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }
    
    // Remove keyword from playlist data
    const updatedPlaylist = {
      ...playlist,
      keywords: playlist.keywords.filter(k => 
        k.keyword.toLowerCase() !== keyword.toLowerCase()
      )
    };
    
    // Save updated playlist
    await savePlaylistData(playlistId, updatedPlaylist);
    
    console.log(`[API] Successfully deleted keyword "${keyword}"`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting keyword:', error);
    return NextResponse.json(
      { error: 'Failed to delete keyword' },
      { status: 500 }
    );
  }
}