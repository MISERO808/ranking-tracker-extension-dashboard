export default function Home() {
  return (
    <main className="min-h-screen bg-spotify-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-spotify-green">
          Spotify Ranking Tracker
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Placeholder for playlist cards */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Playlist 1</h2>
            <p className="text-spotify-gray">Total keywords: 0</p>
            <p className="text-spotify-gray">Best position: N/A</p>
            <p className="text-spotify-gray">Last updated: Never</p>
          </div>
        </div>
      </div>
    </main>
  )
}