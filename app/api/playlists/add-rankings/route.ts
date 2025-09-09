import { NextResponse } from 'next/server';
import { getRedisClient, saveKeywordHistory } from '@/lib/redis';

// Add CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const requestTime = new Date().toISOString();
    console.log(`🚀 POST /api/playlists/add-rankings - OPTIMIZED ENDPOINT at ${requestTime}`);
    
    const data = await request.json();
    
    // Extract playlist info
    const { id: playlistId, name, image, keywords } = data;
    
    console.log(`📝 Adding ${keywords.length} new rankings for ${name}`);
    
    // Clean and validate keywords
    const validKeywords = keywords.filter((k: any) => {
      const territory = k.territory?.toLowerCase().trim();
      if (!territory || territory === 'unknown' || territory.length !== 2 || !/^[a-z]{2}$/.test(territory)) {
        console.log(`⚠️ Rejecting invalid territory: "${k.territory}" for keyword "${k.keyword}"`);
        return false;
      }
      return true;
    });
    
    console.log(`✅ ${validKeywords.length} valid keywords to add`);
    
    const redis = await getRedisClient();
    
    // Get the playlist key
    const playlistKey = `playlist:${playlistId}`;
    
    // Check if playlist exists
    const exists = await redis.exists(playlistKey);
    
    if (!exists) {
      // Create new playlist
      console.log(`📦 Creating new playlist: ${name}`);
      const newPlaylistData = {
        id: playlistId,
        name,
        image: image || '',
        keywords: validKeywords,
        lastUpdated: requestTime
      };
      
      await redis.hSet(playlistKey, 'data', JSON.stringify(newPlaylistData));
    } else {
      // For existing playlists, we ONLY:
      // 1. Update the name/image if provided
      // 2. Append new keywords to history
      // We DO NOT load all existing data!
      
      console.log(`📝 Updating existing playlist: ${name}`);
      
      // Get just the basic info (not all keywords!)
      const existingDataStr = await redis.hGet(playlistKey, 'data');
      if (existingDataStr) {
        const existingData = JSON.parse(existingDataStr);
        
        // Update name/image if needed
        if (name && name !== existingData.name) {
          existingData.name = name;
        }
        if (image && !existingData.image) {
          existingData.image = image;
        }
        existingData.lastUpdated = requestTime;
        
        // IMPORTANT: We're NOT loading/merging all keywords!
        // Just append the new ones
        const existingKeywords = existingData.keywords || [];
        
        // Only append truly new entries (check by timestamp/position)
        const newEntries = validKeywords.filter((newK: any) => {
          return !existingKeywords.some((existingK: any) => 
            existingK.keyword === newK.keyword &&
            existingK.territory === newK.territory &&
            existingK.position === newK.position &&
            existingK.timestamp === newK.timestamp
          );
        });
        
        console.log(`📊 Adding ${newEntries.length} new entries to existing ${existingKeywords.length} keywords`);
        
        // Append new entries
        existingData.keywords = [...existingKeywords, ...newEntries];
        
        // Keep only last 1000 entries per playlist to prevent unlimited growth
        if (existingData.keywords.length > 1000) {
          // Sort by timestamp and keep most recent
          existingData.keywords.sort((a: any, b: any) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          existingData.keywords = existingData.keywords.slice(0, 1000);
          console.log(`🔄 Trimmed to most recent 1000 keywords`);
        }
        
        // Save back
        await redis.hSet(playlistKey, 'data', JSON.stringify(existingData));
      }
    }
    
    // Save keyword history for trending (this is separate and fast)
    for (const keyword of validKeywords) {
      await saveKeywordHistory(
        playlistId,
        keyword.keyword,
        keyword.territory,
        keyword.position,
        keyword.userId,
        keyword.sessionId
      );
    }
    
    console.log(`✅ Successfully added rankings for ${name}`);
    
    const response = NextResponse.json({ success: true });
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
    
  } catch (error) {
    console.error('❌ Error in add-rankings:', error);
    const response = NextResponse.json(
      { error: 'Failed to add rankings' },
      { status: 500 }
    );
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }
}