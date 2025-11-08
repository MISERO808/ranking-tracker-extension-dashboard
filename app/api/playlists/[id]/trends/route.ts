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
    const keywordGroups: {
      [key: string]: Array<{
        keyword: string;
        territory: string;
        position: number;
        timestamp: string;
      }>;
    } = {};

    // Group all rankings by keyword+territory
    playlist.keywords.forEach((ranking) => {
      const key = `${ranking.keyword.toLowerCase()}-${ranking.territory.toLowerCase()}`;
      if (!keywordGroups[key]) {
        keywordGroups[key] = [];
      }
      keywordGroups[key].push({
        keyword: ranking.keyword,
        territory: ranking.territory,
        position: ranking.position,
        timestamp: ranking.timestamp,
      });
    });

    // For each group, get the two most recent rankings
    const trends = Object.values(keywordGroups).map((rankings) => {
      // Sort by timestamp (most recent first)
      const sorted = rankings.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      const current = sorted[0];
      const previous = sorted[1];

      return {
        keyword: current.keyword,
        territory: current.territory,
        currentPosition: current.position,
        previousPosition: previous?.position || null,
        timestamp: current.timestamp,
        previousTimestamp: previous?.timestamp || null,
      };
    });

    return NextResponse.json({ trends });
  } catch (error) {
    console.error('Error fetching trends:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trends' },
      { status: 500 }
    );
  }
}
