'use client';

import Link from 'next/link';
import { PlaylistData } from '@/lib/redis';

interface PlaylistCardProps {
  playlist: PlaylistData;
}

export default function PlaylistCard({ playlist }: PlaylistCardProps) {
  const totalKeywords = playlist.keywords.length;
  const bestPosition = totalKeywords > 0 
    ? Math.min(...playlist.keywords.map(k => k.position))
    : null;
  const averagePosition = totalKeywords > 0
    ? Math.round(playlist.keywords.reduce((sum, k) => sum + k.position, 0) / totalKeywords)
    : null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Link href={`/playlist/${playlist.id}`}>
      <div className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-colors cursor-pointer group">
        {/* Playlist Image */}
        {playlist.image && (
          <div className="mb-4">
            <img 
              src={playlist.image} 
              alt={playlist.name}
              className="w-full aspect-square object-cover rounded-lg"
            />
          </div>
        )}
        
        {/* Playlist Name */}
        <h2 className="text-xl font-semibold mb-4 group-hover:text-spotify-green transition-colors">
          {playlist.name}
        </h2>
        
        {/* Stats */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-spotify-gray">Total keywords:</span>
            <span className="text-white font-medium">{totalKeywords}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-spotify-gray">Best position:</span>
            <span className="text-white font-medium">
              {bestPosition ? `#${bestPosition}` : 'N/A'}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-spotify-gray">Average position:</span>
            <span className="text-white font-medium">
              {averagePosition ? `#${averagePosition}` : 'N/A'}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-spotify-gray">Last updated:</span>
            <span className="text-white font-medium">
              {formatDate(playlist.lastUpdated)}
            </span>
          </div>
        </div>
        
        {/* Territories indicator */}
        {totalKeywords > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="flex flex-wrap gap-1">
              {Array.from(new Set(playlist.keywords.map(k => k.territory))).map(territory => (
                <span 
                  key={territory}
                  className="px-2 py-1 bg-spotify-green bg-opacity-20 text-spotify-green text-xs rounded"
                >
                  {territory.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}