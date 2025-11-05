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

export interface PlaylistNote {
  id: string;
  playlistId: string;
  date: string; // ISO date string (YYYY-MM-DD)
  keyword: string; // Keyword where note was originally added
  territory: string; // Territory where note was originally added
  timestamp: string; // Full ISO timestamp of the specific data point
  note: string;
  createdAt: string;
  updatedAt: string;
}

// Redis operations
// Track deleted keywords
export async function getDeletedKeywords(playlistId: string): Promise<Set<string>> {
  const redis = await getRedisClient();
  const deletedData = await redis.hGet(`playlist:${playlistId}`, 'deleted_keywords');
  if (deletedData) {
    return new Set(JSON.parse(deletedData));
  }
  return new Set();
}

export async function addDeletedKeyword(playlistId: string, keyword: string) {
  const redis = await getRedisClient();
  const deleted = await getDeletedKeywords(playlistId);
  deleted.add(keyword.toLowerCase());
  await redis.hSet(`playlist:${playlistId}`, 'deleted_keywords', JSON.stringify(Array.from(deleted)));
}

export async function savePlaylistData(playlistId: string, data: PlaylistData) {
  const redis = await getRedisClient();
  
  console.log(`[Redis] Saving playlist ${playlistId} with ${data.keywords.length} keywords`);
  
  // Get existing playlist data to preserve historical rankings
  const existingData = await getPlaylistData(playlistId);
  
  // Get deleted keywords to filter them out
  const deletedKeywords = await getDeletedKeywords(playlistId);
  
  if (existingData) {
    console.log(`[Redis] Found existing data with ${existingData.keywords.length} keywords`);
    console.log(`[Redis] Deleted keywords: ${Array.from(deletedKeywords).join(', ') || 'none'}`);
    
    // SAFEGUARD: Prevent accidental mass deletion
    // If we're about to lose more than 50% of keywords, something is wrong
    if (data.keywords.length < existingData.keywords.length * 0.5 && existingData.keywords.length > 10) {
      console.error(`[Redis] SAFETY CHECK FAILED: Attempted to reduce keywords from ${existingData.keywords.length} to ${data.keywords.length}`);
      console.error(`[Redis] This would delete ${existingData.keywords.length - data.keywords.length} keywords (>50% loss)`);
      console.error(`[Redis] Blocking this operation to prevent data loss`);
      
      // Instead, merge the new keywords with existing ones
      console.log(`[Redis] Performing safe merge instead...`);
    }
    
    // DO NOT auto-detect deletions - only use explicitly deleted keywords
    // The extension doesn't send ALL keywords every time, just new ones
    
    // CRITICAL: Filter out invalid territories AND deleted keywords from existing data BEFORE merging
    const validExistingKeywords = existingData.keywords.filter(k => {
      // Check if keyword was deleted
      if (deletedKeywords.has(k.keyword.toLowerCase())) {
        console.log(`[Redis] Filtering out deleted keyword: "${k.keyword}"`);
        return false;
      }
      
      const territory = k.territory?.toLowerCase().trim();
      const isValid = territory && territory !== 'unknown' && territory.length === 2 && /^[a-z]{2}$/.test(territory);
      if (!isValid) {
        console.log(`[Redis] Filtering out invalid existing territory: "${k.territory}" for "${k.keyword}"`);
      }
      return isValid;
    });
    
    console.log(`[Redis] Filtered existing data: ${existingData.keywords.length} → ${validExistingKeywords.length} keywords`);
    
    // IMPORTANT: Preserve image from existing data if new data doesn't have it
    if (!data.image && existingData.image) {
      data.image = existingData.image;
      console.log(`[Redis] Preserving existing image: ${existingData.image}`);
    } else if (data.image) {
      console.log(`[Redis] Using new image: ${data.image}`);
    }
    
    // Merge new keywords with CLEANED existing ones
    // CRITICAL: Normalize territory to lowercase in the key to prevent duplicates like "DE" vs "de"
    const existingKeywordsMap = new Map(validExistingKeywords.map(k => 
      [`${k.keyword.toLowerCase()}-${k.territory.toLowerCase()}-${k.timestamp}`, k]
    ));
    
    console.log(`[Redis] Existing keywords map has ${existingKeywordsMap.size} entries`);
    
    // Add new keywords while preserving existing ones
    data.keywords.forEach(newKeyword => {
      // Check if this keyword was previously deleted
      if (deletedKeywords.has(newKeyword.keyword.toLowerCase())) {
        console.log(`[Redis] Skipping deleted keyword: "${newKeyword.keyword}"`);
        return; // Skip deleted keywords
      }
      
      // Validate new keyword territory too
      const territory = newKeyword.territory?.toLowerCase().trim();
      if (!territory || territory === 'unknown' || territory.length !== 2 || !/^[a-z]{2}$/.test(territory)) {
        console.log(`[Redis] Rejecting new keyword with invalid territory: "${newKeyword.territory}"`);
        return; // Skip this keyword
      }
      
      // CRITICAL: Normalize territory to lowercase in the key to prevent duplicates
      const key = `${newKeyword.keyword.toLowerCase()}-${territory}-${newKeyword.timestamp}`;
      existingKeywordsMap.set(key, {
        ...newKeyword,
        territory: territory // Ensure lowercase
      });
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
    
    // Filter out deleted keywords even for new data
    if (deletedKeywords.size > 0) {
      data.keywords = data.keywords.filter(k => {
        if (deletedKeywords.has(k.keyword.toLowerCase())) {
          console.log(`[Redis] Filtering out deleted keyword from new data: "${k.keyword}"`);
          return false;
        }
        return true;
      });
    }
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

// Notes operations
export async function getPlaylistNotes(playlistId: string): Promise<PlaylistNote[]> {
  const redis = await getRedisClient();
  const notesData = await redis.get(`notes:${playlistId}`);
  return notesData ? JSON.parse(notesData) : [];
}

export async function createPlaylistNote(playlistId: string, date: string, keyword: string, territory: string, timestamp: string, note: string): Promise<PlaylistNote> {
  const redis = await getRedisClient();
  const notes = await getPlaylistNotes(playlistId);

  const newNote: PlaylistNote = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    playlistId,
    date,
    keyword,
    territory,
    timestamp,
    note,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  notes.push(newNote);
  await redis.set(`notes:${playlistId}`, JSON.stringify(notes));

  return newNote;
}

export async function updatePlaylistNote(playlistId: string, noteId: string, noteText: string): Promise<PlaylistNote | null> {
  const redis = await getRedisClient();
  const notes = await getPlaylistNotes(playlistId);

  const noteIndex = notes.findIndex(n => n.id === noteId);
  if (noteIndex === -1) return null;

  notes[noteIndex].note = noteText;
  notes[noteIndex].updatedAt = new Date().toISOString();

  await redis.set(`notes:${playlistId}`, JSON.stringify(notes));

  return notes[noteIndex];
}

export async function deletePlaylistNote(playlistId: string, noteId: string): Promise<boolean> {
  const redis = await getRedisClient();
  const notes = await getPlaylistNotes(playlistId);

  const filteredNotes = notes.filter(n => n.id !== noteId);
  if (filteredNotes.length === notes.length) return false;

  await redis.set(`notes:${playlistId}`, JSON.stringify(filteredNotes));

  return true;
}