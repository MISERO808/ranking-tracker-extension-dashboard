import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD || undefined,
});

client.on('error', (err) => console.log('Redis Client Error', err));

let isConnected = false;

export async function getRedisClient() {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
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
  await redis.hSet(`playlist:${playlistId}`, 'data', JSON.stringify(data));
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

export async function saveKeywordHistory(playlistId: string, keyword: string, territory: string, position: number) {
  const redis = await getRedisClient();
  const key = `history:${playlistId}:${keyword}:${territory}`;
  const timestamp = new Date().toISOString();
  
  await redis.lPush(key, JSON.stringify({ position, timestamp }));
  
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