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

interface PlaylistNote {
  id: string;
  playlistId: string;
  date: string;
  keyword: string;
  territory: string;
  timestamp: string;
  note: string;
  createdAt: string;
  updatedAt: string;
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
  const [notes, setNotes] = useState<PlaylistNote[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedDataPoint, setSelectedDataPoint] = useState<ChartDataPoint | null>(null);
  const [noteText, setNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlaylist();
    fetchNotes();
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

  const fetchNotes = async () => {
    try {
      const response = await fetch(`/api/notes?playlistId=${playlistId}`);
      if (!response.ok) throw new Error('Failed to fetch notes');
      const data = await response.json();
      setNotes(data);
    } catch (err) {
      console.error('Error fetching notes:', err);
    }
  };

  const handleChartClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const clickedPoint: ChartDataPoint = data.activePayload[0].payload;
      const clickedDate = new Date(clickedPoint.timestamp).toISOString().split('T')[0];

      // Check if there's already a note for this exact data point or date
      const exactNote = notes.find(
        n => n.keyword.toLowerCase() === keyword.toLowerCase() &&
             n.territory === selectedTerritory &&
             n.timestamp === clickedPoint.timestamp
      );

      const dateNote = notes.find(n => n.date === clickedDate);

      if (exactNote) {
        setEditingNoteId(exactNote.id);
        setNoteText(exactNote.note);
      } else if (dateNote) {
        setEditingNoteId(dateNote.id);
        setNoteText(dateNote.note);
      } else {
        setEditingNoteId(null);
        setNoteText('');
      }

      setSelectedDataPoint(clickedPoint);
      setShowModal(true);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedDataPoint || !noteText.trim()) return;

    const clickedDate = new Date(selectedDataPoint.timestamp).toISOString().split('T')[0];

