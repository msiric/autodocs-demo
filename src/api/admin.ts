import { classifyError } from '../errors/handler';
import { requireJWT } from '../auth/jwt-auth';
import { requirePermission } from '../auth/permissions';
import { logAuditEvent, getAuditLog } from '../audit/logger';

/**
 * GET /api/admin/users
 * List all users with role details. Admin only.
 */
export async function adminListUsers(req: Request): Promise<AdminUserView[]> {
  const caller = requireJWT(req, 'admin');
  requirePermission(req, 'admin:access');
  try {
    const users = await db.query('SELECT * FROM users');
    logAuditEvent(caller.userId, 'admin:list_users', 'users', {}, 'success', getIP(req));
    return users.map(u => ({ ...u, lastLoginAt: u.lastLoginAt, permissions: u.permissions }));
  } catch (error) {
    logAuditEvent(caller.userId, 'admin:list_users', 'users', {}, 'failure', getIP(req));
    throw classifyError(error, 'adminListUsers');
  }
}

/**
 * PATCH /api/admin/users/:id/role
 * Update a user's role. Admin only.
 */
export async function updateUserRole(
  req: Request,
  userId: string,
  newRole: 'admin' | 'member' | 'viewer',
): Promise<void> {
  const caller = requireJWT(req, 'admin');
  requirePermission(req, 'users:write');
  try {
    await db.update('users', userId, { role: newRole });
    logAuditEvent(
      caller.userId,
      'admin:update_role',
      `user:${userId}`,
      { newRole },
      'success',
      getIP(req),
    );
  } catch (error) {
    logAuditEvent(caller.userId, 'admin:update_role', `user:${userId}`, { newRole }, 'failure', getIP(req));
    throw classifyError(error, 'updateUserRole');
  }
}

/**
 * GET /api/admin/audit
 * Retrieve audit log entries. Admin only.
 */
export async function getAuditEntries(req: Request): Promise<AuditEntry[]> {
  requireJWT(req, 'admin');
  requirePermission(req, 'audit:read');
  const since = req.url.searchParams?.get('since');
  const limit = parseInt(req.url.searchParams?.get('limit') ?? '50', 10);
  return getAuditLog({
    since: since ? new Date(since) : undefined,
    limit,
  });
}

function getIP(req: Request): string {
  return req.headers.get('X-Forwarded-For') || 'unknown';
}

interface AdminUserView {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLoginAt?: Date;
  permissions: string[];
}
