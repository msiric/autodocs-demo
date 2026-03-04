import { classifyError, ValidationError } from '../errors/handler';
import { requireJWT } from '../auth/jwt-auth';
import { requirePermission } from '../auth/permissions';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  permissions: string[];
  lastLoginAt?: Date;
  createdAt: Date;
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
    throw classifyError(error, 'listUsers');
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
    throw classifyError(error, 'getUser');
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
      role: data.role ?? 'viewer',
      permissions: data.permissions ?? [],
      createdAt: new Date(),
    });
    return user;
  } catch (error) {
    throw classifyError(error, 'createUser');
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
  data: Partial<Pick<User, 'name' | 'email'>>,
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
    throw classifyError(error, 'updateUser');
  }
}
