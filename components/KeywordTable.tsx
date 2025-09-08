'use client';

import Link from 'next/link';
import { KeywordRanking } from '@/lib/redis';

interface KeywordTableProps {
  keywords: KeywordRanking[];
  onKeywordSelect: (keyword: string, territory: string) => void;
  selectedKeyword: string | null;
  selectedCountryFilter?: string;
  starredKeywords?: string[];
  onToggleStar?: (keyword: string) => void;
  onDeleteKeyword?: (keyword: string) => void;
  playlistId: string;
}

interface DeduplicatedKeyword extends KeywordRanking {
  territories: string[];
  allRankings: KeywordRanking[];
  normalizedKeyword: string;
}

const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
  switch (trend) {
    case 'up': return <span className="text-green-500">↑</span>;
    case 'down': return <span className="text-red-500">↓</span>;
    case 'stable': return <span className="text-yellow-500">→</span>;
    default: return null;
  }
};

export default function KeywordTable({ 
  keywords, 
  onKeywordSelect, 
  selectedKeyword,
  selectedCountryFilter,
  starredKeywords = [],
  onToggleStar,
  onDeleteKeyword,
  playlistId
}: KeywordTableProps) {
  if (keywords.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Keywords</h2>
        <div className="text-center py-8 text-spotify-gray">
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
    
    if (selectedCountryFilter && selectedCountryFilter !== 'all') {
      filteredRankings = filteredRankings.filter(r => 
        r.territory?.toLowerCase().trim() === selectedCountryFilter.toLowerCase()
      );
    }
      
    if (filteredRankings.length === 0) return null;
    
    // Sort by timestamp (most recent first) then by best position
    const sortedRankings = filteredRankings.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      if (timeA !== timeB) return timeB - timeA; // Most recent first
      return a.position - b.position; // Then best position
    });
    
    const displayRanking = sortedRankings[0]; // Use most recent
    const territories = Array.from(new Set(rankings.map(r => r.territory.toLowerCase())));
    
    // Use the most common capitalization for display
    const capitalizations = rankings.map(r => r.keyword);
    const displayKeyword = capitalizations.reduce((acc, curr) => 
      capitalizations.filter(k => k === curr).length > 
      capitalizations.filter(k => k === acc).length ? curr : acc
    );
    
    return {
      ...displayRanking,
      keyword: displayKeyword, // Use normalized display keyword
      territories,
      allRankings: rankings, // Keep all rankings for history
      normalizedKeyword: normalizedKey // Store normalized version for comparisons
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
          isSelected ? 'bg-green-500 bg-opacity-20' : ''
        }`}
        onClick={() => onKeywordSelect(keyword.keyword, selectedCountryFilter || keyword.territory)}
      >
        <td className="py-4 px-4">
          <span className={`font-bold ${
            keyword.position <= 10 
              ? 'text-spotify-green' 
              : keyword.position <= 50 
              ? 'text-yellow-500' 
              : 'text-white'
          }`}>
            #{keyword.position}
          </span>
        </td>
        
        <td className="py-4 px-4 font-medium">
          <div className="flex items-center gap-3">
            <span className="cursor-pointer" onClick={() => onKeywordSelect(keyword.keyword, selectedCountryFilter || keyword.territory)}>
              {keyword.keyword}
            </span>
            <Link 
              href={`/keyword/${playlistId}/${encodeURIComponent(keyword.keyword)}`}
              className="text-green-400 hover:text-green-300 transition-colors text-sm"
              title="View detailed history"
            >
              📊
            </Link>
          </div>
        </td>
        
        <td className="py-4 px-4 text-lg">
          {getTrendIcon(keyword.trend)}
        </td>
        
        <td className="py-4 px-4 text-sm text-gray-400">
          {new Date(keyword.timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </td>
        
        <td className="py-4 px-4 text-center">
          <button 
            className={`text-lg hover:scale-110 transition-transform ${
              isStarred 
                ? 'text-yellow-400' 
                : 'text-gray-500 hover:text-yellow-400'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar?.(keyword.keyword);
            }}
            title={isStarred ? 'Remove star' : 'Add star'}
          >
            {isStarred ? '★' : '☆'}
          </button>
        </td>
        
        <td className="py-4 px-4 text-center">
          <button 
            className="text-red-400 hover:text-red-300 text-lg hover:scale-110 transition-transform"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteKeyword?.(keyword.keyword);
            }}
            title="Delete keyword"
          >
            🗑️
          </button>
        </td>
      </tr>
    );
  };

  const renderKeywordSection = (keywords: DeduplicatedKeyword[], title: string) => (
    keywords.length > 0 && (
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-spotify-green">{title}</h3>
        <div className="overflow-x-auto">
          <table className="w-full keyword-table">
            <thead>
              <tr>
                <th className="text-left py-4 px-4 text-gray-300 font-semibold">Rank</th>
                <th className="text-left py-4 px-4 text-gray-300 font-semibold">Keyword</th>
                <th className="text-left py-4 px-4 text-gray-300 font-semibold">Trend</th>
                <th className="text-left py-4 px-4 text-gray-300 font-semibold">Last Updated</th>
                <th className="text-left py-4 px-4 text-gray-300 font-semibold">⭐</th>
                <th className="text-left py-4 px-4 text-gray-300 font-semibold">🗑️</th>
              </tr>
            </thead>
            <tbody>
              {keywords.map(renderKeywordRow)}
            </tbody>
          </table>
        </div>
      </div>
    )
  );
  
  return (
    <div className="card">
      <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
        📊 Keyword Rankings ({deduplicatedKeywords.length} unique keywords)
      </h2>
      
      {renderKeywordSection(sortedStarredKeywords, `⭐ Starred Keywords (${sortedStarredKeywords.length})`)}
      {renderKeywordSection(sortedRegularKeywords, `All Keywords (${sortedRegularKeywords.length})`)}
      
      {deduplicatedKeywords.length === 0 && (
        <div className="text-center py-8 text-spotify-gray">
          No keywords tracked for this playlist yet.
        </div>
      )}
    </div>
  );
}