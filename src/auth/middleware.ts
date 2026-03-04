import { AuthError } from '../errors/handler';

/**
 * Authentication middleware.
 * Validates the request has a valid session token.
 * Optionally checks for a specific role.
 */
export function requireAuth(req: Request, requiredRole?: string): void {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) {
    throw new AuthError('Missing authentication token');
  }

  const session = validateToken(token);
  if (!session) {
    throw new AuthError('Invalid or expired token');
  }

  if (requiredRole && session.role !== requiredRole) {
    throw new AuthError(`Required role: ${requiredRole}, got: ${session.role}`);
  }
}

function validateToken(token: string): Session | null {
  // Token validation logic
  return tokenStore.get(token) ?? null;
}

interface Session {
  userId: string;
  role: string;
  expiresAt: Date;
}
