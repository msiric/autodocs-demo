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

The API exposes user management and admin endpoints:

| Endpoint | Method | Auth Required | Description |
|----------|--------|--------------|-------------|
| `/api/users` | GET | `users:read` | List all users (paginated) |
| `/api/users/:id` | GET | `users:read` | Get user by ID |
| `/api/users` | POST | `admin` + `users:write` | Create new user |
| `/api/users/:id` | PATCH | Owner or `users:write` | Update user profile |
| `/api/admin/users` | GET | `admin` + `admin:access` | List all users with role details |
| `/api/admin/users/:id/role` | PATCH | `admin` + `users:write` | Update a user's role |
| `/api/admin/audit` | GET | `admin` + `audit:read` | Retrieve audit log entries |

### 1.1 List Users

`GET /api/users` — Returns all users. Requires a valid authentication token.

**Implementation:** `src/api/users.ts` → `listUsers()`

Returns an array of User objects with fields: `id`, `name`, `email`, `role`.

### 1.2 Get User

`GET /api/users/:id` — Returns a single user by ID. Throws `NotFoundError` if the user doesn't exist.

**Implementation:** `src/api/users.ts` → `getUser()`

### 1.3 Create User

`POST /api/users` — Creates a new user. Requires admin role and `users:write` permission. New users are assigned the `viewer` role by default.

**Implementation:** `src/api/users.ts` → `createUser()`

---

## 2. Authentication

All endpoints require authentication via JWT Bearer token in the `Authorization` header. Access tokens expire after 15 minutes; use the refresh token endpoint to obtain a new pair.

### 2.1 JWT Authentication

`src/auth/jwt-auth.ts` → `requireJWT(req, requiredRole?, requiredPermission?)`

1. Extract token from `Authorization: Bearer <token>` header
2. Verify the JWT access token (RS256)
3. Check token expiry
4. If `requiredRole` is specified, check against role hierarchy (admin > member > viewer)
5. If `requiredPermission` is specified, check the user's permissions

### 2.2 RBAC Permissions

`src/auth/permissions.ts` → `requirePermission(req, permission)`

Roles grant a fixed set of permissions:

| Role | Permissions |
|------|-------------|
| `admin` | `users:read`, `users:write`, `users:delete`, `admin:access`, `audit:read` |
| `member` | `users:read`, `users:write` |
| `viewer` | `users:read` |

### 2.3 Error Cases

| Condition | Error |
|-----------|-------|
| Missing/malformed header | `AuthError: Missing or malformed Authorization header` |
| Invalid/expired JWT | `AuthError: Invalid or expired JWT token` |
| Token expired | `AuthError: Token expired — use refresh token to obtain a new access token` |
| Insufficient role | `ForbiddenError: Insufficient role: requires X, got Y` |
| Missing permission | `ForbiddenError: Permission denied: X not granted to role Y` |

---

## 3. Error Handling

All errors are handled centrally by `classifyError()` in `src/errors/handler.ts`.

### 3.1 Error Classification

| Error Type | Code | Status | Description |
|-----------|------|--------|-------------|
| `NotFoundError` | `NOT_FOUND` | 404 | Resource not found |
| `AuthError` | `UNAUTHORIZED` | 401 | Authentication failed |
| `ForbiddenError` | `FORBIDDEN` | 403 | Insufficient role or missing permission |
| `ConflictError` | `CONFLICT` | 409 | Resource conflict (e.g. duplicate field) |
| `ValidationError` | `VALIDATION` | 400 | Input validation failed |
| Unknown | `INTERNAL` | 500 | Unexpected server error |

### 3.2 AppError Structure

All errors are wrapped in `AppError` with:
- `code` — machine-readable error code
- `message` — human-readable description
- `source` — the function that threw the error
- `statusCode` — HTTP status code
- `metadata` — optional record with error-specific context (e.g. `requiredPermission`, `conflictField`)

---

## 4. File Index

| File | Purpose |
|------|---------|
| `src/api/users.ts` | User CRUD endpoints (listUsers, getUser, createUser) |
| `src/errors/handler.ts` | Central error handler + error classes (AppError, NotFoundError, AuthError) |
| `src/auth/middleware.ts` | Authentication middleware (requireAuth, validateToken) |
| `src/auth/jwt-auth.ts` | JWT authentication (requireJWT, issueTokenPair, refreshAccessToken) |
| `src/auth/permissions.ts` | RBAC permission checks (requirePermission, ROLE_PERMISSIONS) |
| `src/api/admin.ts` | Admin endpoints (adminListUsers, updateUserRole, getAuditEntries) |
| `src/audit/logger.ts` | Audit trail logging (logAuditEvent, getAuditLog) |

---

## 5. Audit Logging

Admin actions are logged to an audit trail for compliance. The audit system records who performed an action, what they did, the outcome, and the caller's IP address.

### 5.1 Logging Events

`src/audit/logger.ts` → `logAuditEvent(userId, action, target, details, outcome, ip)`

All admin endpoint handlers call `logAuditEvent()` on both success and failure.

### 5.2 Retrieving the Audit Log

`src/audit/logger.ts` → `getAuditLog(filters?)`

Supports filtering by `userId`, `action`, `since` (date), and `limit`. Results are returned in reverse chronological order.
