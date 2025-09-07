import { NextResponse } from 'next/server';
import { getKeywordHistory } from '@/lib/redis';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playlistId = searchParams.get('playlistId');
  const keyword = searchParams.get('keyword');
  const territory = searchParams.get('territory');

  if (!playlistId || !keyword || !territory) {
    return NextResponse.json({ 
      error: 'Missing required parameters: playlistId, keyword, territory' 
    }, { status: 400 });
  }

  try {
    const history = await getKeywordHistory(playlistId, keyword, territory);
    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching keyword history:', error);
    return NextResponse.json({ error: 'Failed to fetch keyword history' }, { status: 500 });
  }
}