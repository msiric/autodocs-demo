import { categorizeError, ValidationError } from '../errors/handler';
import { requireJWT } from '../auth/jwt-auth';
import { requirePermission } from '../auth/rbac';

interface SearchResult {
  users: Array<{ id: string; name: string; email: string; relevance: number }>;
  total: number;
  query: string;
  took: number;
}

/**
 * GET /api/search?q=<query>&type=users&limit=20
 * Full-text search across users. Requires 'users:read' permission.
 * Supports field-specific search: "name:alice" or "email:@company.com"
 */
export async function searchUsers(
  req: Request,
  query: string,
  limit: number = 20,
): Promise<SearchResult> {
  requireJWT(req);
  requirePermission(req, 'users:read');

  if (!query || query.length < 2) {
    throw new ValidationError('Search query must be at least 2 characters', [
      'query: minimum length is 2',
    ]);
  }
  if (limit > 100) {
    throw new ValidationError('Search limit cannot exceed 100', [
      'limit: maximum value is 100',
    ]);
  }

  try {
    const start = Date.now();
    const { field, value } = parseFieldQuery(query);

    let results;
    if (field) {
      results = await db.query(
        `SELECT id, name, email FROM users WHERE ${field} LIKE ? LIMIT ?`,
        [`%${value}%`, limit],
      );
    } else {
      results = await db.query(
        'SELECT id, name, email FROM users WHERE name LIKE ? OR email LIKE ? LIMIT ?',
        [`%${query}%`, `%${query}%`, limit],
      );
    }

    return {
      users: results.map((u: any, i: number) => ({ ...u, relevance: 1 - i * 0.01 })),
      total: results.length,
      query,
      took: Date.now() - start,
    };
  } catch (error) {
    throw categorizeError(error, 'searchUsers');
  }
}

function parseFieldQuery(query: string): { field?: string; value: string } {
  const match = query.match(/^(name|email|role):(.+)$/);
  if (match) {
    return { field: match[1], value: match[2] };
  }
  return { value: query };
}
