import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export async function GET() {
  try {
    console.log('🎯 FINAL TERRITORY FIX: Targeting exact "unknown" strings...');
    
    const redis = await getRedisClient();
    
    // Get the exact playlist data from Redis
    const keys = await redis.keys('playlist:*');
    console.log(`Found ${keys.length} playlist keys in Redis`);
    
    let totalFixed = 0;
    
    for (const key of keys) {
      const rawData = await redis.hGet(key, 'data');
      if (!rawData) continue;
      
      const playlist = JSON.parse(rawData);
      console.log(`\nProcessing ${playlist.name}: ${playlist.keywords.length} keywords`);
      
      let fixedInThisPlaylist = 0;
      
      // Create NEW array with ALL territories fixed
      const fixedKeywords = playlist.keywords.map((keyword: any) => {
        if (keyword.territory === 'unknown') {
          console.log(`  ✅ Fixing: "${keyword.keyword}" (${keyword.timestamp})`);
          fixedInThisPlaylist++;
          totalFixed++;
          
          return {
            ...keyword,
            territory: 'de'
          };
        }
        return keyword;
      });
      
      // FORCE save the fixed data
      const updatedPlaylist = {
        ...playlist,
        keywords: fixedKeywords
      };
      
      // Write directly to Redis with explicit overwrite
      await redis.hSet(key, 'data', JSON.stringify(updatedPlaylist));
      
      console.log(`  🔄 Fixed ${fixedInThisPlaylist} keywords in ${playlist.name}`);
      
      // Verify the save worked
      const verifyData = await redis.hGet(key, 'data');
      const verifiedPlaylist = JSON.parse(verifyData!);
      const remainingUnknown = verifiedPlaylist.keywords.filter((k: any) => k.territory === 'unknown').length;
      
      console.log(`  ✅ Verification: ${remainingUnknown} unknown territories remaining`);
      
      if (remainingUnknown > 0) {
        console.error(`  ❌ SAVE FAILED! Still ${remainingUnknown} unknown territories after save`);
      }
    }
    
    console.log(`\n🎉 FINAL FIX COMPLETE: ${totalFixed} territories fixed`);
    
    // Final verification - check all data again
    console.log('\n🔍 Final verification scan...');
    let finalUnknownCount = 0;
    
    for (const key of keys) {
      const rawData = await redis.hGet(key, 'data');
      if (!rawData) continue;
      
      const playlist = JSON.parse(rawData);
      const unknownKeywords = playlist.keywords.filter((k: any) => k.territory === 'unknown');
      finalUnknownCount += unknownKeywords.length;
      
      if (unknownKeywords.length > 0) {
        console.log(`  ❌ Still has ${unknownKeywords.length} unknown in ${playlist.name}`);
        unknownKeywords.slice(0, 3).forEach((k: any) => {
          console.log(`    - "${k.keyword}" = "${k.territory}"`);
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'FINAL territory fix completed',
      stats: {
        totalFixed,
        finalUnknownRemaining: finalUnknownCount,
        status: finalUnknownCount === 0 ? 'ALL_CLEAN' : 'STILL_HAS_UNKNOWN'
      }
    });
    
  } catch (error) {
    console.error('❌ FINAL territory fix failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}