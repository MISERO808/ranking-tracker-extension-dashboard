'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PlaylistData } from '@/lib/redis';
import KeywordTable from '@/components/KeywordTable';
import KeywordChart from '@/components/KeywordChart';

export default function PlaylistDetail() {
  const params = useParams();
  const playlistId = params.id as string;
  
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(null);

  useEffect(() => {
    fetchPlaylist();
  }, [playlistId]);

  const fetchPlaylist = async () => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Playlist not found');
        }
        throw new Error('Failed to fetch playlist');
      }
      
      const data = await response.json();
      setPlaylist(data);
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
            <Link 
              href="/"
              className="px-4 py-2 bg-spotify-green text-black rounded hover:bg-green-400 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-spotify-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/" 
            className="text-spotify-green hover:text-green-400 transition-colors mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          
          <div className="flex items-start gap-6">
            {playlist.image && (
              <img 
                src={playlist.image}
                alt={playlist.name}
                className="w-32 h-32 rounded-lg object-cover"
              />
            )}
            
            <div>
              <h1 className="text-4xl font-bold mb-2">{playlist.name}</h1>
              <div className="flex gap-6 text-spotify-gray">
                <span>{playlist.keywords.length} keywords tracked</span>
                <span>Last updated: {new Date(playlist.lastUpdated).toLocaleDateString()}</span>
              </div>
              
              {/* Territories */}
              <div className="flex flex-wrap gap-2 mt-4">
                {Array.from(new Set(playlist.keywords.map(k => k.territory))).map(territory => (
                  <span 
                    key={territory}
                    className="px-3 py-1 bg-spotify-green bg-opacity-20 text-spotify-green text-sm rounded"
                  >
                    {territory.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Keyword Table */}
          <div className="lg:col-span-2">
            <KeywordTable 
              keywords={playlist.keywords}
              onKeywordSelect={(keyword, territory) => {
                setSelectedKeyword(keyword);
                setSelectedTerritory(territory);
              }}
              selectedKeyword={selectedKeyword}
              selectedTerritory={selectedTerritory}
            />
          </div>

          {/* Chart */}
          <div className="lg:col-span-1">
            {selectedKeyword && selectedTerritory ? (
              <KeywordChart 
                playlistId={playlist.id}
                keyword={selectedKeyword}
                territory={selectedTerritory}
              />
            ) : (
              <div className="bg-gray-800 rounded-lg p-6 h-96 flex items-center justify-center">
                <div className="text-center text-spotify-gray">
                  <div className="text-lg mb-2">📈</div>
                  <div>Select a keyword to view ranking history</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}