import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

// Add CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

// This endpoint will log any request it receives
export async function POST(request: Request) {
  try {
    const requestTime = new Date().toISOString();
    console.log(`🔍 DEBUG REQUEST LOG at ${requestTime}`);
    console.log('Method:', request.method);
    console.log('URL:', request.url);
    console.log('Headers:', Object.fromEntries(request.headers.entries()));
    
    const body = await request.json();
    console.log('Body preview:', {
      ...body,
      keywords: body.keywords ? `${body.keywords.length} keywords` : 'no keywords'
    });
    
    if (body.keywords && body.keywords.length > 0) {
      console.log('Sample keywords:');
      body.keywords.slice(0, 3).forEach((k: any, i: number) => {
        console.log(`  ${i + 1}. "${k.keyword}" at ${k.timestamp}`);
      });
    }
    
    // Store this request in Redis for debugging
    const redis = await getRedisClient();
    const logKey = `request_log:${Date.now()}`;
    await redis.setEx(logKey, 3600, JSON.stringify({
      timestamp: requestTime,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      bodyPreview: {
        name: body.name,
        keywordsCount: body.keywords?.length || 0,
        sampleKeywords: body.keywords?.slice(0, 3) || []
      }
    }));
    
    const response = NextResponse.json({
      success: true,
      message: 'Request logged successfully',
      timestamp: requestTime
    });
    
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
    
  } catch (error) {
    console.error('❌ Request logging failed:', error);
    const response = NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
    
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }
}

export async function GET() {
  try {
    const redis = await getRedisClient();
    const logKeys = await redis.keys('request_log:*');
    const logs = [];
    
    for (const key of logKeys.slice(-10)) { // Get last 10 logs
      const log = await redis.get(key);
      if (log) {
        logs.push(JSON.parse(log));
      }
    }
    
    const response = NextResponse.json({
      success: true,
      logs: logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    });
    
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
    
  } catch (error) {
    console.error('❌ Failed to fetch request logs:', error);
    const response = NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
    
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }
}