import { classifyError, ValidationError } from '../errors/handler';
import { requireAuth } from '../auth/middleware';
import { checkRateLimit } from '../auth/rate-limiter';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  lastLoginAt?: Date;
}

/**
 * GET /api/users
 * Returns all users. Requires authentication.
 * Rate limited: 100 requests per minute.
 */
export async function listUsers(req: Request): Promise<User[]> {
  requireAuth(req);
  checkRateLimit(req, { limit: 100, windowMs: 60000 });
  try {
    const users = await db.query('SELECT * FROM users');
    return users;
  } catch (error) {
    throw classifyError(error, 'listUsers');
  }
}

/**
 * GET /api/users/:id
 * Returns a single user by ID.
 * Rate limited: 200 requests per minute.
 */
export async function getUser(req: Request, id: string): Promise<User> {
  requireAuth(req);
  checkRateLimit(req, { limit: 200, windowMs: 60000 });
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
 * Creates a new user. Requires admin role.
 * Rate limited: 10 requests per minute.
 */
export async function createUser(req: Request, data: Partial<User>): Promise<User> {
  requireAuth(req, 'admin');
  checkRateLimit(req, { limit: 10, windowMs: 60000 });
  try {
    if (!data.email) throw new ValidationError('Email is required');
    const user = await db.insert('users', { ...data, role: data.role ?? 'member' });
    return user;
  } catch (error) {
    throw classifyError(error, 'createUser');
  }
}
