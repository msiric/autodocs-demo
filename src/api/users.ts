import { categorizeError, ValidationError, TenantError, CacheError } from '../errors/handler';
import { requireJWT, detectAuthMethod } from '../auth/jwt-auth';
import { requireApiKey, requireApiKeyPermission } from '../auth/api-keys';
import { requirePermission } from '../auth/permissions';
import { dispatchEvent } from '../webhooks/dispatcher';
import { resolveTenant } from '../config/tenants';
import { logAuditEvent } from '../auth/audit';
import { enforceRateLimit, getRateLimitStatus } from './rate-limiter';

const responseCache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 60_000; // 60 seconds

interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: 'admin' | 'member' | 'viewer';
  permissions: string[];
  status: 'active' | 'suspended' | 'pending';
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface CursorPaginatedResponse<T> {
  data: T[];
  total: number;
  cursor?: string;
  hasMore: boolean;
}

/**
 * GET /api/users
 * Returns paginated users. Requires 'users:read' permission.
 */
export async function listUsers(
  req: Request,
  cursor?: string,
  limit: number = 20,
): Promise<CursorPaginatedResponse<User>> {
  // Dual auth: accept either JWT or API key
  const authMethod = detectAuthMethod(req);
  let tenant;
  if (authMethod === 'api_key') {
    const key = requireApiKey(req);
    requireApiKeyPermission(key, 'users:read');
    tenant = { id: key.tenantId, maxUsers: Infinity };
    enforceRateLimit(req, 'GET /api/users', key.tenantId);
  } else {
    const caller = requireJWT(req);
    requirePermission(req, 'users:read');
    tenant = resolveTenant(caller);
    enforceRateLimit(req, 'GET /api/users', tenant.id);
  }
  try {
    if (limit > 100) throw new ValidationError('Limit cannot exceed 100');

    // Check response cache
    const cacheKey = `users:${tenant.id}:${cursor || 'start'}:${limit}`;
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data as CursorPaginatedResponse<User>;
    }

    const query = cursor
      ? 'SELECT * FROM users WHERE tenantId = ? AND id > ? ORDER BY id LIMIT ?'
      : 'SELECT * FROM users WHERE tenantId = ? ORDER BY id LIMIT ?';
    const params = cursor ? [tenant.id, cursor, limit + 1] : [tenant.id, limit + 1];
    const users = await db.query(query, params);
    const hasMore = users.length > limit;
    const data = hasMore ? users.slice(0, limit) : users;
    const total = await db.count('users');
    const result = { data, total, cursor: hasMore ? data[data.length - 1].id : undefined, hasMore };

    // Cache the response
    try {
      responseCache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });
    } catch (e) {
      throw new CacheError('Failed to cache user list response', cacheKey, 'set');
    }

    return result;
  } catch (error) {
    throw categorizeError(error, 'listUsers');
  }
}

/**
 * GET /api/users/:id
 * Returns a single user by ID.
 */
export async function getUser(req: Request, id: string): Promise<User> {
  requireJWT(req);
  requirePermission(req, 'users:read');
  try {
    if (!id || id.length > 36) throw new ValidationError('Invalid user ID format');
    const user = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) throw new NotFoundError(`User ${id} not found`);
    return user;
  } catch (error) {
    throw categorizeError(error, 'getUser');
  }
}

/**
 * POST /api/users
 * Creates a new user. Requires 'users:write' permission.
 */
export async function createUser(req: Request, data: Partial<User>): Promise<User> {
  const caller = requireJWT(req, 'admin');
  requirePermission(req, 'users:write');
  const tenant = resolveTenant(caller);
  enforceRateLimit(req, 'POST /api/users', tenant.id);
  try {
    if (!data.email) throw new ValidationError('Email is required');
    if (!data.name) throw new ValidationError('Name is required');
    if (tenant.maxUsers && await db.count('users', { tenantId: tenant.id }) >= tenant.maxUsers) {
      throw new TenantError(`Tenant ${tenant.id} has reached user limit (${tenant.maxUsers})`);
    }
    const user = await db.insert('users', {
      ...data,
      tenantId: tenant.id,
      displayName: data.displayName ?? data.name,
      role: data.role ?? 'viewer',
      permissions: data.permissions ?? [],
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await dispatchEvent('user.created', { userId: user.id, tenantId: tenant.id, role: user.role });
    return user;
  } catch (error) {
    throw categorizeError(error, 'createUser');
  }
}

/**
 * PATCH /api/users/:id
 * Updates an existing user's profile. Requires 'users:write' permission.
 * Users can update their own profile; admins can update anyone.
 */
export async function updateUser(
  req: Request,
  id: string,
  data: Partial<Pick<User, 'name' | 'email' | 'displayName' | 'avatarUrl'>>,
): Promise<User> {
  const caller = requireJWT(req);
  if (caller.userId !== id) {
    requirePermission(req, 'users:write');
  }
  try {
    if (!id || id.length > 36) throw new ValidationError('Invalid user ID format');
    const user = await db.update('users', id, data);
    if (!user) throw new NotFoundError(`User ${id} not found`);
    return user;
  } catch (error) {
    throw categorizeError(error, 'updateUser');
  }
}

/**
 * DELETE /api/users/:id
 * Soft-deletes a user by setting status to 'suspended'.
 * Requires 'users:delete' permission. Cannot delete self.
 */
export async function deleteUser(req: Request, id: string): Promise<void> {
  const caller = requireJWT(req, 'admin');
  requirePermission(req, 'users:delete');
  try {
    if (caller.userId === id) {
      throw new ValidationError('Cannot delete your own account');
    }
    const user = await db.update('users', id, {
      status: 'suspended',
      updatedAt: new Date(),
    });
    if (!user) throw new NotFoundError(`User ${id} not found`);
    await dispatchEvent('user.deleted', { userId: id });
  } catch (error) {
    throw categorizeError(error, 'deleteUser');
  }
}