    try {
      if (editingNoteId) {
        // Update existing note
        const response = await fetch(`/api/notes/${editingNoteId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playlistId, note: noteText }),
        });

        if (!response.ok) throw new Error('Failed to update note');

        const updatedNote = await response.json();
        setNotes(notes.map(n => n.id === editingNoteId ? updatedNote : n));
      } else {
        // Create new note
        const response = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playlistId,
            date: clickedDate,
            keyword: keyword,
            territory: selectedTerritory,
            timestamp: selectedDataPoint.timestamp,
            note: noteText
          }),
        });

        if (!response.ok) throw new Error('Failed to create note');

        const newNote = await response.json();
        setNotes([...notes, newNote]);
      }

      handleCloseModal();
      fetchNotes(); // Refresh notes
    } catch (err) {
      console.error('Error saving note:', err);
      alert('Failed to save note. Please try again.');
    }
  };

  const handleDeleteNote = async () => {
    if (!editingNoteId) return;

    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      const response = await fetch(`/api/notes/${editingNoteId}?playlistId=${playlistId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete note');

      setNotes(notes.filter(n => n.id !== editingNoteId));
      handleCloseModal();
    } catch (err) {
      console.error('Error deleting note:', err);
      alert('Failed to delete note. Please try again.');
    }
  };

  const handleDeleteDataPoint = async () => {
    if (!selectedDataPoint) return;

    if (!confirm('Are you sure you want to delete this data point? This action cannot be undone.')) return;

    try {
      const response = await fetch(
        `/api/playlists/${playlistId}?keyword=${encodeURIComponent(keyword)}&territory=${selectedTerritory}&timestamp=${encodeURIComponent(selectedDataPoint.timestamp)}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete data point');
      }

      const result = await response.json();
      alert(`Data point deleted successfully!`);
      handleCloseModal();
      fetchPlaylist(); // Refresh data
    } catch (err) {
      console.error('Error deleting data point:', err);
      alert(`Failed to delete data point: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedDataPoint(null);
    setNoteText('');
    setEditingNoteId(null);
  };

  const downloadCSV = () => {
    if (chartData.length === 0) {
      alert('No data available to export');
      return;
    }

    // Prepare CSV data
    const csvData = chartData.map((dataPoint, index) => {
      const pointDate = new Date(dataPoint.timestamp).toISOString().split('T')[0];
      const note = notes.find(n => n.date === pointDate);

      // Calculate change from previous
      let change = 'N/A';
      if (index > 0) {
        const previousPosition = chartData[index - 1].position;
        const positionChange = previousPosition - dataPoint.position;
        if (positionChange > 0) {
          change = `+${positionChange}`; // Improved (moved up in ranking)
        } else if (positionChange < 0) {
          change = `${positionChange}`; // Declined (moved down in ranking)
        } else {
          change = '0';
        }
      }

      return {
        'Date/Time': new Date(dataPoint.timestamp).toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        'Position': dataPoint.position,
        'Territory': selectedTerritory.toUpperCase(),
        'Change': change,
        'Notes': note?.note || ''
      };
    });

    // Convert to CSV format
    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row =>
        headers.map(header => {
          const value = row[header as keyof typeof row];
          const stringValue = String(value);
          // Escape commas and quotes
          return stringValue.includes(',') || stringValue.includes('"')
            ? `"${stringValue.replace(/"/g, '""')}"`
            : stringValue;
        }).join(',')
      )
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];

    link.setAttribute('href', url);
    link.setAttribute('download', `ranking-history-${keyword.replace(/[^a-z0-9]/gi, '-')}-${selectedTerritory}-${playlistId}-${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  // Helper function to check if a data point should be lilac
  const shouldBeLilac = (dataPoint: ChartDataPoint): boolean => {
    const pointDate = new Date(dataPoint.timestamp).toISOString().split('T')[0];

    // Check if this exact data point has a note
    const exactNote = notes.find(
      n => n.keyword.toLowerCase() === keyword.toLowerCase() &&
           n.territory === selectedTerritory &&
           n.timestamp === dataPoint.timestamp
    );
    if (exactNote) return true;

    // Check if there's a note for this date from a different keyword
    const dateNote = notes.find(n => n.date === pointDate);
    if (dateNote) {
      // Only color the first data point on that date
      const firstPointOnDate = chartData.find(d => {
        const d_date = new Date(d.timestamp).toISOString().split('T')[0];
        return d_date === pointDate;
      });
      return firstPointOnDate?.timestamp === dataPoint.timestamp;
    }

    return false;
  };

  // Get note for a data point's date
  const getNoteForDataPoint = (dataPoint: ChartDataPoint): PlaylistNote | undefined => {
    const pointDate = new Date(dataPoint.timestamp).toISOString().split('T')[0];
    return notes.find(n => n.date === pointDate);
  };

  // Calculate growth/loss for selected data point
  const getGrowthInfo = (dataPoint: ChartDataPoint) => {
    const index = chartData.findIndex(d => d.timestamp === dataPoint.timestamp);
    if (index <= 0) return null;

    const previousPoint = chartData[index - 1];
    const change = previousPoint.position - dataPoint.position; // Positive = improved (went up in ranking)

    return {
      change,
      previousPosition: previousPoint.position,
      isImprovement: change > 0,
      isDecline: change < 0,
    };
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any; label?: string }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const note = getNoteForDataPoint(data);

      return (
        <div className="neu-flat p-3" style={{ background: 'rgba(232, 234, 237, 0.95)', maxWidth: '300px' }}>
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
          {note && (
            <div className="mt-2 pt-2 border-t border-gray-300">
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--lilac)' }}>Note:</p>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{note.note}</p>
            </div>
          )}
          <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            Click for details
          </p>
        </div>
      );
    }
    return null;
  };

  // Create Spotify playlist search URL
  const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(keyword)}/playlists`;

  const growthInfo = selectedDataPoint ? getGrowthInfo(selectedDataPoint) : null;
  const selectedNote = selectedDataPoint ? getNoteForDataPoint(selectedDataPoint) : undefined;

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

            <div className="flex gap-3">
              <button
                onClick={downloadCSV}
                className="neu-btn"
                disabled={chartData.length === 0}
              >
                <svg className="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download CSV
              </button>

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
                <LineChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  onClick={handleChartClick}
                >
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
                    dot={(props: any) => {
                      const isLilac = shouldBeLilac(props.payload);
                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={isLilac ? 8 : 5}
                          fill={isLilac ? '#9333EA' : '#1DB954'}
                          stroke={isLilac ? '#9333EA' : '#1DB954'}
                          strokeWidth={2}
                          style={{ cursor: 'pointer' }}
                        />
                      );
                    }}
                    activeDot={{ r: 8, stroke: '#1DB954', strokeWidth: 2, style: { cursor: 'pointer' } }}
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

        {/* Data Point Detail Modal */}
        {showModal && selectedDataPoint && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={handleCloseModal}
          >
            <div
              className="neu-card max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  Data Point Details
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-3xl leading-none"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  &times;
                </button>
              </div>

              {/* Data Point Info */}
              <div className="mb-6 p-4 neu-flat rounded-lg">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Position</p>
                    <p className="text-3xl font-bold" style={{ color: 'var(--lilac)' }}>
                      #{selectedDataPoint.position}
                    </p>
                  </div>
                  {growthInfo && (
                    <div>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Change</p>
                      <p className={`text-2xl font-bold ${growthInfo.isImprovement ? 'text-green-600' : growthInfo.isDecline ? 'text-red-600' : ''}`}>
                        {growthInfo.change > 0 && '↑ '}
                        {growthInfo.change < 0 && '↓ '}
                        {growthInfo.change === 0 ? '→ No change' : `${Math.abs(growthInfo.change)} positions`}
                      </p>
                      {growthInfo.change !== 0 && (
                        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                          from #{growthInfo.previousPosition}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t pt-3" style={{ borderColor: 'var(--text-secondary)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Timestamp</p>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    {new Date(selectedDataPoint.timestamp).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </p>
                </div>

                <button
                  onClick={handleDeleteDataPoint}
                  className="neu-btn w-full mt-4"
                  style={{ color: 'var(--error)' }}
                >
                  Delete This Data Point
                </button>
              </div>

              {/* Notes Section */}
              <div className="border-t pt-6" style={{ borderColor: 'var(--text-secondary)' }}>
                <h4 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                  Note for this date
                  <span className="text-xs ml-2 font-normal" style={{ color: 'var(--text-secondary)' }}>
                    (appears on all keywords)
                  </span>
                </h4>

                <div className="mb-4">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="neu-input w-full h-32 resize-none"
                    placeholder="e.g., Started meta campaign, Launched influencer collaboration, etc."
                    autoFocus={!selectedNote}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSaveNote}
                    className="neu-btn-primary flex-1"
                    disabled={!noteText.trim()}
                  >
                    {editingNoteId ? 'Update Note' : 'Save Note'}
                  </button>

                  {editingNoteId && (
                    <button
                      onClick={handleDeleteNote}
                      className="neu-btn"
                      style={{ color: 'var(--error)' }}
                    >
                      Delete Note
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
