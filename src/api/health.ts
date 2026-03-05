/**
 * GET /api/health
 * Public health check endpoint. No authentication required.
 * Returns service status, version, and dependency health.
 */

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  checks: {
    database: 'ok' | 'error';
    cache: 'ok' | 'error';
  };
}

const startTime = Date.now();

export async function healthCheck(): Promise<HealthResponse> {
  const dbOk = await checkDatabase();
  const cacheOk = await checkCache();

  const status = dbOk && cacheOk ? 'healthy'
    : dbOk ? 'degraded'
    : 'unhealthy';

  return {
    status,
    version: process.env.APP_VERSION ?? '0.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: dbOk ? 'ok' : 'error',
      cache: cacheOk ? 'ok' : 'error',
    },
  };
}

async function checkDatabase(): Promise<boolean> {
  try {
    await db.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

async function checkCache(): Promise<boolean> {
  try {
    await cache.ping();
    return true;
  } catch {
    return false;
  }
}
