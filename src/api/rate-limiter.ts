import { RateLimitError } from '../errors/handler';
import { logAuditEvent } from '../auth/audit';

/**
 * In-memory sliding window rate limiter.
 * Tracks request counts per key (IP, user ID, or API key) in time windows.
 * Supports per-endpoint configuration with different limits and windows.
 */

interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
  /** Key extractor: what identifies the client ('ip', 'user', 'api_key', 'tenant') */
  keyBy: 'ip' | 'user' | 'api_key' | 'tenant';
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
  firstRequestAt: Date;
}

/** Per-endpoint rate limit configuration */
const ENDPOINT_LIMITS: Record<string, RateLimitConfig> = {
  'GET /api/users': { limit: 100, windowSeconds: 60, keyBy: 'tenant' },
  'POST /api/users': { limit: 10, windowSeconds: 60, keyBy: 'tenant' },
  'PATCH /api/users/:id': { limit: 30, windowSeconds: 60, keyBy: 'user' },
  'DELETE /api/users/:id': { limit: 5, windowSeconds: 60, keyBy: 'user' },
};

/** Default rate limit for endpoints without specific configuration */
const DEFAULT_LIMIT: RateLimitConfig = { limit: 60, windowSeconds: 60, keyBy: 'ip' };

/** In-memory storage for rate limit counters */
const counters = new Map<string, RateLimitEntry>();

/** Interval for cleaning expired entries (every 5 minutes) */
const CLEANUP_INTERVAL = 5 * 60 * 1000;

/**
 * Check and enforce rate limit for a request.
 * Throws RateLimitError if the limit is exceeded.
 *
 * @param req - The incoming request
 * @param endpoint - Endpoint identifier (e.g., 'GET /api/users')
 * @param clientKey - Pre-extracted client identifier (IP, userId, apiKeyId, or tenantId)
 */
export function enforceRateLimit(
  req: Request,
  endpoint: string,
  clientKey: string,
): void {
  const config = ENDPOINT_LIMITS[endpoint] ?? DEFAULT_LIMIT;
  const bucketKey = `${endpoint}:${config.keyBy}:${clientKey}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  let entry = counters.get(bucketKey);

  // Reset if window has expired
  if (!entry || now - entry.windowStart >= windowMs) {
    entry = { count: 0, windowStart: now, firstRequestAt: new Date() };
    counters.set(bucketKey, entry);
  }

  entry.count++;

  if (entry.count > config.limit) {
    const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);

    logAuditEvent({
      action: 'rate_limit.exceeded',
      endpoint,
      clientKey,
      limit: config.limit,
      windowSeconds: config.windowSeconds,
    });

    throw new RateLimitError(
      `Rate limit exceeded for ${endpoint}`,
      retryAfter,
      config.limit,
      config.windowSeconds,
    );
  }
}

/**
 * Get current rate limit status for a client on an endpoint.
 * Useful for adding X-RateLimit-* response headers.
 */
export function getRateLimitStatus(
  endpoint: string,
  clientKey: string,
): { limit: number; remaining: number; resetAt: number } {
  const config = ENDPOINT_LIMITS[endpoint] ?? DEFAULT_LIMIT;
  const bucketKey = `${endpoint}:${config.keyBy}:${clientKey}`;
  const entry = counters.get(bucketKey);
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  if (!entry || now - entry.windowStart >= windowMs) {
    return { limit: config.limit, remaining: config.limit, resetAt: now + windowMs };
  }

  return {
    limit: config.limit,
    remaining: Math.max(0, config.limit - entry.count),
    resetAt: entry.windowStart + windowMs,
  };
}

/**
 * Clean up expired entries from the counter map.
 * Called periodically to prevent memory leaks.
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of counters.entries()) {
    // Find the config to get the window — use the longest window (60s) as default
    if (now - entry.windowStart > 120_000) {
      counters.delete(key);
    }
  }
}

// Start periodic cleanup
setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL);
