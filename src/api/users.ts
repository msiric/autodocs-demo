import { handleError } from '../errors/handler';
import { requireAuth } from '../auth/middleware';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
}

/**
 * GET /api/users
 * Returns all users. Requires authentication.
 */
export async function listUsers(req: Request): Promise<User[]> {
  requireAuth(req);
  try {
    const users = await db.query('SELECT * FROM users');
    return users;
  } catch (error) {
    throw handleError(error, 'listUsers');
  }
}

/**
 * GET /api/users/:id
 * Returns a single user by ID.
 */
export async function getUser(req: Request, id: string): Promise<User> {
  requireAuth(req);
  try {
    const user = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) throw new NotFoundError(`User ${id} not found`);
    return user;
  } catch (error) {
    throw handleError(error, 'getUser');
  }
}

/**
 * POST /api/users
 * Creates a new user. Requires admin role.
 */
export async function createUser(req: Request, data: Partial<User>): Promise<User> {
  requireAuth(req, 'admin');
  try {
    const user = await db.insert('users', { ...data, role: 'member' });
    return user;
  } catch (error) {
    throw handleError(error, 'createUser');
  }
}
