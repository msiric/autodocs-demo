import { getCircuitState } from '../errors/circuit-breaker';

/**
 * GET /api/health
 * Returns service health status. No authentication required.
 *
 * Checks:
 * - API is reachable (always true if this responds)
 * - Database connectivity (via a lightweight SELECT 1 query)
 * - Circuit breaker states for external services
 *
 * Returns 200 if healthy, 503 if any critical dependency is down.
 */

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: { status: 'up' | 'down'; latencyMs?: number };
    circuits: Record<string, { state: string; failures: number }>;
  };
}

const startTime = Date.now();

export async function healthCheck(): Promise<{ status: number; body: HealthStatus }> {
  const checks: HealthStatus['checks'] = {
    database: { status: 'down' },
    circuits: {},
  };

  // Check database
  try {
    const start = Date.now();
    await db.query('SELECT 1');
    checks.database = { status: 'up', latencyMs: Date.now() - start };
  } catch {
    checks.database = { status: 'down' };
  }

  // Check circuit breaker states
  for (const service of ['database', 'cache', 'webhook']) {
    const state = getCircuitState(service);
    if (state) {
      checks.circuits[service] = {
        state: state.state,
        failures: state.failures,
      };
    }
  }

  // Determine overall status
  const hasOpenCircuit = Object.values(checks.circuits).some(c => c.state === 'OPEN');
  let overallStatus: HealthStatus['status'] = 'healthy';
  if (checks.database.status === 'down') {
    overallStatus = 'unhealthy';
  } else if (hasOpenCircuit) {
    overallStatus = 'degraded';
  }

  const body: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION ?? '0.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };

  return {
    status: overallStatus === 'unhealthy' ? 503 : 200,
    body,
  };
}
