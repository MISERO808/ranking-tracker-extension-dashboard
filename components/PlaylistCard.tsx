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
      <div className="neu-card group cursor-pointer h-full flex flex-col">
        {/* Playlist Image */}
        {playlist.image && (
          <div className="neu-inset rounded-xl mb-6 overflow-hidden">
            <img 
              src={playlist.image} 
              alt={playlist.name}
              className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        )}
        
        {/* Playlist Name */}
        <h2 className="text-2xl font-bold mb-6 transition-colors emoji">
          <span className="group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-purple-300 group-hover:bg-clip-text group-hover:text-transparent">
            {playlist.name}
          </span>
        </h2>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6 flex-grow">
          <div className="neu-stat">
            <span className="neu-stat-value">{totalKeywords}</span>
            <span className="neu-stat-label">Keywords</span>
          </div>
          
          <div className="neu-stat">
            <span className="neu-stat-value">
              {bestPosition ? `#${bestPosition}` : 'N/A'}
            </span>
            <span className="neu-stat-label">Best Rank</span>
          </div>
          
          <div className="neu-stat">
            <span className="neu-stat-value">
              {averagePosition ? `#${averagePosition}` : 'N/A'}
            </span>
            <span className="neu-stat-label">Avg Rank</span>
          </div>
          
          <div className="neu-stat">
            <span className="neu-stat-value text-base">
              {formatDate(playlist.lastUpdated).split(' ')[0]}
            </span>
            <span className="neu-stat-label">Updated</span>
          </div>
        </div>
        
        {/* Territories indicator */}
        {totalKeywords > 0 && (
          <div className="flex flex-wrap gap-2 mt-auto">
            {Array.from(new Set(
              playlist.keywords
                .map(k => k.territory?.toLowerCase().trim())
                .filter(t => t && t !== 'unknown' && t.length === 2)
            )).sort().map(territory => (
              <span 
                key={territory}
                className="neu-badge"
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