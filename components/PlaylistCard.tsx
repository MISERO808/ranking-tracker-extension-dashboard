'use client';

import Link from 'next/link';
import { PlaylistData } from '@/lib/redis';

interface PlaylistCardProps {
  playlist: PlaylistData;
}

export default function PlaylistCard({ playlist }: PlaylistCardProps) {
  // Get unique keywords count (not total entries)
  const uniqueKeywords = new Set(
    playlist.keywords.map(k => k.keyword.toLowerCase().trim())
  ).size;
  
  const bestPosition = playlist.keywords.length > 0 
    ? Math.min(...playlist.keywords.map(k => k.position))
    : null;
  const averagePosition = playlist.keywords.length > 0
    ? Math.round(playlist.keywords.reduce((sum, k) => sum + k.position, 0) / playlist.keywords.length)
    : null;


  return (
    <Link href={`/playlist/${playlist.id}`} className="block">
      <div className="neu-card group cursor-pointer h-full flex flex-col">
        {/* Playlist Image - 1:1 aspect ratio */}
        {playlist.image && (
          <div className="neu-inset rounded-xl mb-6 overflow-hidden aspect-square">
            <img 
              src={playlist.image} 
              alt={playlist.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        )}
        
        {/* If no image, show placeholder */}
        {!playlist.image && (
          <div className="neu-inset rounded-xl mb-6 overflow-hidden aspect-square flex items-center justify-center" style={{ background: 'var(--bg-color)' }}>
            <svg className="w-20 h-20" style={{ color: 'var(--text-secondary)', opacity: 0.3 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}
        
        {/* Playlist Name */}
        <h2 className="text-xl font-semibold mb-6 transition-colors">
          <span className="group-hover:opacity-70 transition-opacity" style={{ color: 'var(--text-primary)' }}>
            {playlist.name}
          </span>
        </h2>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6 flex-grow">
          <div className="neu-stat">
            <span className="neu-stat-value">{uniqueKeywords}</span>
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
        </div>
        
      </div>
    </Link>
  );
}