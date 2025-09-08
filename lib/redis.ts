import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL || process.env.KV_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD || undefined,
  socket: {
    tls: process.env.REDIS_URL?.startsWith('rediss://') || process.env.KV_URL?.startsWith('rediss://'),
  },
});

client.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

client.on('connect', () => {
  console.log('Redis Client Connected');
});

let isConnected = false;

export async function getRedisClient() {
  if (!isConnected) {
    try {
      await client.connect();
      isConnected = true;
      console.log('Redis connection established');
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }
  return client;
}

// Data types for our Spotify tracking
export interface PlaylistData {
  id: string;
  name: string;
  image?: string;
  keywords: KeywordRanking[];
  lastUpdated: string;
}

export interface KeywordRanking {
  keyword: string;
  position: number;
  territory: string;
  timestamp: string;
  trend?: 'up' | 'down' | 'stable';
  userId?: string; // User/account ID who pulled this ranking
  sessionId?: string; // Session ID for grouping related searches
}

export interface KeywordHistory {
  keyword: string;
  territory: string;
  rankings: Array<{
    position: number;
    timestamp: string;
  }>;
}

// Redis operations
export async function savePlaylistData(playlistId: string, data: PlaylistData) {
  const redis = await getRedisClient();
  
  console.log(`[Redis] Saving playlist ${playlistId} with ${data.keywords.length} keywords`);
  
  // Get existing playlist data to preserve historical rankings
  const existingData = await getPlaylistData(playlistId);
  
  if (existingData) {
    console.log(`[Redis] Found existing data with ${existingData.keywords.length} keywords`);
    
    // Merge new keywords with existing ones, keeping all historical data
    // CRITICAL: Normalize territory to lowercase in the key to prevent duplicates like "DE" vs "de"
    const existingKeywordsMap = new Map(existingData.keywords.map(k => 
      [`${k.keyword.toLowerCase()}-${k.territory.toLowerCase()}-${k.timestamp}`, k]
    ));
    
    console.log(`[Redis] Existing keywords map has ${existingKeywordsMap.size} entries`);
    
    // Add new keywords while preserving existing ones
    data.keywords.forEach(newKeyword => {
      // CRITICAL: Normalize territory to lowercase in the key to prevent duplicates
      const key = `${newKeyword.keyword.toLowerCase()}-${newKeyword.territory.toLowerCase()}-${newKeyword.timestamp}`;
      existingKeywordsMap.set(key, newKeyword);
    });
    
    console.log(`[Redis] After merge, map has ${existingKeywordsMap.size} entries`);
    
    // Update the data with all keywords (historical + new)
    data.keywords = Array.from(existingKeywordsMap.values());
    console.log(`[Redis] Final keyword count: ${data.keywords.length}`);
    
    // DEBUG: Show date distribution
    const dateDistribution = data.keywords.reduce((acc, k) => {
      const date = new Date(k.timestamp).toISOString().split('T')[0];
      if (!acc[date]) acc[date] = 0;
      acc[date]++;
      return acc;
    }, {} as { [date: string]: number });
    console.log(`[Redis] Keywords by date:`, dateDistribution);
  } else {
    console.log(`[Redis] No existing data found, saving ${data.keywords.length} keywords`);
  }
  
  await redis.hSet(`playlist:${playlistId}`, 'data', JSON.stringify(data));
  console.log(`[Redis] Successfully saved playlist ${playlistId}`);
}

export async function getPlaylistData(playlistId: string): Promise<PlaylistData | null> {
  const redis = await getRedisClient();
  const data = await redis.hGet(`playlist:${playlistId}`, 'data');
  return data ? JSON.parse(data) : null;
}

export async function getAllPlaylists(): Promise<PlaylistData[]> {
  const redis = await getRedisClient();
  const keys = await redis.keys('playlist:*');
  const playlists: PlaylistData[] = [];
  
  for (const key of keys) {
    const data = await redis.hGet(key, 'data');
    if (data) {
      playlists.push(JSON.parse(data));
    }
  }
  
  return playlists;
}

export async function saveKeywordHistory(playlistId: string, keyword: string, territory: string, position: number, userId?: string, sessionId?: string) {
  const redis = await getRedisClient();
  const key = `history:${playlistId}:${keyword}:${territory}`;
  const timestamp = new Date().toISOString();
  
  await redis.lPush(key, JSON.stringify({ 
    position, 
    timestamp,
    userId,
    sessionId 
  }));
  
  // Keep only last 100 entries
  await redis.lTrim(key, 0, 99);
}

export async function getKeywordHistory(playlistId: string, keyword: string, territory: string): Promise<KeywordHistory> {
  const redis = await getRedisClient();
  const key = `history:${playlistId}:${keyword}:${territory}`;
  const historyData = await redis.lRange(key, 0, -1);
  
  const rankings = historyData.map(data => JSON.parse(data)).reverse();
  
  return {
    keyword,
    territory,
    rankings
  };
}