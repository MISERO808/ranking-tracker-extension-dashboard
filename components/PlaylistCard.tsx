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
    <Link href={`/playlist/${playlist.id}`} className="block">
      <div className="card group cursor-pointer overflow-hidden">
        {/* Playlist Image */}
        {playlist.image && (
          <div className="mb-6 -mx-8 -mt-8 relative overflow-hidden">
            <img 
              src={playlist.image} 
              alt={playlist.name}
              className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50" />
          </div>
        )}
        
        {/* Playlist Name */}
        <h2 className="text-2xl font-bold mb-6 group-hover:text-green-400 transition-colors">
          {playlist.name}
        </h2>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="stat">
            <span className="stat-value">{totalKeywords}</span>
            <span className="stat-label">Keywords</span>
          </div>
          
          <div className="stat">
            <span className="stat-value">
              {bestPosition ? `#${bestPosition}` : 'N/A'}
            </span>
            <span className="stat-label">Best Rank</span>
          </div>
          
          <div className="stat">
            <span className="stat-value">
              {averagePosition ? `#${averagePosition}` : 'N/A'}
            </span>
            <span className="stat-label">Avg Rank</span>
          </div>
          
          <div className="stat">
            <span className="stat-value text-sm">
              {formatDate(playlist.lastUpdated).split(' ')[0]}
            </span>
            <span className="stat-label">Updated</span>
          </div>
        </div>
        
        {/* Territories indicator */}
        {totalKeywords > 0 && (
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(
              playlist.keywords
                .map(k => k.territory?.toLowerCase().trim())
                .filter(t => t && t !== 'unknown' && t.length === 2)
            )).map(territory => (
              <span 
                key={territory}
                className="glass-bright px-3 py-1 text-xs rounded-full font-medium"
              >
                {territory?.toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}