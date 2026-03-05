import { RateLimitError } from '../errors/handler';

/**
 * Sliding window rate limiter middleware.
 * Tracks request counts per IP using an in-memory store.
 * Configurable per-route with different limits and windows.
 */

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowSeconds: 60,
};

const ROUTE_CONFIGS: Record<string, RateLimitConfig> = {
  'POST /api/users': { maxRequests: 10, windowSeconds: 60 },
  'DELETE /api/users': { maxRequests: 5, windowSeconds: 60 },
  'PATCH /api/admin': { maxRequests: 20, windowSeconds: 60 },
};

export function rateLimit(req: Request, route: string): void {
  const ip = req.headers.get('X-Forwarded-For') || 'unknown';
  const key = `${ip}:${route}`;
  const config = ROUTE_CONFIGS[route] ?? DEFAULT_CONFIG;
  const now = Math.floor(Date.now() / 1000);

  let entry = store.get(key);

  if (!entry || now - entry.windowStart >= config.windowSeconds) {
    entry = { count: 0, windowStart: now };
  }

  entry.count++;
  store.set(key, entry);

  if (entry.count > config.maxRequests) {
    const retryAfter = config.windowSeconds - (now - entry.windowStart);
    throw new RateLimitError(
      `Rate limit exceeded: ${config.maxRequests} requests per ${config.windowSeconds}s`,
      retryAfter,
      config.maxRequests,
      config.windowSeconds,
    );
  }
}

/**
 * Clean up expired entries. Call periodically to prevent memory leaks.
 */
export function cleanupExpiredEntries(): void {
  const now = Math.floor(Date.now() / 1000);
  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart >= 300) {
      store.delete(key);
    }
  }
}

/**
 * IP blocklist guard.
 * Blocks requests from known-bad IPs. Loaded from config at startup.
 */
const blockedIPs = new Set<string>();

export function blockIP(ip: string): void {
  blockedIPs.add(ip);
}

export function unblockIP(ip: string): void {
  blockedIPs.delete(ip);
}

export function requireNotBlocked(req: Request): void {
  const ip = req.headers.get('X-Forwarded-For') || 'unknown';
  if (blockedIPs.has(ip)) {
    throw new ForbiddenError(`IP ${ip} is blocked`);
  }
}

import { ForbiddenError } from '../errors/handler';
