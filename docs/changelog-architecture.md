# architecture.md — Changelog

## Error Handling

### 2026-03-22 — PR #7 by msiric
**Changed:** Added `CircuitOpenError` handling to `categorizeError()` in `src/errors/handler.ts`. It maps to code `CIRCUIT_OPEN`, HTTP 503, with metadata fields `serviceName` and `retryAfterMs`. The `CircuitOpenError` class is defined in `src/errors/circuit-breaker.ts` and thrown when a circuit breaker is in OPEN state.
**Why:** The circuit breaker pattern was added for external service calls to prevent cascading failures. A dedicated error type was needed so clients receive a structured 503 response with retry timing information.





### 2026-03-09 — PR #14 by msiric
**Changed:** Added `CacheError` class to `src/errors/handler.ts`, mapping to code `CACHE_ERROR` with HTTP 503. Metadata includes `cacheKey` and `operation` (`'get'` | `'set'` | `'invalidate'`).
**Why:** Response caching was added to user listings; `CacheError` provides structured error reporting when cache operations fail (e.g., when setting a cache entry in `listUsers()`).


### 2026-03-07 — PR #9 by msiric
**Changed:** Added `TenantError` class mapping to code `TENANT_ERROR` (HTTP 403) with `tenantId` and `limit` metadata.
**Why:** Tenant user-limit enforcement needed a dedicated error type to distinguish tenant capacity issues from generic forbidden errors.


### 2026-03-05 — PR #5 by Mario Siric
**Changed:** `classifyError()` renamed to `categorizeError()`. Return type changed from `AppError` to `ApiErrorEnvelope` (the `AppError` class was removed). `RateLimitError` (429) re-added with `retryAfter` metadata. `ValidationError` now includes a field-level `violations` array instead of a single message.
**Why:** API v2 overhaul introduced structured error envelopes (`ApiErrorEnvelope`) for consistent client-side error handling. Rate limiting was re-added at the application layer (via `src/middleware/rate-limiter.ts`). Validation errors were enhanced with per-field violation details.


