// Script to manually update playlist images
// Run with: node scripts/update-images.js

async function updateImages() {
  console.log('🎨 Starting playlist image update...\n');
  
  const baseUrl = process.argv[2] || 'https://spotify-tracker-extension-tnth3e5ay-nicos-projects-444860d3.vercel.app';
  
  try {
    // First check if Spotify API is configured
    console.log('1️⃣ Checking Spotify API configuration...');
    const configCheck = await fetch(`${baseUrl}/api/playlists/update-images`);
    const configStatus = await configCheck.json();
    
    if (!configStatus.configured) {
      console.error('❌ Spotify API not configured!');
      console.log('\n' + JSON.stringify(configStatus.instructions, null, 2));
      return;
    }
    
    console.log('✅ Spotify API is configured\n');
    
    // Now update images
    console.log('2️⃣ Fetching missing images...');
    const response = await fetch(`${baseUrl}/api/playlists/update-images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`\n✅ Success!`);
      console.log(`   Updated: ${result.updated} playlists`);
      console.log(`   Failed: ${result.failed}`);
      console.log(`   Total: ${result.total}`);
      
      if (result.results) {
        console.log('\n📋 Details:');
        result.results.forEach(r => {
          const icon = r.status === 'updated' ? '✅' : 
                       r.status === 'skipped' ? '⏭️' : 
                       r.status === 'no_image_found' ? '❓' : '❌';
          console.log(`   ${icon} ${r.name}: ${r.status} ${r.reason || ''}`);
          if (r.imageUrl) {
            console.log(`      → ${r.imageUrl.substring(0, 50)}...`);
          }
        });
      }
    } else {
      console.error('❌ Error:', result.error);
      if (result.details) {
        console.error('   Details:', result.details);
      }
    }
  } catch (error) {
    console.error('❌ Failed to connect:', error.message);
    console.log('\n💡 Usage: node scripts/update-images.js [base-url]');
    console.log('   Default: https://spotify-tracker-extension-tnth3e5ay-nicos-projects-444860d3.vercel.app');
    console.log('   Local: node scripts/update-images.js http://localhost:3000');
  }
}

updateImages();