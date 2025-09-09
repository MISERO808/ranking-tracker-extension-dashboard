'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PlaylistData } from '@/lib/redis';
import KeywordTableEnhanced from '@/components/KeywordTableEnhanced';

export default function PlaylistDetail() {
  const params = useParams();
  const playlistId = params.id as string;
  
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(null);
  // Use localStorage to persist country filter
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`country-filter-${playlistId}`) || '';
    }
    return '';
  });
  const [countryFilterInitialized, setCountryFilterInitialized] = useState(false);
  const [starredKeywords, setStarredKeywords] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [positionFilter, setPositionFilter] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [sortBy, setSortBy] = useState<'position-asc' | 'position-desc' | 'updated-asc' | 'updated-desc'>('position-asc');
  
  // Set selected territory same as country filter
  useEffect(() => {
    setSelectedTerritory(selectedCountryFilter);
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
      
      // Call DELETE endpoint to mark keyword as deleted
      const response = await fetch(`/api/playlists/${playlistId}/keywords/${encodeURIComponent(keywordToDelete)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete keyword');
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
      
      // Only set initial country filter if not already set
      if (!countryFilterInitialized && !selectedCountryFilter && data.keywords.length > 0) {
        const territories = Array.from(new Set(
          data.keywords
            .map((k: any) => k.territory?.toLowerCase().trim())
            .filter((t: any) => t && t !== 'unknown' && t.length === 2)
        )).sort();
        
        // Check if we have a stored preference
        const storedFilter = localStorage.getItem(`country-filter-${playlistId}`);
        if (storedFilter && territories.includes(storedFilter)) {
          setSelectedCountryFilter(storedFilter);
        } else if (territories.includes('de')) {
          const defaultValue = 'de';
          setSelectedCountryFilter(defaultValue);
          localStorage.setItem(`country-filter-${playlistId}`, defaultValue);
        } else if (territories.length > 0) {
          const defaultValue = territories[0] as string;
          setSelectedCountryFilter(defaultValue);
          localStorage.setItem(`country-filter-${playlistId}`, defaultValue);
        }
        setCountryFilterInitialized(true);
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
      <div className="min-h-screen py-8">
        <div className="container">
          <div className="neu-card text-center py-16">
            <div className="neu-spinner mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="min-h-screen py-8">
        <div className="container">
          <div className="neu-card text-center py-12">
            <div className="text-xl mb-4" style={{ color: 'var(--error)' }}>Error: {error}</div>
            <Link 
              href="/"
              className="neu-btn-primary"
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
        <div className="neu-card mb-8">
          <Link 
            href="/" 
            className="neu-btn mb-6 inline-flex"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
          
          <div className="flex items-start gap-8">
            <div className="neu-inset rounded-2xl overflow-hidden w-40 h-40 flex-shrink-0">
              {playlist.image && playlist.image !== '' ? (
                <img 
                  src={playlist.image}
                  alt={playlist.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg-color)' }}>
                  <svg className="w-16 h-16" style={{ color: 'var(--text-secondary)', opacity: 0.3 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <h1 className="text-5xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                {playlist.name}
              </h1>
              <div className="flex gap-8 mb-6" style={{ color: 'var(--text-secondary)' }}>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--lilac)' }}></span>
                  {new Set(playlist.keywords.map(k => k.keyword.toLowerCase().trim())).size} keywords tracked
                </span>
              </div>
              
              {/* Country Filter Dropdown */}
              <div className="mb-4">
                <label htmlFor="country-filter" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Filter by Country
                </label>
                <select 
                  id="country-filter"
                  value={selectedCountryFilter}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedCountryFilter(value);
                    localStorage.setItem(`country-filter-${playlistId}`, value);
                  }}
                  className="neu-select w-48"
                >
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
              
            </div>
          </div>
        </div>

        {/* Content */}
        <div>
          {/* Keyword Table */}
          <div>
            <KeywordTableEnhanced 
              keywords={playlist.keywords}
              onKeywordSelect={(keyword, territory) => {
                setSelectedKeyword(keyword);
                setSelectedTerritory(territory);
              }}
              selectedKeyword={selectedKeyword}
              selectedCountryFilter={selectedCountryFilter}
              starredKeywords={starredKeywords}
              onToggleStar={toggleStar}
              onDeleteKeyword={deleteKeyword}
              playlistId={playlist.id}
            />
          </div>
        </div>
      </div>
    </div>
  );
}