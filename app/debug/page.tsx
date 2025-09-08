'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DebugPage() {
  const [playlistId, setPlaylistId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState('');
  const [playlistInfo, setPlaylistInfo] = useState<any>(null);
  const [allPlaylists, setAllPlaylists] = useState<any[]>([]);
  const [updateAllStatus, setUpdateAllStatus] = useState('');
  
  useEffect(() => {
    fetchAllPlaylists();
  }, []);
  
  const fetchAllPlaylists = async () => {
    try {
      const response = await fetch('/api/playlists');
      const data = await response.json();
      setAllPlaylists(data);
    } catch (error) {
      console.error('Failed to fetch playlists');
    }
  };
  
  const updateAllImages = async () => {
    setUpdateAllStatus('🔄 Updating all images...');
    try {
      const response = await fetch('/api/playlists/update-images', {
        method: 'POST'
      });
      const data = await response.json();
      if (response.ok) {
        setUpdateAllStatus(`✅ Updated ${data.updated} playlists, ${data.failed} failed`);
        fetchAllPlaylists();
      } else {
        setUpdateAllStatus(`❌ ${data.error}`);
      }
    } catch (error) {
      setUpdateAllStatus('❌ Failed to update');
    }
  };

  const checkPlaylist = async () => {
    try {
      const response = await fetch(`/api/debug/set-image?playlistId=${playlistId}`);
      const data = await response.json();
      setPlaylistInfo(data);
      if (data.currentImage) {
        setImageUrl(data.currentImage);
      }
    } catch (error) {
      setStatus('Error checking playlist');
    }
  };

  const setImage = async () => {
    try {
      const response = await fetch('/api/debug/set-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId, imageUrl })
      });
      
      const data = await response.json();
      if (response.ok) {
        setStatus('✅ Image set successfully!');
        // Refresh playlist info
        await checkPlaylist();
      } else {
        setStatus(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setStatus('❌ Failed to set image');
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container">
        <div className="neu-card">
          <Link href="/" className="neu-btn mb-6 inline-flex">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
          
          <h1 className="text-3xl font-bold mb-6">Debug: Playlist Images</h1>
          
          {/* Update All Button */}
          <div className="neu-flat mb-6">
            <h2 className="text-xl font-semibold mb-4">Update All Missing Images</h2>
            <button onClick={updateAllImages} className="neu-btn-primary">
              🎨 Fetch All Missing Images from Spotify
            </button>
            {updateAllStatus && (
              <p className="mt-2 text-sm">{updateAllStatus}</p>
            )}
          </div>
          
          {/* List of Playlists */}
          <div className="neu-flat mb-6">
            <h2 className="text-xl font-semibold mb-4">Current Playlists</h2>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allPlaylists.map(p => (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded" style={{ background: 'var(--bg-color)' }}>
                  {p.image ? (
                    <img src={p.image} alt="" className="w-8 h-8 rounded" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-gray-300" />
                  )}
                  <span className="flex-1">{p.name}</span>
                  <button 
                    onClick={() => {
                      setPlaylistId(p.id);
                      checkPlaylist();
                    }}
                    className="text-sm neu-btn"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          <h2 className="text-xl font-semibold mb-4">Manual Image Update</h2>
          
          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="block mb-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Playlist ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={playlistId}
                  onChange={(e) => setPlaylistId(e.target.value)}
                  placeholder="e.g., 37i9dQZF1DX..."
                  className="neu-input flex-1"
                />
                <button onClick={checkPlaylist} className="neu-btn">
                  Check
                </button>
              </div>
            </div>
            
            {playlistInfo && (
              <div className="neu-flat">
                <p><strong>Name:</strong> {playlistInfo.name || 'Unknown'}</p>
                <p><strong>Has Image:</strong> {playlistInfo.hasImage ? 'Yes' : 'No'}</p>
                <p><strong>Keywords:</strong> {playlistInfo.keywordCount}</p>
                {playlistInfo.currentImage && (
                  <div className="mt-2">
                    <p className="mb-2"><strong>Current Image:</strong></p>
                    <img src={playlistInfo.currentImage} alt="Current" className="w-32 h-32 rounded-lg" />
                  </div>
                )}
              </div>
            )}
            
            <div>
              <label className="block mb-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Image URL (from Spotify)
              </label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://i.scdn.co/image/..."
                className="neu-input w-full"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Tip: Right-click a playlist image on Spotify and copy image address
              </p>
            </div>
            
            <button 
              onClick={setImage}
              disabled={!playlistId || !imageUrl}
              className="neu-btn-primary"
            >
              Set Image
            </button>
            
            {status && (
              <div className="neu-flat">
                {status}
              </div>
            )}
            
            <div className="neu-flat mt-8">
              <h3 className="font-semibold mb-2">How to get Spotify image URL:</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <li>Open Spotify Web Player</li>
                <li>Find your playlist</li>
                <li>Right-click on the playlist image</li>
                <li>Select "Copy image address"</li>
                <li>Paste the URL here</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}