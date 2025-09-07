'use client';

import { KeywordRanking } from '@/lib/redis';

interface KeywordTableProps {
  keywords: KeywordRanking[];
  onKeywordSelect: (keyword: string, territory: string) => void;
  selectedKeyword: string | null;
  selectedCountryFilter?: string;
  starredKeywords?: string[];
  onToggleStar?: (keyword: string) => void;
  onDeleteKeyword?: (keyword: string) => void;
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
  onDeleteKeyword
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
    // Filter by selected country first if specified
    const filteredRankings = selectedCountryFilter 
      ? rankings.filter(r => r.territory.toLowerCase() === selectedCountryFilter.toLowerCase())
      : rankings;
      
    if (filteredRankings.length === 0) return null;
    
    // Sort by timestamp (most recent first) then by best position
    const sortedRankings = filteredRankings.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      if (timeA !== timeB) return timeB - timeA; // Most recent first
      return a.position - b.position; // Then best position
    });
    
    const displayRanking = sortedRankings[0]; // Use most recent
    const territories = Array.from(new Set(rankings.map(r => r.territory)));
    
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
        className={`border-b border-gray-700 hover:bg-gray-700 cursor-pointer transition-colors ${
          isSelected ? 'bg-spotify-green bg-opacity-20' : ''
        }`}
        onClick={() => onKeywordSelect(keyword.keyword, selectedCountryFilter || keyword.territory)}
      >
        <td className="py-3 px-2">
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
        
        <td className="py-3 px-2 font-medium">
          {keyword.keyword}
        </td>
        
        <td className="py-3 px-2 text-lg">
          {getTrendIcon(keyword.trend)}
        </td>
        
        <td className="py-3 px-2 text-sm text-spotify-gray">
          {new Date(keyword.timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </td>
        
        <td className="py-3 px-2 text-center">
          <button 
            className={`text-lg hover:scale-110 transition-transform ${
              isStarred 
                ? 'text-yellow-500' 
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
        
        <td className="py-3 px-2 text-center">
          <button 
            className="text-red-500 hover:text-red-400 text-lg hover:scale-110 transition-transform"
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
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-2 text-spotify-gray font-medium">Rank</th>
                <th className="text-left py-3 px-2 text-spotify-gray font-medium">Keyword</th>
                <th className="text-left py-3 px-2 text-spotify-gray font-medium">Trend</th>
                <th className="text-left py-3 px-2 text-spotify-gray font-medium">Last Updated</th>
                <th className="text-left py-3 px-2 text-spotify-gray font-medium">⭐</th>
                <th className="text-left py-3 px-2 text-spotify-gray font-medium">🗑️</th>
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
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">
        Keyword Rankings ({deduplicatedKeywords.length} unique keywords)
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