import PlaylistGrid from '@/components/PlaylistGrid';

export default function Home() {
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
        </div>
        
        <PlaylistGrid />
      </div>
    </main>
  )
}