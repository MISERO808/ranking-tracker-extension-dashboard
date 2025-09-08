import PlaylistGrid from '@/components/PlaylistGrid';

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="container">
        <div className="card mb-8 text-center">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
            🎵 Spotify Ranking Tracker
          </h1>
          <p className="text-xl text-gray-300">
            Track your playlist rankings across different markets and keywords
          </p>
        </div>
        
        <PlaylistGrid />
      </div>
    </main>
  )
}