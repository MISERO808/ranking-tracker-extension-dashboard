'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PlaylistData, KeywordRanking } from '@/lib/redis';

interface ChartDataPoint {
  date: string;
  position: number;
  timestamp: string;
}

export default function KeywordDetail() {
  const params = useParams();
  const router = useRouter();
  const playlistId = params.playlistId as string;
  const keyword = decodeURIComponent(params.keyword as string);
  
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTerritory, setSelectedTerritory] = useState<string>('all');

  useEffect(() => {
    fetchPlaylist();
  }, [playlistId]);

  const fetchPlaylist = async () => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}`);
      if (!response.ok) throw new Error('Failed to fetch playlist');
      
      const data = await response.json();
      setPlaylist(data);
      
      // Set default territory to the first one found for this keyword
      const keywordData = data.keywords.filter(k => 
        k.keyword.toLowerCase().trim() === keyword.toLowerCase().trim()
      );
      if (keywordData.length > 0) {
        setSelectedTerritory(keywordData[0].territory);
      }
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
            <Link href="/" className="px-4 py-2 bg-spotify-green text-black rounded hover:bg-green-400 transition-colors">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Get all data for this keyword
  const allKeywordData = playlist.keywords.filter(k => 
    k.keyword.toLowerCase().trim() === keyword.toLowerCase().trim()
  );

  // Filter by selected territory
  const filteredData = selectedTerritory === 'all' 
    ? allKeywordData 
    : allKeywordData.filter(k => k.territory === selectedTerritory);

  // Get available territories
  const territories = Array.from(new Set(allKeywordData.map(k => k.territory))).sort();

  // Prepare chart data
  const chartData: ChartDataPoint[] = filteredData
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(ranking => ({
      date: new Date(ranking.timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      position: ranking.position,
      timestamp: ranking.timestamp
    }));

  // Calculate stats
  const positions = filteredData.map(r => r.position);
  const bestPosition = Math.min(...positions);
  const worstPosition = Math.max(...positions);
  const currentPosition = chartData[chartData.length - 1]?.position;
  const lastUpdated = chartData[chartData.length - 1]?.timestamp;

  // Calculate trend from last 5 data points
  const recentData = chartData.slice(-5);
  const trend = recentData.length >= 2 
    ? recentData[recentData.length - 1].position - recentData[0].position
    : 0;

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

  // Create Spotify search URL
  const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(keyword)}`;

  return (
    <div className="min-h-screen bg-spotify-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href={`/playlist/${playlistId}`}
            className="text-spotify-green hover:text-green-400 transition-colors mb-4 inline-block"
          >
            ← Back to {playlist.name}
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">"{keyword}"</h1>
              <div className="text-spotify-gray">
                Ranking history from {playlist.name}
              </div>
            </div>
            
            <a
              href={spotifySearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-spotify-green text-black font-semibold rounded-full hover:bg-green-400 transition-colors"
            >
              🎵 Search on Spotify
            </a>
          </div>
        </div>

        {/* Territory Filter */}
        <div className="mb-6">
          <label htmlFor="territory-filter" className="block text-sm font-medium text-spotify-gray mb-2">
            Filter by Territory
          </label>
          <select 
            id="territory-filter"
            value={selectedTerritory}
            onChange={(e) => setSelectedTerritory(e.target.value)}
            className="bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-spotify-green"
          >
            <option value="all">All Territories</option>
            {territories.map(territory => (
              <option key={territory} value={territory}>
                {territory.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="text-spotify-gray text-sm mb-1">Current Position</div>
            <div className="text-3xl font-bold">{currentPosition ? `#${currentPosition}` : 'N/A'}</div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="text-spotify-gray text-sm mb-1">Best Position</div>
            <div className="text-3xl font-bold text-spotify-green">#{bestPosition}</div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="text-spotify-gray text-sm mb-1">Worst Position</div>
            <div className="text-3xl font-bold text-red-500">#{worstPosition}</div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="text-spotify-gray text-sm mb-1">Data Points</div>
            <div className="text-3xl font-bold text-blue-400">{chartData.length}</div>
          </div>
        </div>

        {/* Trend Indicator */}
        {chartData.length > 1 && (
          <div className="mb-8 text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-full text-sm">
              {trend < 0 && (
                <div className="text-green-500">
                  ↗️ Improving by {Math.abs(trend)} positions (last 5 data points)
                </div>
              )}
              {trend > 0 && (
                <div className="text-red-500">
                  ↘️ Declining by {trend} positions (last 5 data points)
                </div>
              )}
              {trend === 0 && (
                <div className="text-yellow-500">
                  → Stable (last 5 data points)
                </div>
              )}
            </div>
          </div>
        )}

        {/* Last Updated */}
        {lastUpdated && (
          <div className="mb-8 text-center text-spotify-gray">
            Last updated: {new Date(lastUpdated).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        )}

        {/* Large Chart */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-6">Ranking History</h2>
          
          {chartData.length > 0 ? (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
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
                    strokeWidth={3}
                    dot={{ fill: '#1DB954', strokeWidth: 2, r: 5 }}
                    activeDot={{ r: 8, stroke: '#1DB954', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-96 flex items-center justify-center text-spotify-gray">
              No data available for the selected territory.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}