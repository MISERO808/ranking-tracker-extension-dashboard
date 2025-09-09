import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export async function POST() {
  try {
    const redis = await getRedisClient();
    
    // Get all playlist keys
    const keys = await redis.keys('playlist:*');
    const playlistKeys = keys.filter(key => !key.includes(':history:'));
    
    let totalCleaned = 0;
    let totalRemoved = 0;
    const cleanupDetails: any[] = [];
    
    for (const key of playlistKeys) {
      const playlistData = await redis.hGet(key, 'data');
      if (!playlistData) continue;
      
      const playlist = JSON.parse(playlistData);
      const playlistId = key.replace('playlist:', '');
      
      // Group keywords by keyword+territory
      const keywordGroups = new Map<string, any[]>();
      
      playlist.keywords.forEach((entry: any) => {
        const groupKey = `${entry.keyword.toLowerCase().trim()}_${entry.territory.toLowerCase().trim()}`;
        if (!keywordGroups.has(groupKey)) {
          keywordGroups.set(groupKey, []);
        }
        keywordGroups.get(groupKey)!.push(entry);
      });
      
      const cleanedKeywords: any[] = [];
      
      // Process each keyword+territory group
      Array.from(keywordGroups.entries()).forEach(([groupKey, entries]) => {
        // Sort by timestamp
        entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        // Group by 5-minute windows
        const windows = new Map<number, any[]>();
        
        entries.forEach(entry => {
          const time = new Date(entry.timestamp).getTime();
          // Round down to nearest 5 minutes
          const windowKey = Math.floor(time / (5 * 60 * 1000));
          
          if (!windows.has(windowKey)) {
            windows.set(windowKey, []);
          }
          windows.get(windowKey)!.push(entry);
        });
        
        // For each window, keep only the best ranking (lowest position number)
        Array.from(windows.entries()).forEach(([windowKey, windowEntries]) => {
          if (windowEntries.length > 1) {
            // Found duplicates in same 5-minute window
            const bestEntry = windowEntries.reduce((best, current) => 
              current.position < best.position ? current : best
            );
            
            cleanupDetails.push({
              playlist: playlist.name,
              keyword: windowEntries[0].keyword,
              territory: windowEntries[0].territory,
              window: new Date(windowKey * 5 * 60 * 1000).toISOString(),
              kept: `#${bestEntry.position} at ${bestEntry.timestamp}`,
              removed: windowEntries
                .filter(e => e !== bestEntry)
                .map(e => `#${e.position} at ${e.timestamp}`)
            });
            
            totalRemoved += windowEntries.length - 1;
            cleanedKeywords.push(bestEntry);
          } else {
            // No duplicates in this window
            cleanedKeywords.push(windowEntries[0]);
          }
        });
      });
      
      // Update the playlist with cleaned data
      if (cleanedKeywords.length !== playlist.keywords.length) {
        totalCleaned++;
        playlist.keywords = cleanedKeywords;
        await redis.hSet(key, 'data', JSON.stringify(playlist));
        
        console.log(`[Cleanup] Playlist ${playlist.name}: Reduced from ${playlist.keywords.length} to ${cleanedKeywords.length} entries`);
      }
    }
    
    return NextResponse.json({
      success: true,
      playlistsCleaned: totalCleaned,
      entriesRemoved: totalRemoved,
      details: cleanupDetails.slice(0, 100) // Limit details to first 100 for response size
    });
    
  } catch (error) {
    console.error('[Cleanup] Error:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup duplicates' },
      { status: 500 }
    );
  }
}

// GET method to preview what would be cleaned
export async function GET() {
  try {
    const redis = await getRedisClient();
    
    // Get all playlist keys
    const keys = await redis.keys('playlist:*');
    const playlistKeys = keys.filter(key => !key.includes(':history:'));
    
    const preview: any[] = [];
    let totalDuplicates = 0;
    
    for (const key of playlistKeys) {
      const playlistData = await redis.hGet(key, 'data');
      if (!playlistData) continue;
      
      const playlist = JSON.parse(playlistData);
      
      // Group keywords by keyword+territory
      const keywordGroups = new Map<string, any[]>();
      
      playlist.keywords.forEach((entry: any) => {
        const groupKey = `${entry.keyword.toLowerCase().trim()}_${entry.territory.toLowerCase().trim()}`;
        if (!keywordGroups.has(groupKey)) {
          keywordGroups.set(groupKey, []);
        }
        keywordGroups.get(groupKey)!.push(entry);
      });
      
      // Process each keyword+territory group
      Array.from(keywordGroups.entries()).forEach(([groupKey, entries]) => {
        // Sort by timestamp
        entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        // Group by 5-minute windows
        const windows = new Map<number, any[]>();
        
        entries.forEach(entry => {
          const time = new Date(entry.timestamp).getTime();
          // Round down to nearest 5 minutes
          const windowKey = Math.floor(time / (5 * 60 * 1000));
          
          if (!windows.has(windowKey)) {
            windows.set(windowKey, []);
          }
          windows.get(windowKey)!.push(entry);
        });
        
        // Check for duplicates in each window
        Array.from(windows.entries()).forEach(([windowKey, windowEntries]) => {
          if (windowEntries.length > 1) {
            const bestEntry = windowEntries.reduce((best, current) => 
              current.position < best.position ? current : best
            );
            
            totalDuplicates += windowEntries.length - 1;
            
            preview.push({
              playlist: playlist.name,
              keyword: windowEntries[0].keyword,
              territory: windowEntries[0].territory,
              window: new Date(windowKey * 5 * 60 * 1000).toISOString(),
              duplicates: windowEntries.length,
              positions: windowEntries.map(e => e.position).sort((a, b) => a - b),
              wouldKeep: `#${bestEntry.position}`,
              wouldRemove: windowEntries
                .filter(e => e !== bestEntry)
                .map(e => `#${e.position}`)
            });
          }
        });
      });
    }
    
    return NextResponse.json({
      duplicatesFound: totalDuplicates,
      preview: preview.slice(0, 100), // Limit to first 100 for readability
      message: `Found ${totalDuplicates} duplicate entries within 5-minute windows. POST to this endpoint to clean them up.`
    });
    
  } catch (error) {
    console.error('[Cleanup Preview] Error:', error);
    return NextResponse.json(
      { error: 'Failed to preview duplicates' },
      { status: 500 }
    );
  }
}