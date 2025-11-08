import { NextResponse } from 'next/server';
import { getPlaylistData } from '@/lib/redis';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const playlistId = params.id;
    const playlist = await getPlaylistData(playlistId);

    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }

    // Group keywords by keyword+territory
    const trendData: {
      [key: string]: {
        keyword: string;
        territory: string;
        currentPosition: number;
        previousPosition: number | null;
        timestamp: string;
        previousTimestamp: string | null;
      };
    } = {};

    // Sort all keywords by timestamp (most recent first)
    const sortedKeywords = [...playlist.keywords].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Process each keyword to get current and previous position
    sortedKeywords.forEach((ranking) => {
      const key = `${ranking.keyword.toLowerCase()}-${ranking.territory.toLowerCase()}`;

      if (!trendData[key]) {
        // This is the most recent ranking (current position)
        trendData[key] = {
          keyword: ranking.keyword,
          territory: ranking.territory,
          currentPosition: ranking.position,
          previousPosition: null,
          timestamp: ranking.timestamp,
          previousTimestamp: null,
        };
      } else if (trendData[key].previousPosition === null) {
        // This is the second most recent (previous position)
        trendData[key].previousPosition = ranking.position;
        trendData[key].previousTimestamp = ranking.timestamp;
      }
    });

    // Convert to array format
    const trends = Object.values(trendData);

    return NextResponse.json({ trends });
  } catch (error) {
    console.error('Error fetching trends:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trends' },
      { status: 500 }
    );
  }
}
