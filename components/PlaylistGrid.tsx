'use client';

import { useEffect, useState } from 'react';
import PlaylistCard from './PlaylistCard';
import { PlaylistData } from '@/lib/redis';

export default function PlaylistGrid() {
  const [playlists, setPlaylists] = useState<PlaylistData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async () => {
    try {
      const response = await fetch('/api/playlists');
      if (!response.ok) throw new Error('Failed to fetch playlists');
      
      const data = await response.json();
      setPlaylists(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-spotify-green"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">Error: {error}</div>
        <button 
          onClick={fetchPlaylists}
          className="px-4 py-2 bg-spotify-green text-black rounded hover:bg-green-400 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-spotify-gray mb-4">
          No playlists tracked yet. Start using the browser extension to track your playlist rankings!
        </div>
        <div className="text-sm text-spotify-gray">
          The extension will automatically send data here when you search for your playlists on Spotify.
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {playlists.map((playlist) => (
        <PlaylistCard key={playlist.id} playlist={playlist} />
      ))}
    </div>
  );
}