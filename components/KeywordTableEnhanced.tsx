'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { KeywordRanking } from '@/lib/redis';

interface KeywordTableProps {
  keywords: KeywordRanking[];
  onKeywordSelect: (keyword: string, territory: string) => void;
  selectedKeyword: string | null;
  selectedCountryFilter: string | null;
  onToggleStar?: (keyword: string) => void;
  onDeleteKeyword?: (keyword: string) => void;
  starredKeywords?: string[];
  playlistId: string;
}

interface DeduplicatedKeyword extends Omit<KeywordRanking, 'trend'> {
  territories: string[];
  allRankings: KeywordRanking[];
  normalizedKeyword: string;
  previousPosition?: number;
  trend?: 'up' | 'down' | 'stable' | 'new';
  change?: number;
}

type SortOption = 'alphabetical-asc' | 'alphabetical-desc' | 'position-asc' | 'position-desc' | 'updated-asc' | 'updated-desc';

const getTrendIcon = (trend?: 'up' | 'down' | 'stable' | 'new', change?: number) => {
  switch (trend) {
    case 'up': return <span style={{ color: 'var(--lilac)' }}>↑{change ? Math.abs(change) : ''}</span>;
    case 'down': return <span style={{ color: 'var(--lilac)' }}>↓{change ? Math.abs(change) : ''}</span>;
    case 'stable': return <span style={{ color: 'var(--lilac)' }}>→</span>;
    case 'new': return <span style={{ color: 'var(--lilac)' }}>✨</span>;
    default: return null;
  }
};

