import { NextResponse } from 'next/server';
import { getAllPlaylists, savePlaylistData } from '@/lib/redis';

export async function GET() {
  try {
    console.log('🧹 Starting territory cleanup...');
    
    const playlists = await getAllPlaylists();
    let totalRemoved = 0;
    let totalKept = 0;
    const stats: any[] = [];
    
    for (const playlist of playlists) {
      const originalCount = playlist.keywords.length;
      
      // Filter out invalid territories
      const validKeywords = playlist.keywords.filter((keyword: any) => {
        const territory = keyword.territory?.toLowerCase().trim();
        
        // Valid territory must be:
        // - Not null/undefined
        // - Not 'unknown'
        // - Exactly 2 characters
        // - Only letters
        const isValid = territory && 
                       territory !== 'unknown' && 
                       territory.length === 2 && 
                       /^[a-z]{2}$/i.test(territory);
        
        if (!isValid) {
          console.log(`Removing invalid territory: "${keyword.territory}" for keyword "${keyword.keyword}"`);
        }
        
        return isValid;
      });
      
      const removedCount = originalCount - validKeywords.length;
      totalRemoved += removedCount;
      totalKept += validKeywords.length;
      
      if (removedCount > 0) {
        // Update playlist with cleaned data
        playlist.keywords = validKeywords;
        await savePlaylistData(playlist.id, playlist);
        
        stats.push({
          playlistId: playlist.id,
          playlistName: playlist.name,
          originalCount,
          removedCount,
          keptCount: validKeywords.length
        });
      }
    }
    
    console.log(`✅ Cleanup complete: Removed ${totalRemoved} invalid entries, kept ${totalKept} valid entries`);
    
    return NextResponse.json({
      success: true,
      totalRemoved,
      totalKept,
      playlistsUpdated: stats.length,
      details: stats
    });
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    return NextResponse.json({
      error: 'Cleanup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}