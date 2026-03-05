import { categorizeError, ValidationError } from '../errors/handler';
import { requireJWT } from '../auth/jwt-auth';
import { requirePermission } from '../auth/rbac';

interface User {
  id: string;
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

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * GET /api/users
 * Returns paginated users. Requires 'users:read' permission.
 */
export async function listUsers(
  req: Request,
  page: number = 1,
  pageSize: number = 20,
): Promise<PaginatedResponse<User>> {
  requireJWT(req);
  requirePermission(req, 'users:read');
  try {
    const offset = (page - 1) * pageSize;
    const users = await db.query('SELECT * FROM users LIMIT ? OFFSET ?', [pageSize, offset]);
    const total = await db.count('users');
    return { data: users, total, page, pageSize };
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
  requireJWT(req, 'admin');
  requirePermission(req, 'users:write');
  try {
    if (!data.email) throw new ValidationError('Email is required');
    if (!data.name) throw new ValidationError('Name is required');
    const user = await db.insert('users', {
      ...data,
      displayName: data.displayName ?? data.name,
      role: data.role ?? 'member',
      permissions: data.permissions ?? [],
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
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
  } catch (error) {
    throw categorizeError(error, 'deleteUser');
  }
}
