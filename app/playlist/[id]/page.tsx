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
      fetchPlaylist();
    }
  };

  useEffect(() => {
    fetchPlaylist();
  }, [playlistId]);

  const fetchPlaylist = async () => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Playlist not found');
        }
        throw new Error('Failed to fetch playlist');
      }
      
      const data = await response.json();
      setPlaylist(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-spotify-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/" 
            className="text-spotify-green hover:text-green-400 transition-colors mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          
          <div className="flex items-start gap-6">
            {playlist.image && (
              <img 
                src={playlist.image}
                alt={playlist.name}
                className="w-32 h-32 rounded-lg object-cover"
              />
            )}
            
            <div>
              <h1 className="text-4xl font-bold mb-2">{playlist.name}</h1>
              <div className="flex gap-6 text-spotify-gray">
                <span>{playlist.keywords.length} keywords tracked</span>
                <span>Last updated: {new Date(playlist.lastUpdated).toLocaleDateString()}</span>
              </div>
              
              {/* Country Filter Dropdown */}
              <div className="mt-4">
                <label htmlFor="country-filter" className="block text-sm font-medium text-spotify-gray mb-2">
                  Filter by Country
                </label>
                <select 
                  id="country-filter"
                  value={selectedCountryFilter}
                  onChange={(e) => setSelectedCountryFilter(e.target.value)}
                  className="bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-spotify-green"
                >
                  <option value="all">All Countries</option>
                  {Array.from(new Set(playlist.keywords.map(k => k.territory))).sort().map(territory => (
                    <option key={territory} value={territory}>
                      {territory.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Territories Display */}
              <div className="flex flex-wrap gap-2 mt-4">
                {Array.from(new Set(playlist.keywords.map(k => k.territory))).map(territory => (
                  <span 
                    key={territory}
                    className="px-3 py-1 bg-spotify-green bg-opacity-20 text-spotify-green text-sm rounded"
                  >
                    {territory.toUpperCase()}
                  </span>
                ))}
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
              <div className="bg-gray-800 rounded-lg p-6 h-96 flex items-center justify-center">
                <div className="text-center text-spotify-gray">
                  <div className="text-lg mb-2">📈</div>
                  <div>Select a keyword to view ranking history</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}