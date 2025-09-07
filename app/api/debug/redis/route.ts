import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export async function GET() {
  try {
    console.log('Debug: Testing Redis connection...');
    
    // Check environment variables
    const env = {
      REDIS_URL: process.env.REDIS_URL ? 'Set' : 'Not set',
      KV_URL: process.env.KV_URL ? 'Set' : 'Not set',
      REDIS_PASSWORD: process.env.REDIS_PASSWORD ? 'Set' : 'Not set',
    };
    
    console.log('Debug: Environment variables:', env);
    
    // Test Redis connection
    const redis = await getRedisClient();
    console.log('Debug: Redis client obtained');
    
    // Test basic operations
    await redis.set('test:connection', 'Hello Redis!');
    console.log('Debug: Test value set');
    
    const testValue = await redis.get('test:connection');
    console.log('Debug: Test value retrieved:', testValue);
    
    // Test playlist key listing
    const keys = await redis.keys('playlist:*');
    console.log('Debug: Found playlist keys:', keys);
    
    // Clean up test key
    await redis.del('test:connection');
    
    return NextResponse.json({
      success: true,
      message: 'Redis connection successful',
      environment: env,
      testValue,
      playlistKeys: keys,
      keyCount: keys.length
    });
    
  } catch (error) {
    console.error('Debug: Redis connection failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      environment: {
        REDIS_URL: process.env.REDIS_URL ? 'Set' : 'Not set',
        KV_URL: process.env.KV_URL ? 'Set' : 'Not set',
        REDIS_PASSWORD: process.env.REDIS_PASSWORD ? 'Set' : 'Not set',
      }
    }, { status: 500 });
  }
}