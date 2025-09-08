'use client';

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

interface DeduplicatedKeyword extends KeywordRanking {
  territories: string[];
  allRankings: KeywordRanking[];
  normalizedKeyword: string;
  previousPosition?: number;
  trend?: 'up' | 'down' | 'stable' | 'new';
  change?: number;
}

const getTrendIcon = (trend?: 'up' | 'down' | 'stable' | 'new', change?: number) => {
  switch (trend) {
    case 'up': return <span style={{ color: 'var(--lilac)' }}>↑{change ? Math.abs(change) : ''}</span>;
    case 'down': return <span style={{ color: 'var(--lilac)' }}>↓{change ? Math.abs(change) : ''}</span>;
    case 'stable': return <span style={{ color: 'var(--lilac)' }}>→</span>;
    case 'new': return <span style={{ color: 'var(--lilac)' }}>✨</span>;
    default: return null;
  }
};

export default function KeywordTable({ 
  keywords, 
  onKeywordSelect, 
  selectedKeyword, 
  selectedCountryFilter,
  onToggleStar,
  onDeleteKeyword,
  starredKeywords = [],
  playlistId
}: KeywordTableProps) {
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

  // Group keywords by normalized keyword text (case-insensitive)
  const keywordGroups = keywords.reduce((acc, ranking) => {
    const normalizedKey = ranking.keyword.toLowerCase().trim();
    if (!acc[normalizedKey]) {
      acc[normalizedKey] = [];
    }
    acc[normalizedKey].push(ranking);
    return acc;
  }, {} as { [keyword: string]: KeywordRanking[] });

  // For each unique keyword, get the latest/best ranking for display
  const deduplicatedKeywords: DeduplicatedKeyword[] = Object.entries(keywordGroups).map(([normalizedKey, rankings]) => {
    // Filter out invalid territories and apply country filter
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
    
    // Sort by timestamp to get the most recent ranking
    const sortedRankings = [...filteredRankings].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    const displayRanking = sortedRankings[0]; // Use most recent
    const territories = Array.from(new Set(rankings.map(r => r.territory.toLowerCase())));
    
    // Use the most common capitalization for display
    const capitalizations = rankings.map(r => r.keyword);
    const displayKeyword = capitalizations.reduce((acc, curr) => 
      capitalizations.filter(k => k === curr).length > 
      capitalizations.filter(k => k === acc).length ? curr : acc
    );
    
    // Calculate trend by comparing with previous data point
    const previousRanking = sortedRankings[1];
    let trend: 'up' | 'down' | 'stable' | 'new' = 'new';
    let change = 0;
    
    if (previousRanking) {
      change = previousRanking.position - displayRanking.position;
      if (change > 0) trend = 'up';
      else if (change < 0) trend = 'down';
      else trend = 'stable';
    }
    
    return {
      ...displayRanking,
      keyword: displayKeyword, // Use normalized display keyword
      territories,
      allRankings: rankings, // Keep all rankings for history
      normalizedKeyword: normalizedKey, // Store normalized version for comparisons
      previousPosition: previousRanking?.position,
      trend,
      change
    };
  }).filter(Boolean) as DeduplicatedKeyword[];

  // Separate starred and regular keywords
  const starredKeywordsList = deduplicatedKeywords.filter(k => 
    starredKeywords.some(starred => starred.toLowerCase() === k.normalizedKeyword)
  );
  const regularKeywords = deduplicatedKeywords.filter(k => 
    !starredKeywords.some(starred => starred.toLowerCase() === k.normalizedKeyword)
  );
  
  // Sort each group by position (best first), then by most recent timestamp
  const sortKeywords = (keywords: DeduplicatedKeyword[]) => 
    keywords.sort((a: DeduplicatedKeyword, b: DeduplicatedKeyword) => {
      if (a.position !== b.position) return a.position - b.position;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  
  const sortedStarredKeywords = sortKeywords([...starredKeywordsList]);
  const sortedRegularKeywords = sortKeywords([...regularKeywords]);

  const renderKeywordRow = (keyword: DeduplicatedKeyword) => {
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
        
        <td className="py-4 px-4 font-medium">
          <Link 
            href={`/keyword/${playlistId}/${encodeURIComponent(keyword.keyword)}`}
            className="hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-primary)' }}
          >
            {keyword.keyword}
          </Link>
        </td>
        
        <td className="py-4 px-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {new Date(keyword.timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </td>
        
        <td className="py-4 px-4">
          <div className="flex items-center gap-3">
            <button 
              className={`text-lg hover:scale-110 transition-transform ${
                isStarred 
                  ? 'text-yellow-400' 
                  : 'opacity-50 hover:opacity-100'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar?.(keyword.keyword);
              }}
              title={isStarred ? 'Remove star' : 'Add star'}
              style={{ color: isStarred ? '#facc15' : 'var(--text-secondary)' }}
            >
              {isStarred ? '★' : '☆'}
            </button>
            
            <Link 
              href={`/keyword/${playlistId}/${encodeURIComponent(keyword.keyword)}`}
              className="transition-opacity hover:opacity-70"
              style={{ color: 'var(--lilac)' }}
              title="View detailed history"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </Link>
            
            <button 
              className="transition-opacity hover:opacity-70"
              style={{ color: 'var(--error)' }}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteKeyword?.(keyword.keyword);
              }}
              title="Delete keyword"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="neu-card">
      <h2 className="text-xl font-semibold mb-4">Keywords</h2>
      
      {starredKeywordsList.length > 0 && (
        <>
          <h3 className="font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
            ⭐ Starred ({starredKeywordsList.length})
          </h3>
          <div className="overflow-x-auto mb-6">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--shadow-dark)' }}>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Position</th>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Keyword</th>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Last Updated</th>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedStarredKeywords.map(renderKeywordRow)}
              </tbody>
            </table>
          </div>
        </>
      )}
      
      <h3 className="font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
        Keywords ({regularKeywords.length})
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--shadow-dark)' }}>
              <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Position</th>
              <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Keyword</th>
              <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Last Updated</th>
              <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedRegularKeywords.map(renderKeywordRow)}
          </tbody>
        </table>
      </div>
    </div>
  );
}