/**
 * GET /api/status
 * Combined health + version + feature flags endpoint.
 * Replaces the previous /api/health endpoint.
 * Public — no authentication required.
 */

interface StatusResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  features: {
    search: boolean;
    webhooks: boolean;
    rateLimiting: boolean;
  };
  checks: {
    database: 'ok' | 'error';
    cache: 'ok' | 'error';
    webhookDelivery: 'ok' | 'error';
  };
}

const startTime = Date.now();

export async function getStatus(): Promise<StatusResponse> {
  const dbOk = await checkDatabase();
  const cacheOk = await checkCache();
  const webhookOk = await checkWebhookDelivery();

  const allOk = dbOk && cacheOk && webhookOk;
  const status = allOk ? 'healthy'
    : dbOk ? 'degraded'
    : 'unhealthy';

  return {
    status,
    version: process.env.APP_VERSION ?? '2.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    features: {
      search: true,
      webhooks: true,
      rateLimiting: true,
    },
    checks: {
      database: dbOk ? 'ok' : 'error',
      cache: cacheOk ? 'ok' : 'error',
      webhookDelivery: webhookOk ? 'ok' : 'error',
    },
  };
}

async function checkDatabase(): Promise<boolean> {
  try { await db.query('SELECT 1'); return true; } catch { return false; }
}

async function checkCache(): Promise<boolean> {
  try { await cache.ping(); return true; } catch { return false; }
}

async function checkWebhookDelivery(): Promise<boolean> {
  try { await fetch('http://localhost:9090/health'); return true; } catch { return false; }
}
