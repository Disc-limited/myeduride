import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const startTime = Date.now();
  let dbStatus: 'connected' | 'disconnected' = 'disconnected';
  let dbLatency = -1;
  let dbError: string | null = null;

  try {
    const supabase = getAdminClient();
    const dbQueryStart = Date.now();

    // Query 1 row from schools to verify database connectivity and auth
    const { error } = await supabase.from('schools').select('id').limit(1);

    dbLatency = Date.now() - dbQueryStart;

    if (error) {
      dbStatus = 'disconnected';
      dbError = error.message;
    } else {
      dbStatus = 'connected';
    }
  } catch (err: any) {
    dbStatus = 'disconnected';
    dbError = err?.message || 'Database connection error';
  }

  const memory = process.memoryUsage();
  const isHealthy = dbStatus === 'connected';
  const totalLatency = Date.now() - startTime;

  const payload = {
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    response_time_ms: totalLatency,
    services: {
      api: {
        status: 'healthy',
      },
      database: {
        status: dbStatus,
        latency_ms: dbLatency,
        ...(dbError ? { error: dbError } : {}),
      },
    },
    system: {
      node_version: process.version,
      memory: {
        heap_used_mb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
        heap_total_mb: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
        rss_mb: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
      },
    },
  };

  return NextResponse.json(payload, {
    status: isHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'X-Health-Status': payload.status,
    },
  });
}
