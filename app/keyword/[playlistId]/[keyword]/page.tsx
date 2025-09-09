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
  const [selectedTerritory, setSelectedTerritory] = useState<string>('');

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
      const keywordData = data.keywords.filter((k: KeywordRanking) => 
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
            <Link href="/" className="neu-btn-primary">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Get all data for this keyword
  const allKeywordData = playlist.keywords.filter((k: KeywordRanking) => 
    k.keyword.toLowerCase().trim() === keyword.toLowerCase().trim()
  );

  // Filter by selected territory
  const filteredData = !selectedTerritory || selectedTerritory === '' 
    ? allKeywordData 
    : allKeywordData.filter((k: KeywordRanking) => k.territory === selectedTerritory);

  // Get available territories
  const territories = Array.from(new Set(allKeywordData.map((k: KeywordRanking) => k.territory))).sort();

  // Prepare chart data
  const chartData: ChartDataPoint[] = filteredData
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((ranking: KeywordRanking) => ({
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
  const positions = filteredData.map((r: KeywordRanking) => r.position);
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
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any; label?: string }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="neu-flat p-3" style={{ background: 'rgba(232, 234, 237, 0.95)' }}>
          <p style={{ color: 'var(--text-primary)' }}>{`Position: #${data.position}`}</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
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

  // Create Spotify playlist search URL
  const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(keyword)}/playlists`;

  return (
    <div className="min-h-screen py-8">
      <div className="container">
        {/* Header */}
        <div className="neu-card mb-8">
          <Link 
            href={`/playlist/${playlistId}`}
            className="neu-btn mb-6 inline-flex"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to {playlist.name}
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                <span style={{ background: 'linear-gradient(135deg, var(--lilac), var(--lilac-dark))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  "{keyword}"
                </span>
              </h1>
              <div style={{ color: 'var(--text-secondary)' }}>
                Ranking history from {playlist.name}
              </div>
            </div>
            
            <a
              href={spotifySearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="neu-btn"
              style={{ color: 'var(--lilac)', textDecoration: 'none' }}
            >
              Search Playlists on Spotify
            </a>
          </div>
        </div>

        {/* Territory Filter */}
        <div className="neu-flat mb-8">
          <label htmlFor="territory-filter" className="block text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
            Filter by Territory
          </label>
          <select 
            id="territory-filter"
            value={selectedTerritory}
            onChange={(e) => setSelectedTerritory(e.target.value)}
            className="neu-select w-full md:w-48"
          >
            {territories.map(territory => (
              <option key={territory} value={territory}>
                {territory.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div className="neu-stat">
            <span className="neu-stat-value">{currentPosition ? `#${currentPosition}` : 'N/A'}</span>
            <span className="neu-stat-label">Current Position</span>
          </div>
          
          <div className="neu-stat">
            <span className="neu-stat-value">#{bestPosition}</span>
            <span className="neu-stat-label">Best Position</span>
          </div>
          
          <div className="neu-stat">
            <span className="neu-stat-value" style={{ color: 'var(--error)' }}>#{worstPosition}</span>
            <span className="neu-stat-label">Worst Position</span>
          </div>
          
          <div className="neu-stat">
            <span className="neu-stat-value">{chartData.length}</span>
            <span className="neu-stat-label">Data Points</span>
          </div>
        </div>

        {/* Trend Indicator */}
        {chartData.length > 1 && (
          <div className="mb-8 text-center" style={{ color: 'var(--text-primary)' }}>
            {trend < 0 && (
              <span>
                ↑ Improving by {Math.abs(trend)} positions (last 5 data points)
              </span>
            )}
            {trend > 0 && (
              <span>
                ↓ Declining by {trend} positions (last 5 data points)
              </span>
            )}
            {trend === 0 && (
              <span>
                → Stable (last 5 data points)
              </span>
            )}
          </div>
        )}

        {/* Last Updated */}
        {lastUpdated && (
          <div className="mb-8 text-center" style={{ color: 'var(--text-secondary)' }}>
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
        <div className="neu-card">
          <h2 className="text-2xl font-bold mb-6">
            <span style={{ background: 'linear-gradient(135deg, var(--lilac), var(--lilac-dark))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              <span className="emoji">📈</span> Ranking History
            </span>
          </h2>
          
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
            <div className="h-96 flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
              No data available for the selected territory.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}