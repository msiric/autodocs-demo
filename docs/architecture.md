# API Architecture Guide

> **Last verified:** March 2026

This document covers the complete implementation of our REST API, from authentication through error handling.

---

## Table of Contents

1. [API Endpoints](#1-api-endpoints)
2. [Authentication](#2-authentication)
3. [Error Handling](#3-error-handling)
4. [File Index](#4-file-index)

---

## 1. API Endpoints

The API exposes three endpoints for user management:

| Endpoint | Method | Auth Required | Description |
|----------|--------|--------------|-------------|
| `/api/users` | GET | Yes | List all users |
| `/api/users/:id` | GET | Yes | Get user by ID |
| `/api/users` | POST | Admin only | Create new user |

### 1.4 Health Check

`GET /api/health` — Returns service health status. No authentication required. Returns `200` if healthy, `503` if any critical dependency is down.

**Implementation:** `src/api/health.ts` → `healthCheck()`

Checks database connectivity (via `SELECT 1` query) and circuit breaker states for external services (`database`, `cache`, `webhook`). Returns a `HealthStatus` object with `status` (`healthy` | `degraded` | `unhealthy`), `timestamp`, `version`, `uptime`, and detailed dependency `checks`. Status is `unhealthy` if the database is down, `degraded` if any circuit breaker is open.

### 1.1 List Users

`GET /api/users` — Returns paginated users with optional search, filtering, and sorting. Supports dual authentication (JWT Bearer token or API key via `X-API-Key` header). Per-endpoint rate limiting is enforced (100 requests/minute by tenant). Responses are cached in-memory for 60 seconds per tenant/cursor/limit combination; a `CacheError` (503) is thrown if caching fails.

**Implementation:** `src/api/users.ts` → `listUsers()`

Accepts optional `UserSearchFilters`: filter by `role` (`admin` | `member` | `viewer`), `status` (`active` | `suspended` | `pending`), or `search` (case-insensitive substring match on name/email). Results can be sorted by `name`, `email`, `createdAt`, or `lastLoginAt` (default: `id` ascending). Sort fields are validated to prevent SQL injection.

Returns a `CursorPaginatedResponse<User>` with fields: `data` (array of User objects), `total`, `cursor`, and `hasMore`.

### 1.2 Get User

`GET /api/users/:id` — Returns a single user by ID. Throws `NotFoundError` if the user doesn't exist.

**Implementation:** `src/api/users.ts` → `getUser()`

### 1.3 Create User

`POST /api/users` — Creates a new user. Requires admin role. New users are assigned the `viewer` role by default. User creation is tenant-scoped and enforces the tenant's `maxUsers` limit.

**Implementation:** `src/api/users.ts` → `createUser()`

---

## 2. Authentication

All endpoints require authentication (except `GET /api/health`). Two authentication methods are supported:
- **JWT Bearer token** — via the `Authorization: Bearer <token>` header (for user sessions)
- **API key** — via the `X-API-Key` header (for service-to-service calls)

Endpoints that support both methods (e.g., `GET /api/users`) use `detectAuthMethod()` to choose. API keys are tenant-scoped, do not expire (must be manually revoked), and cannot access admin endpoints. All authentication events are written to the audit log (`src/auth/audit.ts`).

### 2.1 JWT Authentication

`src/auth/jwt-auth.ts` → `requireJWT(req, requiredRole?)`

1. Extract JWT from `Authorization: Bearer <token>` header
2. Verify and decode the JWT (access tokens expire after 30 minutes; refresh tokens after 7 days). The JWT payload includes `userId`, `tenantId`, `role`, `permissions`, and `apiVersion` (`'v1'` | `'v2'`).
3. If `requiredRole` is specified, check the token's role matches

### 2.2 RBAC Permissions

`src/auth/permissions.ts` → `requirePermission(req, permission)`

Role hierarchy: `admin` > `member` > `viewer`. Each role inherits permissions from lower roles. Permissions: `users:read`, `users:write`, `users:delete`, `users:suspend`, `admin:access`, `audit:read`, `search:access`, `webhooks:manage`, `tenant:admin`, `tenant:read`.

API keys have a separate permission model (`src/auth/api-keys.ts` → `requireApiKeyPermission()`). API keys cannot hold admin-level permissions (`admin:access`, `tenant:admin`, `users:delete`).

### 2.2 Error Cases

| Condition | Error |
|-----------|-------|
| Missing token | `AuthError: Missing authentication token` |
| Invalid/expired token | `AuthError: Invalid or expired token` |
| Wrong role | `AuthError: Required role: X, got: Y` |

---

## 3. Error Handling

All errors are handled centrally by `categorizeError()` in `src/errors/handler.ts`.

### 3.1 Error Classification

| Error Type | Code | Status | Description |
|-----------|------|--------|-------------|
| `NotFoundError` | `NOT_FOUND` | 404 | Resource not found |
| `AuthError` | `UNAUTHORIZED` | 401 | Authentication failed |
| `ForbiddenError` | `FORBIDDEN` | 403 | Insufficient permissions |
| `ValidationError` | `VALIDATION` | 400 | Input validation failed (includes field-level violations) |
| `RateLimitError` | `RATE_LIMITED` | 429 | Rate limit exceeded (includes `retryAfter` metadata) |
| `ConflictError` | `CONFLICT` | 409 | Resource conflict |
| `TenantError` | `TENANT_ERROR` | 403 | Tenant limit exceeded or tenant not found (includes `tenantId` and `limit` metadata) |
| `CacheError` | `CACHE_ERROR` | 503 | Cache operation failed (includes `cacheKey` and `operation` metadata) |
| `ApiKeyError` | `API_KEY_ERROR` | 403 | API key error (includes `keyPrefix` and `reason` metadata: `expired`, `revoked`, `rate_limited`, `scope_exceeded`) |
| `CircuitOpenError` | `CIRCUIT_OPEN` | 503 | Circuit breaker is open for an external service (includes `serviceName` and `retryAfterMs` metadata) |
| Unknown | `INTERNAL` | 500 | Unexpected server error |

### 3.2 ApiErrorEnvelope Structure

All errors are returned as `ApiErrorEnvelope` with:
- `code` — machine-readable error code
- `message` — human-readable description
- `source` — the function that threw the error
- `traceId` — unique request trace ID for debugging
- `timestamp` — ISO 8601 timestamp of when the error occurred
- `statusCode` — HTTP status code
- `metadata` — structured error context (e.g., `retryAfterSeconds` for rate limits, `violations` array for validation errors, `requiredPermission` for forbidden errors, `keyPrefix`/`reason` for API key errors, `serviceName`/`retryAfterMs` for circuit breaker errors)

---

## 4. File Index

| File | Purpose |
|------|---------|
| `src/api/users.ts` | User CRUD endpoints (`listUsers`, `getUser`, `createUser`, `updateUser`, `deleteUser`) |
| `src/api/health.ts` | Health check endpoint (`healthCheck`) |
| `src/api/rate-limiter.ts` | Per-endpoint sliding window rate limiter (`enforceRateLimit`, `getRateLimitStatus`) |
| `src/errors/handler.ts` | Central error handler + error classes (`categorizeError`, `ApiErrorEnvelope`) |
| `src/errors/circuit-breaker.ts` | Circuit breaker for external services (`withCircuitBreaker`, `CircuitOpenError`) |
| `src/auth/jwt-auth.ts` | JWT authentication (`requireJWT`, `detectAuthMethod`) |
| `src/auth/permissions.ts` | RBAC permission checks (`requirePermission`, `requireAllPermissions`) |
| `src/auth/api-keys.ts` | API key authentication (`requireApiKey`, `requireApiKeyPermission`, `createApiKey`) |
| `src/auth/audit.ts` | Audit logging for security events (`logAuditEvent`, `queryAuditLog`) |
| `src/webhooks/dispatcher.ts` | Webhook event dispatcher (`registerWebhook`, `dispatchEvent`) |
