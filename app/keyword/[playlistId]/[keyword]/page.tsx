'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
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
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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
      const clickedPoint = data.activePayload[0].payload;
      const clickedDate = new Date(clickedPoint.timestamp).toISOString().split('T')[0];

      // Check if there's already a note for this date
      const existingNote = notes.find(n => n.date === clickedDate);

      if (existingNote) {
        setEditingNoteId(existingNote.id);
        setNoteText(existingNote.note);
      } else {
        setEditingNoteId(null);
        setNoteText('');
      }

      setSelectedDate(clickedDate);
      setShowNoteModal(true);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedDate || !noteText.trim()) return;

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
          body: JSON.stringify({ playlistId, date: selectedDate, note: noteText }),
        });

        if (!response.ok) throw new Error('Failed to create note');

        const newNote = await response.json();
        setNotes([...notes, newNote]);
      }

      handleCloseModal();
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

  const handleCloseModal = () => {
    setShowNoteModal(false);
    setSelectedDate(null);
    setNoteText('');
    setEditingNoteId(null);
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
      const pointDate = new Date(data.timestamp).toISOString().split('T')[0];
      const noteForDate = notes.find(n => n.date === pointDate);

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
          {noteForDate && (
            <div className="mt-2 pt-2 border-t border-gray-300">
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--lilac)' }}>Note:</p>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{noteForDate.note}</p>
            </div>
          )}
          <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            Click to {noteForDate ? 'edit' : 'add'} note
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
                      const pointDate = new Date(props.payload.timestamp).toISOString().split('T')[0];
                      const hasNote = notes.some(n => n.date === pointDate);
                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={hasNote ? 8 : 5}
                          fill={hasNote ? '#9333EA' : '#1DB954'}
                          stroke={hasNote ? '#9333EA' : '#1DB954'}
                          strokeWidth={2}
                          style={{ cursor: 'pointer' }}
                        />
                      );
                    }}
                    activeDot={{ r: 8, stroke: '#1DB954', strokeWidth: 2, style: { cursor: 'pointer' } }}
                  />
                  {/* Add note markers */}
                  {notes.map(note => {
                    // Check if there's an exact data point for this note date
                    const exactDataPoint = chartData.find(d => {
                      const pointDate = new Date(d.timestamp).toISOString().split('T')[0];
                      return pointDate === note.date;
                    });

                    if (exactDataPoint) {
                      // Show marker at exact data point
                      return (
                        <ReferenceDot
                          key={note.id}
                          x={exactDataPoint.date}
                          y={exactDataPoint.position}
                          r={0}
                          label={{
                            value: '📝',
                            position: 'top',
                            fontSize: 16,
                            style: { cursor: 'pointer' }
                          }}
                        />
                      );
                    }

                    // Check if this keyword has data before and after the note date
                    const noteDateTime = new Date(note.date + 'T00:00:00').getTime();
                    const hasDataBefore = chartData.some(d => new Date(d.timestamp).getTime() < noteDateTime);
                    const hasDataAfter = chartData.some(d => new Date(d.timestamp).getTime() > noteDateTime);

                    if (hasDataBefore && hasDataAfter) {
                      // Find surrounding data points for interpolation
                      const beforePoint = chartData
                        .filter(d => new Date(d.timestamp).getTime() < noteDateTime)
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

                      const afterPoint = chartData
                        .filter(d => new Date(d.timestamp).getTime() > noteDateTime)
                        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];

                      if (beforePoint && afterPoint) {
                        // Interpolate position
                        const interpolatedPosition = Math.round(
                          (beforePoint.position + afterPoint.position) / 2
                        );

                        const noteDate = new Date(note.date + 'T00:00:00').toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        return (
                          <ReferenceDot
                            key={note.id}
                            x={beforePoint.date}
                            y={interpolatedPosition}
                            r={0}
                            label={{
                              value: '📝',
                              position: 'top',
                              fontSize: 16,
                              style: { cursor: 'pointer' }
                            }}
                          />
                        );
                      }
                    }

                    return null;
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-96 flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
              No data available for the selected territory.
            </div>
          )}
        </div>

        {/* Note Modal */}
        {showNoteModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={handleCloseModal}
          >
            <div
              className="neu-card max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {editingNoteId ? 'Edit Note' : 'Add Note'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-2xl leading-none"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  &times;
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Date: {selectedDate && new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </label>
              </div>

              <div className="mb-6">
                <label htmlFor="note-text" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Note
                </label>
                <textarea
                  id="note-text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="neu-input w-full h-32 resize-none"
                  placeholder="e.g., Started meta campaign, Launched influencer collaboration, etc."
                  autoFocus
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
                    Delete
                  </button>
                )}

                <button
                  onClick={handleCloseModal}
                  className="neu-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}