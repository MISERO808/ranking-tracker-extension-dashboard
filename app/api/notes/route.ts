import { NextResponse } from 'next/server';
import { getPlaylistNotes, createPlaylistNote } from '@/lib/redis';

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

    console.log(`GET /api/notes - Fetching notes for playlist ${playlistId}`);
    const notes = await getPlaylistNotes(playlistId);
    console.log(`GET /api/notes - Found ${notes.length} notes`);

    const response = NextResponse.json(notes);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    console.error('Error fetching notes:', error);
    const response = NextResponse.json(
      {
        error: 'Failed to fetch notes',
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
    const { playlistId, date, keyword, territory, timestamp, note } = await request.json();

    if (!playlistId || !date || !keyword || !territory || !timestamp || !note) {
      const response = NextResponse.json(
        { error: 'playlistId, date, keyword, territory, timestamp, and note are required' },
        { status: 400 }
      );
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    console.log(`POST /api/notes - Creating note for playlist ${playlistId} on ${date} at ${timestamp} (${keyword} / ${territory})`);
    const newNote = await createPlaylistNote(playlistId, date, keyword, territory, timestamp, note);
    console.log(`POST /api/notes - Note created with id ${newNote.id}`);

    const response = NextResponse.json(newNote);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    console.error('Error creating note:', error);
    const response = NextResponse.json(
      {
        error: 'Failed to create note',
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
