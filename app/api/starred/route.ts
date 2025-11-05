import { NextResponse } from 'next/server';
import { getStarredKeywords, toggleStarredKeyword } from '@/lib/redis';

// Add CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playlistId = searchParams.get('playlistId');

    if (!playlistId) {
      const response = NextResponse.json(
        { error: 'playlistId is required' },
        { status: 400 }
      );
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    const starred = await getStarredKeywords(playlistId);

    const response = NextResponse.json({ starred });
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    console.error('Error fetching starred keywords:', error);
    const response = NextResponse.json(
      {
        error: 'Failed to fetch starred keywords',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );

    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }
}

export async function POST(request: Request) {
  try {
    const { playlistId, keyword } = await request.json();

    if (!playlistId || !keyword) {
      const response = NextResponse.json(
        { error: 'playlistId and keyword are required' },
        { status: 400 }
      );
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    const starred = await toggleStarredKeyword(playlistId, keyword);

    const response = NextResponse.json({ starred });
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    console.error('Error toggling starred keyword:', error);
    const response = NextResponse.json(
      {
        error: 'Failed to toggle starred keyword',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );

    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }
}
