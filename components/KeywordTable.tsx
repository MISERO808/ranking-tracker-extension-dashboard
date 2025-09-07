'use client';

import { KeywordRanking } from '@/lib/redis';

interface KeywordTableProps {
  keywords: KeywordRanking[];
  onKeywordSelect: (keyword: string, territory: string) => void;
  selectedKeyword: string | null;
  selectedTerritory: string | null;
  selectedCountryFilter?: string;
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

const getTerritoryFlag = (territory: string) => {
  const flags: { [key: string]: string } = {
    'us': '🇺🇸',
    'uk': '🇬🇧',
    'de': '🇩🇪',
    'fr': '🇫🇷',
    'es': '🇪🇸',
    'it': '🇮🇹',
    'ca': '🇨🇦',
    'au': '🇦🇺',
    'nl': '🇳🇱',
    'se': '🇸🇪',
    'global': '🌍',
  };
  return flags[territory.toLowerCase()] || '🏳️';
};

export default function KeywordTable({ 
  keywords, 
  onKeywordSelect, 
  selectedKeyword, 
  selectedTerritory,
  selectedCountryFilter
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

  // Group keywords by keyword text, keeping only the best position for each
  const keywordGroups = keywords.reduce((acc, ranking) => {
    const key = ranking.keyword;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(ranking);
    return acc;
  }, {} as { [keyword: string]: KeywordRanking[] });

  // For each keyword, find the best position across all territories
  const deduplicatedKeywords: DeduplicatedKeyword[] = Object.entries(keywordGroups).map(([keywordText, rankings]) => {
    // Find the best position (lowest number)
    const bestRanking = rankings.reduce((best: KeywordRanking, current: KeywordRanking) => 
      current.position < best.position ? current : best
    );
    
    // Get all territories where this keyword appears
    const territories = rankings.map((r: KeywordRanking) => r.territory);
    
    return {
      ...bestRanking,
      territories, // Add array of all territories
      allRankings: rankings // Keep all rankings for territory filtering
    };
  });

  // Filter by selected country if provided
  const filteredKeywords = selectedCountryFilter 
    ? deduplicatedKeywords.filter((k: DeduplicatedKeyword) => 
        k.territories.some(territory => territory.toLowerCase() === selectedCountryFilter.toLowerCase())
      )
    : deduplicatedKeywords;

  // Sort by position (best first)
  const sortedKeywords = filteredKeywords.sort((a: DeduplicatedKeyword, b: DeduplicatedKeyword) => a.position - b.position);

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">
        Keyword Rankings ({filteredKeywords.length} unique keywords)
      </h2>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-2 text-spotify-gray font-medium">Rank</th>
              <th className="text-left py-3 px-2 text-spotify-gray font-medium">Keyword</th>
              <th className="text-left py-3 px-2 text-spotify-gray font-medium">Territory</th>
              <th className="text-left py-3 px-2 text-spotify-gray font-medium">Trend</th>
              <th className="text-left py-3 px-2 text-spotify-gray font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {sortedKeywords.map((keyword: DeduplicatedKeyword) => {
              const isSelected = selectedKeyword === keyword.keyword && 
                               selectedTerritory === keyword.territory;
              
              // Show if pulled by different users
              const uniqueUsers = Array.from(new Set(keyword.allRankings.map(r => r.userId).filter(Boolean)));
              const hasMultipleUsers = uniqueUsers.length > 1;
              
              return (
                <tr 
                  key={`${keyword.keyword}-${keyword.territories.join('-')}`}
                  className={`border-b border-gray-700 hover:bg-gray-700 cursor-pointer transition-colors ${
                    isSelected ? 'bg-spotify-green bg-opacity-20' : ''
                  } ${
                    hasMultipleUsers ? 'border-l-2 border-l-blue-500' : ''
                  }`}
                  onClick={() => onKeywordSelect(keyword.keyword, keyword.territory)}
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
                  
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-wrap gap-2">
                        {Array.from(new Set(keyword.territories)).map((territory: string) => (
                          <span key={territory} className="flex items-center gap-1">
                            <span>{getTerritoryFlag(territory)}</span>
                            <span className="text-sm text-spotify-gray">
                              {territory.toUpperCase()}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}