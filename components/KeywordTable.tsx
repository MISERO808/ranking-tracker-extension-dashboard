'use client';

import { KeywordRanking } from '@/lib/redis';

interface KeywordTableProps {
  keywords: KeywordRanking[];
  onKeywordSelect: (keyword: string, territory: string) => void;
  selectedKeyword: string | null;
  selectedCountryFilter?: string;
  starredKeywords?: string[];
  onToggleStar?: (keyword: string) => void;
}

interface DeduplicatedKeyword extends KeywordRanking {
  territories: string[];
  allRankings: KeywordRanking[];
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
  onToggleStar
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

  // Group keywords by keyword text only (ignore territory/user)
  const keywordGroups = keywords.reduce((acc, ranking) => {
    const key = ranking.keyword;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(ranking);
    return acc;
  }, {} as { [keyword: string]: KeywordRanking[] });

  // For each unique keyword, get the latest/best ranking for display
  const deduplicatedKeywords: DeduplicatedKeyword[] = Object.entries(keywordGroups).map(([, rankings]) => {
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
    
    return {
      ...displayRanking,
      territories,
      allRankings: rankings // Keep all rankings for history
    };
  }).filter(Boolean) as DeduplicatedKeyword[];

  // Sort by position (best first), then by most recent timestamp
  const sortedKeywords = deduplicatedKeywords.sort((a: DeduplicatedKeyword, b: DeduplicatedKeyword) => {
    if (a.position !== b.position) return a.position - b.position;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">
        Keyword Rankings ({sortedKeywords.length} unique keywords)
      </h2>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-2 text-spotify-gray font-medium">Rank</th>
              <th className="text-left py-3 px-2 text-spotify-gray font-medium">Keyword</th>
              <th className="text-left py-3 px-2 text-spotify-gray font-medium">Trend</th>
              <th className="text-left py-3 px-2 text-spotify-gray font-medium">Last Updated</th>
              <th className="text-left py-3 px-2 text-spotify-gray font-medium">⭐</th>
            </tr>
          </thead>
          <tbody>
            {sortedKeywords.map((keyword: DeduplicatedKeyword) => {
              const isSelected = selectedKeyword === keyword.keyword;
              
              return (
                <tr 
                  key={keyword.keyword}
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
                        starredKeywords.includes(keyword.keyword) 
                          ? 'text-yellow-500' 
                          : 'text-gray-500 hover:text-yellow-400'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar?.(keyword.keyword);
                      }}
                      title={starredKeywords.includes(keyword.keyword) ? 'Remove star' : 'Add star'}
                    >
                      {starredKeywords.includes(keyword.keyword) ? '★' : '☆'}
                    </button>
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