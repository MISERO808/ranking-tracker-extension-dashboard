import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

// Add CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function GET() {
  try {
    console.log('🔍 DEBUG: Checking recent activity and API calls...');
    
    const redis = await getRedisClient();
    
    // Check for any recent playlist updates
    const keys = await redis.keys('playlist:*');
    console.log(`Found ${keys.length} playlist keys in Redis`);
    
    const recentActivity: any[] = [];
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    for (const key of keys) {
      const rawData = await redis.hGet(key, 'data');
      if (!rawData) continue;
      
      const playlist = JSON.parse(rawData);
      if (!playlist.keywords) continue;
      
      // Find keywords added in the last 24 hours
      const recentKeywords = playlist.keywords.filter((k: any) => {
        const keywordDate = new Date(k.timestamp);
        return keywordDate > last24Hours;
      });
      
      if (recentKeywords.length > 0) {
        recentActivity.push({
          playlistName: playlist.name,
          playlistId: playlist.id,
          lastUpdated: playlist.lastUpdated,
          totalKeywords: playlist.keywords.length,
          recentKeywords: recentKeywords.length,
          recentKeywordSamples: recentKeywords.slice(0, 5).map((k: any) => ({
            keyword: k.keyword,
            position: k.position,
            territory: k.territory,
            timestamp: k.timestamp,
            userId: k.userId,
            sessionId: k.sessionId
          })),
          oldestKeyword: playlist.keywords.reduce((oldest: any, current: any) => {
            return new Date(current.timestamp) < new Date(oldest.timestamp) ? current : oldest;
          }, playlist.keywords[0]),
          newestKeyword: playlist.keywords.reduce((newest: any, current: any) => {
            return new Date(current.timestamp) > new Date(newest.timestamp) ? current : newest;
          }, playlist.keywords[0])
        });
      }
    }
    
    // Check for any API activity logs (if they exist)
    const apiLogKeys = await redis.keys('api_log:*');
    console.log(`Found ${apiLogKeys.length} API log keys`);
    
    // Get timestamp distribution of all data
    let timestampDistribution: { [date: string]: number } = {};
    let totalKeywords = 0;
    
    for (const key of keys) {
      const rawData = await redis.hGet(key, 'data');
      if (!rawData) continue;
      
      const playlist = JSON.parse(rawData);
      if (!playlist.keywords) continue;
      
      playlist.keywords.forEach((k: any) => {
        totalKeywords++;
        const date = new Date(k.timestamp).toISOString().split('T')[0];
        timestampDistribution[date] = (timestampDistribution[date] || 0) + 1;
      });
    }
    
    // Sort dates
    const sortedDates = Object.keys(timestampDistribution).sort();
    
    console.log('Recent activity check complete');
    
    // DUPLICATE ANALYSIS - Find potential duplicates
    const duplicateAnalysis: any[] = [];
    
    for (const key of keys) {
      const rawData = await redis.hGet(key, 'data');
      if (!rawData) continue;
      
      const playlist = JSON.parse(rawData);
      if (!playlist.keywords) continue;
      
      // Group by keyword + territory + position
      const similarGroups = new Map<string, any[]>();
      
      playlist.keywords.forEach((keyword: any) => {
        const groupKey = `${keyword.keyword.toLowerCase().trim()}-${keyword.territory.toLowerCase()}-${keyword.position}`;
        if (!similarGroups.has(groupKey)) {
          similarGroups.set(groupKey, []);
        }
        similarGroups.get(groupKey)!.push(keyword);
      });
      
      // Find duplicates
      similarGroups.forEach((entries, groupKey) => {
        if (entries.length > 1) {
          const differences = [];
          for (let i = 1; i < entries.length; i++) {
            const timeDiff = new Date(entries[i].timestamp).getTime() - new Date(entries[0].timestamp).getTime();
            differences.push({
              entry1Timestamp: entries[0].timestamp,
              entry2Timestamp: entries[i].timestamp,
              timeDifferenceMs: timeDiff,
              timeDifferenceSeconds: (timeDiff / 1000).toFixed(3)
            });
          }
          
          duplicateAnalysis.push({
            keyword: entries[0].keyword,
            position: entries[0].position,
            territory: entries[0].territory,
            duplicateCount: entries.length,
            differences
          });
        }
      });
    }
    
    const response = NextResponse.json({
      success: true,
      debug: {
        currentTime: now.toISOString(),
        last24HoursThreshold: last24Hours.toISOString(),
        totalPlaylists: keys.length,
        totalKeywords: totalKeywords,
        recentActivity: recentActivity,
        timestampDistribution: timestampDistribution,
        dateRange: {
          oldest: sortedDates[0],
          newest: sortedDates[sortedDates.length - 1]
        },
        apiLogKeys: apiLogKeys.length,
        redisConnectionStatus: 'connected',
        duplicateAnalysis: {
          totalDuplicateGroups: duplicateAnalysis.length,
          duplicates: duplicateAnalysis.slice(0, 10) // First 10 for debugging
        }
      }
    });
    
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
    
  } catch (error) {
    console.error('❌ Recent activity debug failed:', error);
    const response = NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
    
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }
}