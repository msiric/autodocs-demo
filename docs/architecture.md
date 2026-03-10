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

`GET /api/users` — Returns paginated users. Requires a valid authentication token. Responses are cached in-memory for 60 seconds per tenant/cursor/limit combination; a `CacheError` (503) is thrown if caching fails.

**Implementation:** `src/api/users.ts` → `listUsers()`

Returns a `CursorPaginatedResponse<User>` with fields: `data` (array of User objects), `total`, `cursor`, and `hasMore`.

### 1.2 Get User

`GET /api/users/:id` — Returns a single user by ID. Throws `NotFoundError` if the user doesn't exist.

**Implementation:** `src/api/users.ts` → `getUser()`

### 1.3 Create User

`POST /api/users` — Creates a new user. Requires admin role. New users are assigned the `viewer` role by default. User creation is tenant-scoped and enforces the tenant's `maxUsers` limit.

**Implementation:** `src/api/users.ts` → `createUser()`

---

## 2. Authentication

All endpoints require authentication via JWT Bearer token in the `Authorization` header (except `GET /api/health`).

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
| Unknown | `INTERNAL` | 500 | Unexpected server error |

### 3.2 ApiErrorEnvelope Structure

All errors are returned as `ApiErrorEnvelope` with:
- `code` — machine-readable error code
- `message` — human-readable description
- `source` — the function that threw the error
- `statusCode` — HTTP status code
- `metadata` — structured error context (e.g., `retryAfter` for rate limits, `violations` array for validation errors, `requiredPermission` for forbidden errors)

---

## 4. File Index

| File | Purpose |
|------|---------|
| `src/api/users.ts` | User CRUD endpoints (listUsers, getUser, createUser) |
| `src/errors/handler.ts` | Central error handler + error classes (AppError, NotFoundError, AuthError) |
| `src/auth/middleware.ts` | Authentication middleware (requireAuth, validateToken) |
