'use client';

import PlaylistGrid from '@/components/PlaylistGrid';
import { useState } from 'react';

export default function Home() {
  const [updateStatus, setUpdateStatus] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  const updateAllImages = async () => {
    setIsUpdating(true);
    setUpdateStatus('🔄 Fetching images from Spotify...');
    
    try {
      const response = await fetch('/api/playlists/update-images', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setUpdateStatus(`✅ Updated ${data.updated} playlists!`);
        // Reload the page to show new images
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setUpdateStatus(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setUpdateStatus('❌ Failed to update images');
    } finally {
      setIsUpdating(false);
    }
  };
  
  return (
    <main className="min-h-screen py-8">
      <div className="container">
        <div className="neu-card mb-12 text-center">
          <div className="neu-inset inline-block p-4 rounded-full mb-6">
            <span className="text-6xl emoji">🎵</span>
          </div>
          <h1 className="text-5xl font-bold mb-4">
            <span style={{ background: 'linear-gradient(135deg, var(--lilac), var(--lilac-dark))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Spotify Ranking Tracker
            </span>
          </h1>
          <p className="text-xl" style={{ color: 'var(--text-secondary)' }}>
            Track your playlist rankings across different markets and keywords
          </p>
          
          {/* Image Update Button */}
          <div className="mt-6">
            <button
              onClick={updateAllImages}
              disabled={isUpdating}
              className="neu-btn"
              title="Fetch missing playlist images from Spotify"
            >
              {isUpdating ? '🔄 Updating...' : '🎨 Fetch Missing Images'}
            </button>
            {updateStatus && (
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {updateStatus}
              </p>
            )}
          </div>
        </div>
        
        <PlaylistGrid />
      </div>
    </main>
  )
}