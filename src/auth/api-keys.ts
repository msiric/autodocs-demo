import { AuthError, ForbiddenError, ValidationError } from '../errors/handler';
import { logAuditEvent } from './audit';

/**
 * API Key authentication — alternative to JWT for service-to-service calls.
 *
 * Keys are scoped to specific permissions and have independent rate limits.
 * Format: `ak_live_<32-char-hex>` (live) or `ak_test_<32-char-hex>` (test).
 *
 * Unlike JWT tokens, API keys:
 * - Do not expire (must be manually revoked)
 * - Are tied to a tenant, not a user
 * - Have their own rate limit tier (separate from user rate limits)
 * - Cannot access admin endpoints
 */

interface ApiKey {
  id: string;
  tenantId: string;
  keyHash: string;       // SHA-256 hash of the key (raw key never stored)
  prefix: string;        // First 8 chars for identification (e.g., "ak_live_a1b2c3d4")
  name: string;          // Human-readable label
  permissions: string[];
  rateLimitTier: 'standard' | 'elevated' | 'unlimited';
  status: 'active' | 'revoked';
  lastUsedAt?: Date;
  createdAt: Date;
  revokedAt?: Date;
  createdBy: string;     // userId who created the key
}

interface ApiKeyRateLimits {
  standard: { requests: 1000; windowSeconds: 3600 };
  elevated: { requests: 10000; windowSeconds: 3600 };
  unlimited: { requests: -1; windowSeconds: 0 };
}

const API_KEY_PREFIX_LIVE = 'ak_live_';
const API_KEY_PREFIX_TEST = 'ak_test_';

/**
 * Authenticate a request using an API key.
 * Keys are passed via `X-API-Key` header (not Authorization — that's for JWT).
 *
 * @returns The API key record if valid
 * @throws AuthError if key is missing, invalid, or revoked
 */
export function requireApiKey(req: Request): ApiKey {
  const keyHeader = req.headers.get('X-API-Key');
  if (!keyHeader) {
    throw new AuthError('Missing X-API-Key header');
  }

  if (!keyHeader.startsWith(API_KEY_PREFIX_LIVE) && !keyHeader.startsWith(API_KEY_PREFIX_TEST)) {
    throw new AuthError('Invalid API key format — expected ak_live_* or ak_test_*');
  }

  const keyRecord = lookupApiKey(keyHeader);
  if (!keyRecord) {
    throw new AuthError('API key not found');
  }

  if (keyRecord.status === 'revoked') {
    throw new AuthError('API key has been revoked');
  }

  // Update last-used timestamp
  keyRecord.lastUsedAt = new Date();

  logAuditEvent({
    action: 'api_key.authenticate',
    tenantId: keyRecord.tenantId,
    apiKeyId: keyRecord.id,
    apiKeyPrefix: keyRecord.prefix,
    ip: req.headers.get('X-Forwarded-For') || 'unknown',
  });

  return keyRecord;
}

/**
 * Check if an API key has a specific permission.
 * API keys cannot have admin-level permissions.
 */
export function requireApiKeyPermission(key: ApiKey, permission: string): void {
  const FORBIDDEN_PERMISSIONS = ['admin:access', 'tenant:admin', 'users:delete'];
  if (FORBIDDEN_PERMISSIONS.includes(permission)) {
    throw new ForbiddenError(
      `API keys cannot access admin-level permission: ${permission}`,
      permission,
    );
  }
  if (!key.permissions.includes(permission)) {
    throw new ForbiddenError(
      `API key missing permission: ${permission}`,
      permission,
    );
  }
}

/**
 * Create a new API key. Only admins can create keys.
 */
export async function createApiKey(
  tenantId: string,
  createdBy: string,
  name: string,
  permissions: string[],
  tier: ApiKey['rateLimitTier'] = 'standard',
): Promise<{ key: string; record: ApiKey }> {
  if (!name || name.length > 64) {
    throw new ValidationError('API key name must be 1-64 characters');
  }

  const rawKey = `${API_KEY_PREFIX_LIVE}${generateHex(32)}`;
  const record: ApiKey = {
    id: generateId(),
    tenantId,
    keyHash: sha256(rawKey),
    prefix: rawKey.slice(0, 16),
    name,
    permissions: permissions.filter(p => !['admin:access', 'tenant:admin'].includes(p)),
    rateLimitTier: tier,
    status: 'active',
    createdAt: new Date(),
    createdBy,
  };

  await db.insert('api_keys', record);

  logAuditEvent({
    action: 'api_key.created',
    tenantId,
    userId: createdBy,
    apiKeyId: record.id,
    permissions: record.permissions,
    tier,
  });

  // Return raw key only once — it's never stored
  return { key: rawKey, record };
}

/**
 * Revoke an API key. Immediate effect — all in-flight requests with this key will fail.
 */
export async function revokeApiKey(keyId: string, revokedBy: string): Promise<void> {
  const record = await db.update('api_keys', keyId, {
    status: 'revoked',
    revokedAt: new Date(),
  });

  if (record) {
    logAuditEvent({
      action: 'api_key.revoked',
      tenantId: record.tenantId,
      userId: revokedBy,
      apiKeyId: keyId,
    });
  }
}

// Stubs
function lookupApiKey(rawKey: string): ApiKey | null { return null; }
function generateHex(length: number): string { return ''; }
function generateId(): string { return ''; }
function sha256(input: string): string { return ''; }
const db = { insert: async (...args: any[]) => ({}), update: async (...args: any[]) => ({}) };
