'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { KeywordHistory } from '@/lib/redis';

interface KeywordChartProps {
  playlistId: string;
  keyword: string;
  territory: string;
  allKeywords?: any[]; // Pass all keywords from playlist
}

interface ChartDataPoint {
  date: string;
  position: number;
  timestamp: string;
}

export default function KeywordChart({ playlistId, keyword, territory, allKeywords }: KeywordChartProps) {
  const [history, setHistory] = useState<KeywordHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, [playlistId, keyword, territory, allKeywords]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (allKeywords) {
        // Use provided keywords from playlist (faster)
        const keywordData = allKeywords
          .filter(k => 
            k.keyword.toLowerCase().trim() === keyword.toLowerCase().trim() && 
            k.territory.toLowerCase() === territory.toLowerCase()
          )
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .map(k => ({ position: k.position, timestamp: k.timestamp }));
          
        setHistory({
          keyword,
          territory,
          rankings: keywordData
        });
      } else {
        // Fallback to API call
        const params = new URLSearchParams({ playlistId, keyword, territory });
        const response = await fetch(`/api/keywords/history?${params}`);
        if (!response.ok) throw new Error('Failed to fetch keyword history');
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card h-96">
        <h3 className="text-xl font-bold mb-4 text-green-400">📈 Ranking History</h3>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-transparent border-t-green-400"></div>
        </div>
      </div>
    );
  }

  if (error || !history) {
    return (
      <div className="card h-96">
        <h3 className="text-xl font-bold mb-4 text-green-400">📈 Ranking History</h3>
        <div className="flex flex-col justify-center items-center h-64">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="text-red-400">Error: {error}</div>
        </div>
      </div>
    );
  }

  if (history.rankings.length === 0) {
    return (
      <div className="card h-96">
        <h3 className="text-xl font-bold mb-4 text-green-400">📈 Ranking History</h3>
        <div className="flex flex-col justify-center items-center h-64">
          <div className="text-6xl mb-4">📊</div>
          <div className="text-gray-400 text-center">
            No historical data available for this keyword.
          </div>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const chartData: ChartDataPoint[] = history.rankings.map(ranking => ({
    date: new Date(ranking.timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    }),
    position: ranking.position,
    timestamp: ranking.timestamp
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 p-3 rounded border border-gray-600">
          <p className="text-white">{`Position: #${data.position}`}</p>
          <p className="text-spotify-gray text-sm">
            {new Date(data.timestamp).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      );
    }
    return null;
  };

  const currentPosition = history.rankings[history.rankings.length - 1]?.position;
  const bestPosition = Math.min(...history.rankings.map(r => r.position));
  const worstPosition = Math.max(...history.rankings.map(r => r.position));

  // Calculate trend
  const recentRankings = history.rankings.slice(-5);
  const trend = recentRankings.length >= 2 
    ? recentRankings[recentRankings.length - 1].position - recentRankings[0].position
    : 0;

  return (
    <div className="card h-96">
      <div className="mb-6">
        <h3 className="text-xl font-bold mb-2 text-green-400">📈 Ranking History</h3>
        <div className="text-sm text-gray-400">
          <span className="font-medium text-white">"{keyword}"</span> in {territory.toUpperCase()}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat">
          <span className="stat-value">#{currentPosition}</span>
          <span className="stat-label">Current</span>
        </div>
        <div className="stat">
          <span className="stat-value text-green-400">#{bestPosition}</span>
          <span className="stat-label">Best</span>
        </div>
        <div className="stat">
          <span className="stat-value text-red-400">#{worstPosition}</span>
          <span className="stat-label">Worst</span>
        </div>
      </div>

      {/* Trend indicator */}
      <div className="mb-4 text-center">
        {trend < 0 && (
          <div className="text-green-500 text-sm">
            ↗️ Improving (+{Math.abs(trend)} positions)
          </div>
        )}
        {trend > 0 && (
          <div className="text-red-500 text-sm">
            ↘️ Declining (-{trend} positions)
          </div>
        )}
        {trend === 0 && (
          <div className="text-yellow-500 text-sm">
            → Stable
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="date" 
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              axisLine={{ stroke: '#4B5563' }}
            />
            <YAxis 
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              axisLine={{ stroke: '#4B5563' }}
              reversed={true} // Lower positions (better rankings) at top
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="position" 
              stroke="#1DB954" 
              strokeWidth={2}
              dot={{ fill: '#1DB954', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#1DB954', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}