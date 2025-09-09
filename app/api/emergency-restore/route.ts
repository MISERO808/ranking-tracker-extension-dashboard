import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export async function POST(request: Request) {
  try {
    const redis = await getRedisClient();
    
    // Get all playlist keys
    const keys = await redis.keys('playlist:*');
    
    let restoredCount = 0;
    
    for (const key of keys) {
      // Remove the deleted_keywords field from each playlist
      const deleted = await redis.hDel(key, 'deleted_keywords');
      if (deleted) {
        console.log(`[RESTORE] Cleared deleted keywords for ${key}`);
        restoredCount++;
      }
    }
    
    console.log(`[RESTORE] Emergency restore complete. Cleared deleted keywords from ${restoredCount} playlists`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Restored ${restoredCount} playlists`,
      clearedPlaylists: restoredCount
    });
  } catch (error) {
    console.error('Emergency restore error:', error);
    return NextResponse.json(
      { error: 'Failed to restore', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}