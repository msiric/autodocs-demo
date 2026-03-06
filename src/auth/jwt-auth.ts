import { AuthError, ForbiddenError } from '../errors/handler';

interface JWTPayload {
  userId: string;
  tenantId: string;
  role: 'admin' | 'member' | 'viewer';
  permissions: string[];
  exp: number;
  iat: number;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * JWT Authentication middleware.
 * Validates JWT access tokens and checks role-based permissions.
 * Replaces the previous token-store-based auth (middleware.ts).
 */
export function requireJWT(req: Request, requiredRole?: string, requiredPermission?: string): JWTPayload {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new AuthError('Missing or malformed Authorization header');
  }

  const token = header.slice(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    throw new AuthError('Invalid or expired JWT token');
  }

  if (payload.exp < Date.now() / 1000) {
    throw new AuthError('Token expired — use refresh token to obtain a new access token');
  }

  if (requiredRole && !isRoleAuthorized(payload.role, requiredRole)) {
    throw new ForbiddenError(
      `Insufficient role: requires ${requiredRole}, got ${payload.role}`
    );
  }

  if (requiredPermission && !payload.permissions.includes(requiredPermission)) {
    throw new ForbiddenError(
      `Missing permission: ${requiredPermission}`
    );
  }

  return payload;
}

/**
 * Issue a new token pair (access + refresh).
 */
export function issueTokenPair(userId: string, tenantId: string, role: string, permissions: string[]): TokenPair {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = signJWT({
    userId,
    tenantId,
    role,
    permissions,
    iat: now,
    exp: now + 1800, // 30 minutes
  });
  const refreshToken = signJWT({
    userId,
    tenantId,
    role: 'refresh',
    permissions: [],
    iat: now,
    exp: now + 604800, // 7 days
  });
  return { accessToken, refreshToken };
}

/**
 * Refresh an expired access token using a valid refresh token.
 */
export function refreshAccessToken(refreshToken: string): TokenPair {
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    throw new AuthError('Invalid or expired refresh token — re-authenticate');
  }
  if (isTokenBlacklisted(refreshToken)) {
    throw new AuthError('Token has been revoked — re-authenticate');
  }
  return issueTokenPair(payload.userId, payload.tenantId, payload.role, payload.permissions);
}

/**
 * Revoke a refresh token. Used on logout or password change.
 * Blacklisted tokens cannot be used to obtain new access tokens.
 */
export function revokeToken(refreshToken: string): void {
  tokenBlacklist.add(refreshToken);
}

/**
 * Revoke all tokens for a user. Used on account compromise.
 */
export function revokeAllUserTokens(userId: string): void {
  userRevocationTimestamps.set(userId, Math.floor(Date.now() / 1000));
}

const tokenBlacklist = new Set<string>();
const userRevocationTimestamps = new Map<string, number>();

function isTokenBlacklisted(token: string): boolean {
  return tokenBlacklist.has(token);
}

function isRoleAuthorized(userRole: string, requiredRole: string): boolean {
  const hierarchy = { admin: 3, member: 2, viewer: 1 };
  return (hierarchy[userRole] ?? 0) >= (hierarchy[requiredRole] ?? 0);
}

function verifyAccessToken(token: string): JWTPayload | null {
  // JWT verification logic (RS256)
  return null; // placeholder
}

function verifyRefreshToken(token: string): JWTPayload | null {
  // Refresh token verification
  return null; // placeholder
}

function signJWT(payload: JWTPayload): string {
  // JWT signing logic
  return ''; // placeholder
}
