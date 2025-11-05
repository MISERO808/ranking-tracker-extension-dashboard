import { NextResponse } from 'next/server';
import { updatePlaylistNote, deletePlaylistNote } from '@/lib/redis';

// Add CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { playlistId, note } = await request.json();
    const noteId = params.id;

    if (!playlistId || !note) {
      const response = NextResponse.json(
        { error: 'playlistId and note are required' },
        { status: 400 }
      );
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    console.log(`PUT /api/notes/${noteId} - Updating note for playlist ${playlistId}`);
    const updatedNote = await updatePlaylistNote(playlistId, noteId, note);

    if (!updatedNote) {
      const response = NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    console.log(`PUT /api/notes/${noteId} - Note updated successfully`);
    const response = NextResponse.json(updatedNote);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    console.error('Error updating note:', error);
    const response = NextResponse.json(
      {
        error: 'Failed to update note',
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

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const playlistId = searchParams.get('playlistId');
    const noteId = params.id;

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

    console.log(`DELETE /api/notes/${noteId} - Deleting note for playlist ${playlistId}`);
    const success = await deletePlaylistNote(playlistId, noteId);

    if (!success) {
      const response = NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    console.log(`DELETE /api/notes/${noteId} - Note deleted successfully`);
    const response = NextResponse.json({ success: true });
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    console.error('Error deleting note:', error);
    const response = NextResponse.json(
      {
        error: 'Failed to delete note',
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