export default function KeywordTableEnhanced({ 
  keywords, 
  onKeywordSelect, 
  selectedKeyword, 
  selectedCountryFilter,
  onToggleStar,
  onDeleteKeyword,
  starredKeywords = [],
  playlistId
}: KeywordTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('position-asc');

  const processedKeywords = useMemo(() => {
    // Group keywords by normalized keyword text
    const keywordGroups = keywords.reduce((acc, ranking) => {
      const normalizedKey = ranking.keyword.toLowerCase().trim();
      if (!acc[normalizedKey]) {
        acc[normalizedKey] = [];
      }
      acc[normalizedKey].push(ranking);
      return acc;
    }, {} as { [keyword: string]: KeywordRanking[] });

    // Process each unique keyword
    const deduplicatedKeywords: DeduplicatedKeyword[] = Object.entries(keywordGroups).map(([normalizedKey, rankings]) => {
      // Filter territories and apply country filter
      let filteredRankings = rankings.filter(r => {
        const territory = r.territory?.toLowerCase().trim();
        return territory && territory !== 'unknown' && territory.length === 2;
      });
      
      if (selectedCountryFilter) {
        filteredRankings = filteredRankings.filter(r => 
          r.territory?.toLowerCase().trim() === selectedCountryFilter.toLowerCase()
        );
      }
      
      if (filteredRankings.length === 0) return null;
      
      // Sort by timestamp to get the most recent
      const sortedRankings = [...filteredRankings].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      const displayRanking = sortedRankings[0];
      const territories = Array.from(new Set(rankings.map(r => r.territory.toLowerCase())));
      
      // Get display keyword
      const capitalizations = rankings.map(r => r.keyword);
      const displayKeyword = capitalizations.reduce((acc, curr) => 
        capitalizations.filter(k => k === curr).length > 
        capitalizations.filter(k => k === acc).length ? curr : acc
      );
      
      // Calculate trend
      const previousRanking = sortedRankings[1];
      let trend: 'up' | 'down' | 'stable' | 'new' = 'new';
      let change = 0;
      
      if (previousRanking) {
        change = previousRanking.position - displayRanking.position;
        trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
      }
      
      return {
        ...displayRanking,
        keyword: displayKeyword,
        territories,
        allRankings: rankings,
        normalizedKeyword: normalizedKey,
        previousPosition: previousRanking?.position,
        trend,
        change
      };
    }).filter(Boolean) as DeduplicatedKeyword[];

    // Apply search filter
    let filtered = deduplicatedKeywords;
    if (searchTerm) {
      filtered = filtered.filter(k => 
        k.keyword.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      // Always show starred keywords first
      const aStarred = starredKeywords.includes(a.normalizedKeyword);
      const bStarred = starredKeywords.includes(b.normalizedKeyword);
      if (aStarred !== bStarred) return aStarred ? -1 : 1;
      
      switch(sortBy) {
        case 'alphabetical-asc':
          return a.keyword.localeCompare(b.keyword);
        case 'alphabetical-desc':
          return b.keyword.localeCompare(a.keyword);
        case 'position-asc':
          return a.position - b.position;
        case 'position-desc':
          return b.position - a.position;
        case 'updated-asc':
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        case 'updated-desc':
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [keywords, selectedCountryFilter, searchTerm, sortBy, starredKeywords]);

  if (keywords.length === 0) {
    return (
      <div className="neu-card">
        <h2 className="text-xl font-semibold mb-4">Keywords</h2>
        <div className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
          No keywords tracked for this playlist yet.
        </div>
      </div>
    );
  }

  return (
    <div className="neu-card">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Keywords</h2>
        
        {/* Search and Sort Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Search Input */}
          <div className="flex-1">
            <div className="neu-flat flex items-center gap-3 px-4 py-3">
              <svg className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search keywords..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent outline-none flex-1"
                style={{ color: 'var(--text-primary)' }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="transition-opacity hover:opacity-70"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          {/* Sort Dropdown */}
          <div className="md:w-64">
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="neu-select w-full"
            >
              <option value="position-asc">Position: Best First</option>
              <option value="position-desc">Position: Worst First</option>
              <option value="alphabetical-asc">Alphabetical: A-Z</option>
              <option value="alphabetical-desc">Alphabetical: Z-A</option>
              <option value="updated-desc">Updated: Newest First</option>
              <option value="updated-asc">Updated: Oldest First</option>
            </select>
          </div>
        </div>
        
        {/* Results Count */}
        {searchTerm && (
          <div className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Found {processedKeywords.length} keyword{processedKeywords.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--shadow-color)' }}>
              <th className="text-left py-3 px-4" style={{ color: 'var(--text-secondary)' }}>Position</th>
              <th className="text-left py-3 px-4" style={{ color: 'var(--text-secondary)' }}>Keyword</th>
              <th className="text-left py-3 px-4" style={{ color: 'var(--text-secondary)' }}>Territories</th>
              <th className="text-left py-3 px-4" style={{ color: 'var(--text-secondary)' }}>Last Updated</th>
              <th className="text-left py-3 px-4" style={{ color: 'var(--text-secondary)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {processedKeywords.map(keyword => {
              const isSelected = selectedKeyword === keyword.keyword;
              const isStarred = starredKeywords.some(starred => starred.toLowerCase() === keyword.normalizedKeyword);
              
              return (
                <tr 
                  key={keyword.normalizedKeyword}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'neu-inset' : ''
                  }`}
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold" style={{ color: 'var(--lilac)' }}>
                        #{keyword.position}
                      </span>
                      {getTrendIcon(keyword.trend, keyword.change)}
                    </div>
                  </td>
                  <td 
                    className="py-4 px-4"
                    onClick={() => onKeywordSelect(keyword.keyword, keyword.territory)}
                  >
                    <div className="flex items-center gap-2">
                      {isStarred && <span>⭐</span>}
                      <span className="font-medium">{keyword.keyword}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex gap-1 flex-wrap">
                      {keyword.territories.slice(0, 5).map(territory => (
                        <span 
                          key={territory}
                          className="neu-flat px-2 py-1 text-xs rounded"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {territory.toUpperCase()}
                        </span>
                      ))}
                      {keyword.territories.length > 5 && (
                        <span 
                          className="neu-flat px-2 py-1 text-xs rounded"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          +{keyword.territories.length - 5}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(keyword.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      {onToggleStar && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleStar(keyword.normalizedKeyword);
                          }}
                          className="transition-opacity hover:opacity-70"
                          style={{ color: isStarred ? '#fbbf24' : 'var(--text-secondary)' }}
                        >
                          <svg className="w-5 h-5" fill={isStarred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                      )}
                      
                      <Link
                        href={`/keyword/${playlistId}/${encodeURIComponent(keyword.keyword)}`}
                        className="transition-opacity hover:opacity-70"
                        style={{ color: 'var(--lilac)' }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </Link>
                      
                      <a
                        href={`https://open.spotify.com/search/${encodeURIComponent(keyword.keyword)}/playlists`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-opacity hover:opacity-70"
                        style={{ color: '#1DB954' }}
                        title="Search on Spotify (Playlists)"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </a>
                      
                      {onDeleteKeyword && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteKeyword(keyword.keyword);
                          }}
                          className="transition-opacity hover:opacity-70"
                          style={{ color: 'var(--error)' }}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}