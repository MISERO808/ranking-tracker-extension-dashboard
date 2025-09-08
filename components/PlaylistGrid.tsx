'use client';

import { useEffect, useState } from 'react';
import PlaylistCard from './PlaylistCard';
import { PlaylistData } from '@/lib/redis';

export default function PlaylistGrid() {
  const [playlists, setPlaylists] = useState<PlaylistData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchPlaylists(true);
    
    // Poll for updates every 5 seconds
    const interval = setInterval(() => {
      fetchPlaylists(false);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchPlaylists = async (isInitial = false) => {
    try {
      const response = await fetch('/api/playlists');
      if (!response.ok) throw new Error('Failed to fetch playlists');
      
      const data = await response.json();
      
      // Only update if data has changed
      const dataString = JSON.stringify(data);
      const currentString = JSON.stringify(playlists);
      if (dataString !== currentString) {
        setPlaylists(data);
      }
      
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="neu-card text-center py-16">
        <div className="neu-spinner mx-auto mb-6"></div>
        <p style={{ color: 'var(--text-secondary)' }}>Loading your playlists...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="neu-card text-center py-16">
        <div className="neu-inset inline-block p-4 rounded-full mb-6">
          <span className="text-6xl">⚠️</span>
        </div>
        <div className="text-xl mb-6" style={{ color: 'var(--error)' }}>Error: {error}</div>
        <button 
          onClick={() => fetchPlaylists(true)}
          className="neu-btn-primary"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Try Again
        </button>
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <div className="neu-card text-center py-16">
        <div className="neu-inset inline-block p-6 rounded-full mb-6">
          <span className="text-8xl">🎵</span>
        </div>
        <h2 className="text-3xl font-bold mb-4">No playlists tracked yet</h2>
        <p className="mb-2 max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Start using the browser extension to track your playlist rankings!
        </p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          The extension will automatically send data here when you search for your playlists on Spotify.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Status indicator */}
      {lastUpdated && (
        <div className="neu-badge-accent mx-auto mb-8 text-sm text-center w-fit flex items-center gap-2">
          <span className="animate-pulse">●</span> 
          Last updated: {lastUpdated.toLocaleTimeString()} • Auto-refreshing every 5s
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {playlists.map((playlist) => (
          <PlaylistCard key={playlist.id} playlist={playlist} />
        ))}
      </div>
    </div>
  );
}