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

The API exposes the following endpoints for user management, search, and system status:

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/api/status` | GET | Public | Health, version, and feature flags (replaces `/api/health`) |
| `/api/users` | GET | `users:read` | List users (cursor-based pagination) |
| `/api/users/:id` | GET | `users:read` | Get user by ID |
| `/api/users` | POST | `users:write` | Create new user (default role: `viewer`) |
| `/api/users/:id` | PATCH | `users:write` | Update user profile |
| `/api/users/:id` | DELETE | `users:delete` | Delete user |
| `/api/search?q=<query>` | GET | `search:access` | Full-text user search |
| `/api/admin/users` | GET | `admin:access` | Admin user list (paginated) |
| `/api/admin/users/:id/role` | PATCH | `admin:access` | Update user role |
| `/api/admin/users/:id/status` | PATCH | `users:write` | Suspend or activate user |

### 1.1 List Users

`GET /api/users` — Returns a paginated list of users using cursor-based pagination. Requires `users:read` permission.

**Implementation:** `src/api/users.ts` → `listUsers()`

Returns `{ data, total, cursor, hasMore }` where `data` is an array of User objects with fields: `id`, `name`, `email`, `role`, `status`.

### 1.2 Get User

`GET /api/users/:id` — Returns a single user by ID. Throws `NotFoundError` if the user doesn't exist.

**Implementation:** `src/api/users.ts` → `getUser()`

### 1.3 Create User

`POST /api/users` — Creates a new user. Requires `users:write` permission. New users are assigned the `viewer` role by default.

**Implementation:** `src/api/users.ts` → `createUser()`

### 1.4 Delete User

`DELETE /api/users/:id` — Deletes a user by ID. Requires `users:delete` permission.

**Implementation:** `src/api/users.ts` → `deleteUser()`

### 1.5 Search Users

`GET /api/search?q=<query>&type=users&limit=20` — Full-text search across users. Requires `search:access` permission. Supports field-specific search (e.g., `name:alice`, `email:@company.com`). Query must be at least 2 characters; limit max 100.

**Implementation:** `src/api/search.ts` → `searchUsers()`

### 1.6 System Status

`GET /api/status` — Combined health check, version, and feature flags endpoint. Public (no authentication required). Replaces the previous `/api/health` endpoint.

**Implementation:** `src/api/status.ts`

### 1.7 Admin Endpoints

| Endpoint | Permission | Description |
|----------|------------|-------------|
| `GET /api/admin/users` | `admin:access` | Paginated admin user list |
| `PATCH /api/admin/users/:id/role` | `admin:access` | Update user role |
| `PATCH /api/admin/users/:id/status` | `users:write` | Suspend or activate user |

**Implementation:** `src/api/admin.ts`

---

## 2. Authentication

All endpoints require authentication via JWT Bearer token in the `Authorization` header (except `GET /api/health`).

### 2.1 JWT Authentication

`src/auth/jwt-auth.ts` → `requireJWT(req, requiredRole?)`

1. Extract JWT from `Authorization: Bearer <token>` header
2. Verify and decode the JWT (access tokens expire after 15 minutes; refresh tokens after 7 days)
3. If `requiredRole` is specified, check the token's role matches

### 2.2 RBAC Permissions

`src/auth/rbac.ts` → `requirePermission(req, permission)`

Role hierarchy: `admin` > `moderator` > `member` > `viewer`. Each role inherits permissions from lower roles. Permissions include `users:read`, `users:write`, `users:delete`, `users:suspend`, `admin:access`.

### 2.2 Error Cases

| Condition | Error |
|-----------|-------|
| Missing token | `AuthError: Missing authentication token` (401) |
| Invalid/expired JWT | `AuthError: Invalid or expired token` (401) |
| Revoked token | `AuthError: Token has been revoked` (401) |
| Insufficient permission | `ForbiddenError: Required permission: X` (403) |

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