### 2026-03-05 — PR #3 by Mario Siric
**Changed:** `handleError()` renamed to `classifyError()` (confirming PR #1 rename). Added `ForbiddenError` (403, `FORBIDDEN`) and `ConflictError` (409, `CONFLICT`) to the error classification. Removed `RateLimitError` (rate limiting moved to infrastructure). `AppError.metadata` field now used for structured error context (`requiredPermission`, `conflictField`).
**Why:** Auth was migrated to JWT with RBAC. Role/permission violations now throw `ForbiddenError` instead of `AuthError`. Rate limiting was moved to infrastructure, so `RateLimitError` is no longer needed. `ConflictError` was added for resource conflict scenarios.


### 2026-03-04 — PR #1 by Mario Siric
**Changed:** `handleError()` renamed to `classifyError()`. Two new error types added: `RateLimitError` (429, `RATE_LIMITED`) and `ValidationError` (400, `VALIDATION`). `AppError` now includes an optional `metadata` field.
**Why:** The error handling system was reclassified for clarity. Rate limiting and input validation were added as new features, requiring new error types to represent these failure modes.




---

## API Endpoints



### 2026-03-09 — PR #14 by msiric
**Changed:** Added V2 user listing endpoint (`GET /api/v2/users`) with `listUsersV2()` in `src/api/v2/users.ts`. Added response caching (60s TTL) to `listUsers()` with `CacheError` on cache failure. Response format is `CursorPaginatedResponse<User>` with cursor pagination fields.
**Why:** PR adds API versioning with a V2 endpoint that includes enhanced metadata (`_meta` with `apiVersion`, `requestId`, `cached`, `deprecations`) and field selection, plus response caching for user listings to reduce database load.


### 2026-03-07 — PR #9 by msiric
**Changed:** Added two tenant admin endpoints (`GET /api/admin/tenants`, `GET /api/admin/tenants/:id`). User listing is now tenant-scoped. Default role for new users changed from `member` to `viewer`. `search.ts` renamed to `queries.ts`. `status.ts` deleted.
**Why:** Multi-tenant architecture with full data isolation. All user queries are now scoped by tenant. Tenant system includes resolution, registration, and feature flags. Default role changed to `viewer` for least-privilege defaults.


### 2026-03-05 — PR #5 by Mario Siric
**Changed:** Added `GET /api/health` (health check, no auth), `DELETE /api/users/:id` (user deletion, `users:delete` permission), and `PATCH /api/admin/users/:id/status` (suspend/activate users, `users:write` permission). Removed `GET /api/admin/audit` endpoint. `adminListUsers` now accepts pagination parameters and returns `PaginatedAdminView`. `getAuditEntries` replaced by `updateUserStatus`. User objects now include `status` field.
**Why:** API v2 overhaul expanded the endpoint surface for user lifecycle management (deletion, status changes) and added a health check endpoint. The dedicated audit log endpoint was removed as the audit subsystem was replaced with inline logging.


### 2026-03-05 — PR #3 by Mario Siric
**Changed:** Four new endpoints added: `PATCH /api/users/:id` (update user profile), `GET /api/admin/users` (admin user list), `PATCH /api/admin/users/:id/role` (update user role), `GET /api/admin/audit` (audit log retrieval). Auth requirements changed from "Yes/Admin only" to permission-based RBAC (e.g. `users:read`, `users:write`, `admin:access`). Default role for new users changed from `member` to `viewer`. `listUsers` now returns paginated responses.
**Why:** JWT auth with RBAC replaced the token-store system. Admin dashboard endpoints were added for user management and audit log access. Rate limiting was moved to infrastructure.


### 2026-03-04 — PR #1 by Mario Siric
**Changed:** Rate limiting documented for all three endpoints (GET /api/users: 100/min, GET /api/users/:id: 200/min, POST /api/users: 10/min). Input validation added: user ID format check on getUser, email required on createUser.
**Why:** Rate limiting was missing entirely from the API. Input validation did not exist for user IDs or required fields. Both were added to harden the API against abuse and malformed requests.




---

## Authentication



### 2026-03-09 — PR #14 by msiric
**Changed:** Added `apiVersion` field (`'v1'` | `'v2'`) to `JWTPayload` interface in `src/auth/jwt-auth.ts`.
**Why:** V2 endpoints require a JWT with `apiVersion: 'v2'` to enforce version-specific access control. This allows the API to gate V2 features behind token versioning.


### 2026-03-07 — PR #9 by msiric
**Changed:** Access token expiry changed from 15 minutes to 30 minutes. JWT payload now includes `tenantId`. `issueTokenPair` accepts new `tenantId` parameter. `moderator` role removed from role hierarchy. New permissions added: `tenant:admin`, `tenant:read`.
**Why:** JWT payload extended to carry tenant context for tenant-scoped authorization. Moderator role removed as part of simplified RBAC model. Token expiry extended to reduce refresh frequency.


### 2026-03-05 — PR #5 by Mario Siric
**Changed:** `src/auth/permissions.ts` renamed to `src/auth/rbac.ts`. Added `moderator` role to the role hierarchy (admin > moderator > member > viewer) with `users:suspend` permission. Added `users:delete` permission. Rate limiting re-added at application layer via `src/middleware/rate-limiter.ts` (previously removed in PR #3).
**Why:** API v2 overhaul introduced the moderator role for user suspension workflows. The permissions file was renamed to `rbac.ts` to better reflect its purpose. Rate limiting was brought back to the application layer for per-endpoint control.


### 2026-03-05 — PR #3 by Mario Siric
**Changed:** Token-store auth (`requireAuth` in `src/auth/middleware.ts`) replaced with JWT auth (`requireJWT` in `src/auth/jwt-auth.ts`). Access tokens expire after 15 minutes with refresh token support. RBAC permissions system added via `src/auth/permissions.ts` with role hierarchy (admin > member > viewer). Role/permission violations now throw `ForbiddenError` (403) instead of `AuthError` (401). Rate limiter (`src/auth/rate-limiter.ts`) removed — moved to infrastructure.
**Why:** Replaced token-store auth with JWT auth for better security and scalability. Added RBAC permissions system with role hierarchy to support granular access control for admin dashboard and audit features. Rate limiting moved to infrastructure layer.


### 2026-03-04 — PR #1 by Mario Siric
**Changed:** New rate limiting subsystem added via `src/auth/rate-limiter.ts` with `checkRateLimit()` function. Per-IP tracking with configurable per-endpoint limits.
**Why:** No rate limiting existed previously. Added per-endpoint rate limits to protect against abuse, with `RateLimitError` thrown when limits are exceeded.




---

## File Index

### 2026-03-10 — PR #1 by Mario Širić
**Changed:** `src/auth/rbac.ts` renamed to `src/auth/permissions.ts`. `src/auth/middleware.ts` reference is stale (replaced by `src/auth/jwt-auth.ts`). New files added: `src/auth/api-keys.ts`, `src/auth/audit.ts`. Missing entries: `src/auth/jwt-auth.ts`, `src/webhooks/dispatcher.ts`. `users.ts` now contains 5 endpoints (`listUsers`, `getUser`, `createUser`, `updateUser`, `deleteUser`). Error classes list should include `ApiKeyError`.
**Why:** PR #1 added new authentication modules and renamed the RBAC file. The file index had not been updated to reflect the current source tree.





### 2026-03-07 — PR #9 by msiric
**Changed:** `src/api/search.ts` renamed to `src/api/queries.ts`. `src/api/status.ts` deleted. `src/config/tenants.ts` added. File index updated to reflect current source files including `admin.ts`, `jwt-auth.ts`, and `rbac.ts`.
**Why:** File reorganization as part of multi-tenant architecture. Search functionality moved to `queries.ts`. Status endpoint removed. Tenant configuration module added.




---

## UNMAPPED

### 2026-03-22 — PR #1 by msiric
**Changed:** Identified three undocumented feature areas from PR #1 that need new doc sections: (1) API Key Authentication — `src/auth/api-keys.ts` provides `requireApiKey()`, `createApiKey()`, `revokeApiKey()` with tenant-scoped keys in `ak_live_*`/`ak_test_*` format and three rate limit tiers; (2) Audit Logging — `src/auth/audit.ts` provides `logAuditEvent()` and `queryAuditLog()` with buffered writes and dual output (database + stdout); (3) Webhook Events — `src/webhooks/dispatcher.ts` supports 7 event types with HMAC-signed payloads and retry logic, but no doc section exists. Dual-auth detection via `detectAuthMethod()` also undocumented as a concept.
**Why:** PR #1 introduced API key auth, audit logging, and new webhook events, but the doc structure (sections 1–4) had no home for these features. The config maps `webhooks` → "Webhook Events" and `auth` → "Authentication", but the Authentication section only covered JWT/RBAC and no Webhook Events section existed. These are new sections/subsections that need to be added to the doc.





### 2026-03-07 — PR #9 by msiric
**Changed:** New tenant isolation system introduced (`src/config/tenants.ts`, `resolveTenant`, tenant-scoped queries, `maxUsers` limits, feature flags). No existing doc section covers multi-tenancy.
**Why:** Multi-tenant architecture is a new cross-cutting concern. Consider creating a dedicated "Multi-Tenancy" section in the architecture doc.




---

## Audit Logging



### 2026-03-05 — PR #5 by Mario Siric
**Changed:** Deleted `src/audit/logger.ts`. Removed `getAuditEntries` admin endpoint. Audit events now emitted via inline `console.log` with JSON-structured output (event, actor, outcome, IP, timestamp) instead of a dedicated logging subsystem.
**Why:** The dedicated audit subsystem was replaced with inline structured logging as part of the API v2 overhaul. The audit log retrieval endpoint was removed.


### 2026-03-05 — PR #3 by Mario Siric
**Changed:** New audit logging subsystem added via `src/audit/logger.ts`. Functions: `logAuditEvent()` records admin actions with userId, action, target, details, outcome, and IP. `getAuditLog()` retrieves entries with optional filters. New admin endpoint `GET /api/admin/audit` exposes the audit log. New files: `src/api/admin.ts`, `src/audit/logger.ts`, `src/auth/permissions.ts`, `src/auth/jwt-auth.ts`.
**Why:** Audit logging was added for compliance. All admin actions are logged with full context (who, what, when, outcome, IP) to provide an audit trail.


---

## Webhook Events

### 2026-03-10 — PR #1 by Mario Širić
**Changed:** Added three new webhook event types in `src/webhooks/dispatcher.ts`: `api_key.created`, `api_key.revoked`, `auth.failed`. The full event list is now: `user.created`, `user.updated`, `user.deleted`, `user.role_changed`, `api_key.created`, `api_key.revoked`, `auth.failed`. No "Webhook Events" section exists in the doc yet.
**Why:** API key lifecycle events and authentication failures need to be observable by external systems for security monitoring and automation.



---
