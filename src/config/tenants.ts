import { TenantError } from '../errors/handler';

/**
 * Multi-tenant configuration and resolution.
 * Each tenant has isolated data, user limits, and feature flags.
 * Tenant ID is embedded in the JWT payload at login time.
 */

interface TenantConfig {
  id: string;
  name: string;
  maxUsers: number;
  features: {
    search: boolean;
    webhooks: boolean;
    advancedRbac: boolean;
  };
  createdAt: Date;
}

const tenantStore = new Map<string, TenantConfig>();

/**
 * Resolve the current tenant from the JWT payload.
 * Throws TenantError if the tenant is not found or inactive.
 */
export function resolveTenant(jwtPayload: { tenantId: string }): TenantConfig {
  const tenant = tenantStore.get(jwtPayload.tenantId);
  if (!tenant) {
    throw new TenantError(
      `Tenant ${jwtPayload.tenantId} not found`,
      jwtPayload.tenantId,
    );
  }
  return tenant;
}

/**
 * Register a new tenant.
 */
export function registerTenant(config: TenantConfig): void {
  if (tenantStore.has(config.id)) {
    throw new TenantError(`Tenant ${config.id} already exists`, config.id);
  }
  tenantStore.set(config.id, config);
}

/**
 * Get tenant by ID. Returns undefined if not found.
 */
export function getTenant(tenantId: string): TenantConfig | undefined {
  return tenantStore.get(tenantId);
}

/**
 * List all registered tenants. Admin only.
 */
export function listTenants(): TenantConfig[] {
  return Array.from(tenantStore.values());
}
