import { categorizeError } from '../errors/handler';
import { requireJWT } from '../auth/jwt-auth';
import { requirePermission } from '../auth/rbac';
import { listTenants, getTenant } from '../config/tenants';

/**
 * GET /api/admin/users
 * List all users with role details and status. Admin only.
 * Supports pagination via ?page=N&pageSize=N query params.
 */
export async function adminListUsers(
  req: Request,
  page: number = 1,
  pageSize: number = 50,
): Promise<PaginatedAdminView> {
  const caller = requireJWT(req, 'admin');
  requirePermission(req, 'admin:access');
  try {
    const offset = (page - 1) * pageSize;
    const users = await db.query('SELECT * FROM users LIMIT ? OFFSET ?', [pageSize, offset]);
    const total = await db.count('users');
    console.log(JSON.stringify({
      event: 'admin:list_users',
      actor: caller.userId,
      outcome: 'success',
      ip: getIP(req),
      timestamp: new Date().toISOString(),
    }));
    return {
      data: users.map(u => ({
        ...u,
        lastLoginAt: u.lastLoginAt,
        permissions: u.permissions,
        status: u.status,
      })),
      total,
      page,
      pageSize,
    };
  } catch (error) {
    console.log(JSON.stringify({
      event: 'admin:list_users',
      actor: caller.userId,
      outcome: 'failure',
      ip: getIP(req),
      timestamp: new Date().toISOString(),
    }));
    throw categorizeError(error, 'adminListUsers');
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
    await db.update('users', userId, { role: newRole, updatedAt: new Date() });
    console.log(JSON.stringify({
      event: 'admin:update_role',
      actor: caller.userId,
      target: `user:${userId}`,
      details: { newRole },
      outcome: 'success',
      ip: getIP(req),
      timestamp: new Date().toISOString(),
    }));
  } catch (error) {
    console.log(JSON.stringify({
      event: 'admin:update_role',
      actor: caller.userId,
      target: `user:${userId}`,
      details: { newRole },
      outcome: 'failure',
      ip: getIP(req),
      timestamp: new Date().toISOString(),
    }));
    throw categorizeError(error, 'updateUserRole');
  }
}

/**
 * PATCH /api/admin/users/:id/status
 * Suspend or reactivate a user account. Admin only.
 */
export async function updateUserStatus(
  req: Request,
  userId: string,
  newStatus: 'active' | 'suspended',
): Promise<void> {
  const caller = requireJWT(req, 'admin');
  requirePermission(req, 'users:write');
  try {
    await db.update('users', userId, { status: newStatus, updatedAt: new Date() });
    console.log(JSON.stringify({
      event: 'admin:update_status',
      actor: caller.userId,
      target: `user:${userId}`,
      details: { newStatus },
      outcome: 'success',
      ip: getIP(req),
      timestamp: new Date().toISOString(),
    }));
  } catch (error) {
    throw categorizeError(error, 'updateUserStatus');
  }
}

function getIP(req: Request): string {
  return req.headers.get('X-Forwarded-For') || 'unknown';
}

interface PaginatedAdminView {
  data: AdminUserView[];
  total: number;
  page: number;
  pageSize: number;
}

interface AdminUserView {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt?: Date;
  permissions: string[];
}

/**
 * GET /api/admin/tenants
 * List all tenants. Requires tenant:admin permission.
 */
export async function adminListTenants(req: Request): Promise<TenantView[]> {
  requireJWT(req, 'admin');
  requirePermission(req, 'tenant:admin');
  const tenants = listTenants();
  return tenants.map(t => ({
    id: t.id,
    name: t.name,
    maxUsers: t.maxUsers,
    features: t.features,
  }));
}

/**
 * GET /api/admin/tenants/:id
 * Get tenant details. Requires tenant:admin permission.
 */
export async function adminGetTenant(req: Request, tenantId: string): Promise<TenantView> {
  requireJWT(req, 'admin');
  requirePermission(req, 'tenant:admin');
  const tenant = getTenant(tenantId);
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);
  return {
    id: tenant.id,
    name: tenant.name,
    maxUsers: tenant.maxUsers,
    features: tenant.features,
  };
}

interface TenantView {
  id: string;
  name: string;
  maxUsers: number;
  features: { search: boolean; webhooks: boolean; advancedRbac: boolean };
}
