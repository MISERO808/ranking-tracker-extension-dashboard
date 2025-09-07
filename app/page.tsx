import PlaylistGrid from '@/components/PlaylistGrid';

export default function Home() {
  return (
    <main className="min-h-screen bg-spotify-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-spotify-green">
            Spotify Ranking Tracker
          </h1>
          <p className="text-spotify-gray">
            Track your playlist rankings across different markets and keywords
          </p>
        </div>
        
        <PlaylistGrid />
      </div>
    </main>
  )
}