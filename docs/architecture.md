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

### 1.1 List Users

`GET /api/users` — Returns paginated users. Supports dual authentication (JWT Bearer token or API key via `X-API-Key` header). Requires `users:read` permission. Responses are cached in-memory for 60 seconds per tenant/cursor/limit combination; a `CacheError` (503) is thrown if caching fails. Rate-limited to 100 requests per 60 seconds per tenant.

**Implementation:** `src/api/users.ts` → `listUsers()`

Accepts optional `UserSearchFilters`:
- `role` — filter by `'admin'` | `'member'` | `'viewer'` (exact match)
- `status` — filter by `'active'` | `'suspended'` | `'pending'` (exact match)
- `search` — case-insensitive substring match on name or email
- `sortBy` — `'name'` | `'email'` | `'createdAt'` | `'lastLoginAt'` (default: `'id'`)
- `sortOrder` — `'asc'` | `'desc'` (default: `'asc'`)

Sort fields are validated server-side to prevent SQL injection.

Returns a `CursorPaginatedResponse<User>` with fields: `data` (array of User objects), `total`, `cursor`, and `hasMore`.

### 1.2 Get User

`GET /api/users/:id` — Returns a single user by ID. Throws `NotFoundError` if the user doesn't exist.

**Implementation:** `src/api/users.ts` → `getUser()`

### 1.3 Create User

`POST /api/users` — Creates a new user. Requires admin role and `users:write` permission. New users are assigned the `viewer` role by default with status `'pending'`. User creation is tenant-scoped and enforces the tenant's `maxUsers` limit. Rate-limited to 10 requests per 60 seconds per tenant. Dispatches a `user.created` webhook event on success.

**Implementation:** `src/api/users.ts` → `createUser()`

---

## 2. Authentication

Endpoints support two authentication methods: JWT Bearer tokens (for user sessions) and API keys (for service-to-service calls). The `GET /api/health` endpoint requires no authentication. The auth method is auto-detected by `detectAuthMethod()` in `src/auth/jwt-auth.ts` based on which header is present (`Authorization: Bearer` → JWT, `X-API-Key` → API key).

### 2.1 JWT Authentication

`src/auth/jwt-auth.ts` → `requireJWT(req, requiredRole?)`

1. Extract JWT from `Authorization: Bearer <token>` header
2. Verify and decode the JWT (access tokens expire after 30 minutes; refresh tokens after 7 days). The JWT payload includes `userId`, `tenantId`, `role`, `permissions`, and `apiVersion` (`'v1'` | `'v2'`).
3. If `requiredRole` is specified, check the token's role matches

### 2.2 RBAC Permissions

`src/auth/rbac.ts` → `requirePermission(req, permission)`

Role hierarchy: `admin` > `member` > `viewer`. Each role inherits permissions from lower roles. Permissions include `users:read`, `users:write`, `users:delete`, `users:suspend`, `admin:access`, `tenant:admin`, `tenant:read`.

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
| `ApiKeyError` | `API_KEY_ERROR` | 403 | API key error (includes `keyPrefix` and `reason` metadata: `'expired'` \| `'revoked'` \| `'rate_limited'` \| `'scope_exceeded'`) |
| `CircuitOpenError` | `CIRCUIT_OPEN` | 503 | Circuit breaker is open — external service calls blocked (includes `serviceName` and `retryAfterMs` metadata) |
| Unknown | `INTERNAL` | 500 | Unexpected server error |

### 3.2 ApiErrorEnvelope Structure

All errors are returned as `ApiErrorEnvelope` with:
- `code` — machine-readable error code
- `message` — human-readable description
- `source` — the function that threw the error
- `traceId` — unique request trace ID for debugging
- `timestamp` — ISO 8601 timestamp of the error
- `statusCode` — HTTP status code
- `metadata` — structured error context (e.g., `retryAfterSeconds` for rate limits, `violations` array for validation errors, `requiredPermission` for forbidden errors, `serviceName`/`retryAfterMs` for circuit breaker errors, `keyPrefix`/`reason` for API key errors)

---

## 4. File Index

| File | Purpose |
|------|---------|
| `src/api/users.ts` | User CRUD endpoints (`listUsers`, `getUser`, `createUser`, `updateUser`, `deleteUser`) |
| `src/api/health.ts` | Health check endpoint (`healthCheck`) |
| `src/api/rate-limiter.ts` | Per-endpoint sliding window rate limiter (`enforceRateLimit`, `getRateLimitStatus`) |
| `src/auth/jwt-auth.ts` | JWT authentication, token issuance, and auth method detection (`requireJWT`, `detectAuthMethod`) |
| `src/auth/api-keys.ts` | API key authentication and lifecycle (`requireApiKey`, `createApiKey`, `revokeApiKey`) |
| `src/auth/permissions.ts` | RBAC permission checks (`requirePermission`, `requireAllPermissions`) |
| `src/auth/audit.ts` | Audit logging (`logAuditEvent`, `queryAuditLog`) |
| `src/errors/handler.ts` | Central error handler + error classes (`categorizeError`, `ApiErrorEnvelope`) |
| `src/errors/circuit-breaker.ts` | Circuit breaker for external services (`withCircuitBreaker`, `CircuitOpenError`) |
| `src/webhooks/dispatcher.ts` | Webhook event dispatch with retry (`dispatchEvent`, `registerWebhook`) |

---

## 5. Webhook Events

`src/webhooks/dispatcher.ts` → `dispatchEvent(event, data)`

Webhooks are registered via `registerWebhook({ url, events, secret, active })`. When an event fires, all matching active webhooks receive a signed POST request. Delivery is async and non-blocking with 3 retry attempts using exponential backoff (5s, 25s).

**Payload format:** `{ event, timestamp, data, signature }` — signature is HMAC-SHA256 of the payload using the webhook's secret. Delivered via `X-Webhook-Signature` header.

| Event | Trigger |
|-------|---------|
| `user.created` | New user created via `createUser()` |
| `user.updated` | User profile updated |
| `user.deleted` | User soft-deleted via `deleteUser()` |
| `user.role_changed` | User role modified |
| `api_key.created` | New API key created |
| `api_key.revoked` | API key revoked |
| `auth.failed` | Authentication attempt failed |
