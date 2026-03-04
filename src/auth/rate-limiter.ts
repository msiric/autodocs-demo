import { RateLimitError } from '../errors/handler';

interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

const requestCounts = new Map<string, { count: number; resetAt: number }>();

/**
 * Rate limiting middleware.
 * Tracks requests per IP and throws RateLimitError if exceeded.
 */
export function checkRateLimit(req: Request, options: RateLimitOptions): void {
  const ip = req.headers.get('X-Forwarded-For') || 'unknown';
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + options.windowMs });
    return;
  }

  entry.count++;
  if (entry.count > options.limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    throw new RateLimitError(
      `Rate limit exceeded. Try again in ${retryAfter}s`,
      retryAfter,
    );
  }
}
