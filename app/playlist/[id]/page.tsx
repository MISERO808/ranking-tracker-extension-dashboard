'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PlaylistData } from '@/lib/redis';
import KeywordTable from '@/components/KeywordTable';
import KeywordChart from '@/components/KeywordChart';

export default function PlaylistDetail() {
  const params = useParams();
  const playlistId = params.id as string;
  
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(null);
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>('all');
  const [starredKeywords, setStarredKeywords] = useState<string[]>([]);
  
  // Update selected territory when country filter changes
  useEffect(() => {
    if (selectedCountryFilter !== 'all') {
      setSelectedTerritory(selectedCountryFilter);
    }
  }, [selectedCountryFilter]);
  
  // Load starred keywords from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`starred-keywords-${playlistId}`);
    if (stored) {
      setStarredKeywords(JSON.parse(stored));
    }
  }, [playlistId]);
  
  const toggleStar = (keyword: string) => {
    const newStarred = starredKeywords.includes(keyword)
      ? starredKeywords.filter(k => k !== keyword)
      : [...starredKeywords, keyword];
    
    setStarredKeywords(newStarred);
    localStorage.setItem(`starred-keywords-${playlistId}`, JSON.stringify(newStarred));
  };
  
  const deleteKeyword = async (keywordToDelete: string) => {
    if (!confirm(`Are you sure you want to delete all entries for "${keywordToDelete}"?`)) {
      return;
    }
    
    try {
      // Remove from local state immediately for better UX
      const updatedPlaylist = {
        ...playlist!,
        keywords: playlist!.keywords.filter(k => k.keyword.toLowerCase() !== keywordToDelete.toLowerCase())
      };
      setPlaylist(updatedPlaylist);
      
      // Remove from starred keywords if it was starred
      const newStarred = starredKeywords.filter(k => k.toLowerCase() !== keywordToDelete.toLowerCase());
      setStarredKeywords(newStarred);
      localStorage.setItem(`starred-keywords-${playlistId}`, JSON.stringify(newStarred));
      
      // Update the server
      const response = await fetch(`/api/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPlaylist)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update playlist');
      }
    } catch (error) {
      console.error('Error deleting keyword:', error);
      alert('Failed to delete keyword. Please try again.');
      // Refresh the playlist to get the correct state
      fetchPlaylist(false);
    }
  };

  useEffect(() => {
    fetchPlaylist(true);
    
    // Poll for updates every 5 seconds
    const interval = setInterval(() => {
      fetchPlaylist(false);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [playlistId]);

  const fetchPlaylist = async (isInitial = false) => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Playlist not found');
        }
        throw new Error('Failed to fetch playlist');
      }
      
      const data = await response.json();
      
      // Only update if data has changed
      const dataString = JSON.stringify(data);
      const currentString = JSON.stringify(playlist);
      if (dataString !== currentString) {
        setPlaylist(data);
      }
      
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
      <div className="min-h-screen bg-spotify-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center min-h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-spotify-green"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="min-h-screen bg-spotify-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="text-red-500 mb-4">Error: {error}</div>
            <Link 
              href="/"
              className="px-4 py-2 bg-spotify-green text-black rounded hover:bg-green-400 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container">
        {/* Header */}
        <div className="card mb-8">
          <Link 
            href="/" 
            className="btn btn-secondary mb-6 w-fit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
          
          <div className="flex items-start gap-8">
            {playlist.image && (
              <div className="relative">
                <img 
                  src={playlist.image}
                  alt={playlist.name}
                  className="w-40 h-40 rounded-2xl object-cover shadow-2xl"
                />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/20 to-transparent" />
              </div>
            )}
            
            <div className="flex-1">
              <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
                {playlist.name}
              </h1>
              <div className="flex gap-8 text-gray-300 mb-6">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  {playlist.keywords.length} keywords tracked
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                  Last updated: {new Date(playlist.lastUpdated).toLocaleDateString()}
                </span>
              </div>
              
              {/* Country Filter Dropdown */}
              <div className="mb-4">
                <label htmlFor="country-filter" className="block text-sm font-medium text-gray-400 mb-2">
                  Filter by Country
                </label>
                <select 
                  id="country-filter"
                  value={selectedCountryFilter}
                  onChange={(e) => setSelectedCountryFilter(e.target.value)}
                  className="glass rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-400 w-48"
                >
                  <option value="all">All Countries</option>
                  {(() => {
                    const territories = Array.from(new Set(
                      playlist.keywords
                        .map(k => k.territory?.toLowerCase().trim())
                        .filter(t => t && t !== 'unknown' && t.length === 2) // Only valid 2-letter codes
                    )).sort();
                    return territories.map(territory => (
                      <option key={territory} value={territory}>
                        {territory.toUpperCase()}
                      </option>
                    ));
                  })()}
                </select>
              </div>
              
              {/* Territories Display */}
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const territories = Array.from(new Set(
                    playlist.keywords
                      .map(k => k.territory?.toLowerCase().trim())
                      .filter(t => t && t !== 'unknown' && t.length === 2) // Only valid 2-letter codes
                  )).sort();
                  return territories.map(territory => (
                    <span 
                      key={territory}
                      className="glass-bright px-3 py-1 text-sm rounded-full font-medium"
                    >
                      {territory.toUpperCase()}
                    </span>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Keyword Table */}
          <div className="lg:col-span-2">
            <KeywordTable 
              keywords={playlist.keywords}
              onKeywordSelect={(keyword, territory) => {
                setSelectedKeyword(keyword);
                setSelectedTerritory(territory);
              }}
              selectedKeyword={selectedKeyword}
              selectedCountryFilter={selectedCountryFilter === 'all' ? undefined : selectedCountryFilter}
              starredKeywords={starredKeywords}
              onToggleStar={toggleStar}
              onDeleteKeyword={deleteKeyword}
              playlistId={playlist.id}
            />
          </div>

          {/* Chart */}
          <div className="lg:col-span-1">
            {selectedKeyword && selectedTerritory ? (
              <KeywordChart 
                playlistId={playlist.id}
                keyword={selectedKeyword}
                territory={selectedTerritory}
                allKeywords={playlist.keywords}
              />
            ) : (
              <div className="card h-96 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">📈</div>
                  <div className="text-gray-400 text-lg">Select a keyword to view ranking history</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}