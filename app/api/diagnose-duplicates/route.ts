import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export async function GET() {
  try {
    console.log('🔍 DUPLICATE DIAGNOSIS: Analyzing near-duplicate entries...');
    
    const redis = await getRedisClient();
    
    // Get all playlist keys
    const keys = await redis.keys('playlist:*');
    console.log(`Found ${keys.length} playlist keys in Redis`);
    
    const duplicateAnalysis: any[] = [];
    
    for (const key of keys) {
      const rawData = await redis.hGet(key, 'data');
      if (!rawData) continue;
      
      let playlist;
      try {
        playlist = JSON.parse(rawData);
      } catch (parseError) {
        console.error(`❌ Failed to parse data for ${key}:`, parseError);
        continue;
      }
      
      console.log(`\n📋 Analyzing ${playlist.name || 'Unknown Playlist'}: ${playlist.keywords?.length || 0} keywords`);
      
      if (!playlist.keywords || !Array.isArray(playlist.keywords)) {
        continue;
      }
      
      // Group by keyword + territory + position to find potential duplicates
      const similarGroups = new Map<string, any[]>();
      
      playlist.keywords.forEach((keyword: any) => {
        const groupKey = `${keyword.keyword.toLowerCase().trim()}-${keyword.territory.toLowerCase()}-${keyword.position}`;
        
        if (!similarGroups.has(groupKey)) {
          similarGroups.set(groupKey, []);
        }
        similarGroups.get(groupKey)!.push(keyword);
      });
      
      // Find groups with multiple entries (potential duplicates)
      similarGroups.forEach((entries, groupKey) => {
        if (entries.length > 1) {
          console.log(`\n🎯 POTENTIAL DUPLICATES found for: ${entries[0].keyword} #${entries[0].position}`);
          console.log(`   Found ${entries.length} similar entries:`);
          
          const differences: Array<{
            entry1: { timestamp: string; id?: string; sessionId?: string; userId?: string };
            entry2: { timestamp: string; id?: string; sessionId?: string; userId?: string };
            timeDifferenceMs: number;
            timeDifferenceSeconds: number;
          }> = [];
          
          entries.forEach((entry, index) => {
            console.log(`   [${index + 1}] Timestamp: ${entry.timestamp}`);
            console.log(`       ID: ${entry.id || 'no-id'}`);
            console.log(`       SessionID: ${entry.sessionId || 'no-session'}`);
            console.log(`       UserID: ${entry.userId || 'no-user'}`);
            
            // Compare timestamps
            if (index > 0) {
              const timeDiff = new Date(entry.timestamp).getTime() - new Date(entries[0].timestamp).getTime();
              console.log(`       Time diff from first: ${timeDiff}ms (${timeDiff / 1000}s)`);
              
              differences.push({
                entry1: {
                  timestamp: entries[0].timestamp,
                  id: entries[0].id,
                  sessionId: entries[0].sessionId,
                  userId: entries[0].userId
                },
                entry2: {
                  timestamp: entry.timestamp,
                  id: entry.id,
                  sessionId: entry.sessionId,
                  userId: entry.userId
                },
                timeDifferenceMs: timeDiff,
                timeDifferenceSeconds: timeDiff / 1000
              });
            }
          });
          
          duplicateAnalysis.push({
            playlistName: playlist.name,
            keyword: entries[0].keyword,
            position: entries[0].position,
            territory: entries[0].territory,
            duplicateCount: entries.length,
            entries: entries.map(e => ({
              timestamp: e.timestamp,
              id: e.id,
              sessionId: e.sessionId,
              userId: e.userId
            })),
            differences
          });
        }
      });
    }
    
    console.log(`\n📊 DUPLICATE ANALYSIS COMPLETE!`);
    console.log(`Found ${duplicateAnalysis.length} sets of potential duplicates`);
    
    return NextResponse.json({
      success: true,
      message: 'Duplicate analysis completed',
      duplicateGroups: duplicateAnalysis,
      totalDuplicateGroups: duplicateAnalysis.length,
      analysis: duplicateAnalysis.map(group => ({
        keyword: group.keyword,
        position: group.position,
        duplicateCount: group.duplicateCount,
        timeDifferences: group.differences.map((d: any) => `${d.timeDifferenceSeconds}s`)
      }))
    });
    
  } catch (error) {
    console.error('❌ Duplicate analysis failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}