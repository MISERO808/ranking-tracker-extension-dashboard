import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export async function GET() {
  try {
    console.log('💪 ULTRA TERRITORY FIX: Nuclear option for persistent unknowns...');
    
    const redis = await getRedisClient();
    
    // Get ALL playlist keys
    const keys = await redis.keys('playlist:*');
    console.log(`Found ${keys.length} playlist keys in Redis`);
    
    let totalProcessed = 0;
    let totalFixed = 0;
    let finalVerificationResults: any[] = [];
    
    for (const key of keys) {
      const rawData = await redis.hGet(key, 'data');
      if (!rawData) {
        console.log(`⚠️  No data found for key: ${key}`);
        continue;
      }
      
      let playlist;
      try {
        playlist = JSON.parse(rawData);
      } catch (parseError) {
        console.error(`❌ Failed to parse data for ${key}:`, parseError);
        continue;
      }
      
      console.log(`\n🔄 Processing ${playlist.name || 'Unknown Playlist'}: ${playlist.keywords?.length || 0} keywords`);
      
      if (!playlist.keywords || !Array.isArray(playlist.keywords)) {
        console.log(`⚠️  No keywords array found for ${playlist.name}`);
        continue;
      }
      
      let fixedInThisPlaylist = 0;
      
      // NUCLEAR APPROACH: Create completely new array
      const ultraFixedKeywords = [];
      
      for (const keyword of playlist.keywords) {
        totalProcessed++;
        
        // Check if territory needs fixing
        const needsFix = (
          !keyword.territory || 
          keyword.territory === 'unknown' ||
          keyword.territory === 'Unknown' ||
          keyword.territory === 'UNKNOWN' ||
          keyword.territory.toString().toLowerCase().trim() === 'unknown' ||
          keyword.territory.toString().trim() === ''
        );
        
        if (needsFix) {
          console.log(`  🎯 FIXING: "${keyword.keyword}" from "${keyword.territory}" to "de"`);
          ultraFixedKeywords.push({
            ...keyword,
            territory: 'de'
          });
          fixedInThisPlaylist++;
          totalFixed++;
        } else {
          // Keep existing, but normalize to lowercase
          ultraFixedKeywords.push({
            ...keyword,
            territory: keyword.territory.toString().toLowerCase()
          });
        }
      }
      
      // Create COMPLETELY new playlist object
      const ultraFixedPlaylist = {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description || '',
        image: playlist.image || '',
        owner: playlist.owner || '',
        tracks: playlist.tracks || 0,
        keywords: ultraFixedKeywords
      };
      
      // FORCE DELETE AND RECREATE the Redis entry
      console.log(`  🗑️  Deleting old entry for ${key}`);
      await redis.del(key);
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // SET completely new data (not hSet)
      console.log(`  ✏️  Writing new data to ${key}`);
      await redis.hSet(key, 'data', JSON.stringify(ultraFixedPlaylist));
      
      // IMMEDIATE verification
      const immediateVerify = await redis.hGet(key, 'data');
      if (immediateVerify) {
        const verifiedPlaylist = JSON.parse(immediateVerify);
        const stillUnknown = verifiedPlaylist.keywords.filter((k: any) => {
          const territory = k.territory?.toString().toLowerCase().trim();
          return !territory || territory === 'unknown';
        });
        
        console.log(`  ✅ IMMEDIATE VERIFY: ${stillUnknown.length} unknown territories remaining in ${playlist.name}`);
        
        finalVerificationResults.push({
          playlistName: playlist.name,
          keywordsProcessed: playlist.keywords.length,
          keywordsFixed: fixedInThisPlaylist,
          stillUnknownAfterSave: stillUnknown.length,
          stillUnknownKeywords: stillUnknown.slice(0, 3).map((k: any) => ({
            keyword: k.keyword,
            territory: k.territory
          }))
        });
      } else {
        console.error(`❌ FAILED TO VERIFY SAVE for ${key}`);
        finalVerificationResults.push({
          playlistName: playlist.name,
          error: 'Failed to verify save'
        });
      }
    }
    
    console.log(`\n🎉 ULTRA FIX COMPLETE!`);
    console.log(`📊 Total keywords processed: ${totalProcessed}`);
    console.log(`🔧 Total territories fixed: ${totalFixed}`);
    
    // FINAL GLOBAL VERIFICATION
    console.log('\n🔍 GLOBAL VERIFICATION SCAN...');
    let globalUnknownCount = 0;
    const globalUnknownSamples: any[] = [];
    
    const finalKeys = await redis.keys('playlist:*');
    for (const key of finalKeys) {
      const rawData = await redis.hGet(key, 'data');
      if (!rawData) continue;
      
      const playlist = JSON.parse(rawData);
      if (!playlist.keywords) continue;
      
      for (const keyword of playlist.keywords) {
        const territory = keyword.territory?.toString().toLowerCase().trim();
        if (!territory || territory === 'unknown') {
          globalUnknownCount++;
          if (globalUnknownSamples.length < 10) {
            globalUnknownSamples.push({
              playlist: playlist.name,
              keyword: keyword.keyword,
              territory: keyword.territory,
              territoryType: typeof keyword.territory
            });
          }
        }
      }
    }
    
    console.log(`🔍 GLOBAL RESULT: ${globalUnknownCount} unknown territories found`);
    if (globalUnknownSamples.length > 0) {
      console.log('❌ Remaining unknowns:');
      globalUnknownSamples.forEach(sample => {
        console.log(`  - "${sample.keyword}" in ${sample.playlist}: "${sample.territory}" (${sample.territoryType})`);
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'ULTRA territory fix completed',
      stats: {
        totalProcessed,
        totalFixed,
        globalUnknownRemaining: globalUnknownCount,
        status: globalUnknownCount === 0 ? 'ALL_CLEAN' : 'STILL_HAS_UNKNOWN',
        playlistResults: finalVerificationResults,
        globalUnknownSamples
      }
    });
    
  } catch (error) {
    console.error('❌ ULTRA territory fix failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}