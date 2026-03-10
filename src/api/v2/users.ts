import { categorizeError, ValidationError } from '../../errors/handler';
import { requireJWT } from '../../auth/jwt-auth';
import { requirePermission } from '../../auth/rbac';
import { resolveTenant } from '../../config/tenants';

/**
 * V2 User API — enhanced response format with metadata.
 * All V2 responses include _meta with apiVersion, requestId, and cache info.
 */

interface V2Response<T> {
  data: T;
  _meta: {
    apiVersion: 'v2';
    requestId: string;
    cached: boolean;
    deprecations: string[];
  };
}

/**
 * GET /api/v2/users
 * V2 user listing with enhanced metadata and field selection.
 * Requires 'users:read' permission and apiVersion: 'v2' in JWT.
 */
export async function listUsersV2(
  req: Request,
  fields?: string[],
  cursor?: string,
  limit: number = 50,
): Promise<V2Response<unknown>> {
  const caller = requireJWT(req);
  if (caller.apiVersion !== 'v2') {
    throw new ValidationError('This endpoint requires API v2 token. Use /api/v2/auth to obtain one.');
  }
  requirePermission(req, 'users:read');
  const tenant = resolveTenant(caller);

  try {
    const selectFields = fields?.length
      ? fields.filter(f => ['id', 'name', 'email', 'role', 'status'].includes(f)).join(', ')
      : '*';

    const users = await db.query(
      `SELECT ${selectFields} FROM users WHERE tenantId = ? ORDER BY id LIMIT ?`,
      [tenant.id, limit],
    );

    return {
      data: users,
      _meta: {
        apiVersion: 'v2',
        requestId: crypto.randomUUID(),
        cached: false,
        deprecations: [],
      },
    };
  } catch (error) {
    throw categorizeError(error, 'listUsersV2');
  }
}
