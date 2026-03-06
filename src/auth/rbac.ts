import { ForbiddenError } from '../errors/handler';
import { requireJWT } from './jwt-auth';

/**
 * Permission definitions for RBAC.
 * Maps roles to their allowed permissions.
 */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['users:read', 'users:write', 'users:delete', 'users:suspend', 'admin:access', 'audit:read', 'search:access', 'webhooks:manage', 'tenant:admin', 'tenant:read'],
  member: ['users:read', 'users:write', 'search:access', 'tenant:read'],
  viewer: ['users:read', 'search:access', 'tenant:read'],
};

/**
 * Check if the authenticated user has a specific permission.
 * Throws ForbiddenError if not authorized.
 */
export function requirePermission(req: Request, permission: string): void {
  const payload = requireJWT(req);
  const rolePermissions = ROLE_PERMISSIONS[payload.role] ?? [];

  if (!rolePermissions.includes(permission) && !payload.permissions.includes(permission)) {
    throw new ForbiddenError(
      `Permission denied: ${permission} not granted to role ${payload.role}`
    );
  }
}

/**
 * Check multiple permissions (all must be satisfied).
 */
export function requireAllPermissions(req: Request, permissions: string[]): void {
  for (const perm of permissions) {
    requirePermission(req, perm);
  }
}
