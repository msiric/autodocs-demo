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

`GET /api/users` — Returns all users. Requires a valid authentication token. Rate limited: 100 requests/minute.

**Implementation:** `src/api/users.ts` → `listUsers()`

Returns an array of User objects with fields: `id`, `name`, `email`, `role`.

### 1.2 Get User

`GET /api/users/:id` — Returns a single user by ID. Validates that the ID is non-empty and at most 36 characters (throws `ValidationError` otherwise). Throws `NotFoundError` if the user doesn't exist. Rate limited: 200 requests/minute.

**Implementation:** `src/api/users.ts` → `getUser()`

### 1.3 Create User

`POST /api/users` — Creates a new user. Requires admin role. Validates that `email` is provided (throws `ValidationError` otherwise). New users are assigned the `member` role by default. Rate limited: 10 requests/minute.

**Implementation:** `src/api/users.ts` → `createUser()`

---

## 2. Authentication

All endpoints require authentication via Bearer token in the `Authorization` header.

### 2.1 Token Validation

`src/auth/middleware.ts` → `requireAuth(req, requiredRole?)`

1. Extract token from `Authorization: Bearer <token>` header
2. Validate token against the token store
3. If `requiredRole` is specified, check the session's role matches

### 2.2 Error Cases

| Condition | Error |
|-----------|-------|
| Missing token | `AuthError: Missing authentication token` |
| Invalid/expired token | `AuthError: Invalid or expired token` |
| Wrong role | `AuthError: Required role: X, got: Y` |

### 2.3 Rate Limiting

`src/auth/rate-limiter.ts` → `checkRateLimit(req, options)`

Per-IP rate limiting applied at the endpoint level. Each endpoint specifies its own limit and time window. When exceeded, throws `RateLimitError` with a `retryAfter` value.

| Endpoint | Limit | Window |
|----------|-------|--------|
| `GET /api/users` | 100 requests | 1 minute |
| `GET /api/users/:id` | 200 requests | 1 minute |
| `POST /api/users` | 10 requests | 1 minute |

---

## 3. Error Handling

All errors are handled centrally by `classifyError()` in `src/errors/handler.ts`.

### 3.1 Error Classification

| Error Type | Code | Status | Description |
|-----------|------|--------|-------------|
| `NotFoundError` | `NOT_FOUND` | 404 | Resource not found |
| `AuthError` | `UNAUTHORIZED` | 401 | Authentication failed |
| Unknown | `INTERNAL` | 500 | Unexpected server error |
| `RateLimitError` | `RATE_LIMITED` | 429 | Rate limit exceeded |
| `ValidationError` | `VALIDATION` | 400 | Input validation failed |

### 3.2 AppError Structure

All errors are wrapped in `AppError` with:
- `code` — machine-readable error code
- `message` — human-readable description
- `source` — the function that threw the error
- `statusCode` — HTTP status code
- `metadata` — optional additional context (e.g., `retryAfter` for rate limit errors)

---

## 4. File Index

| File | Purpose |
|------|---------|
| `src/api/users.ts` | User CRUD endpoints (listUsers, getUser, createUser) |
| `src/errors/handler.ts` | Central error handler + error classes (AppError, NotFoundError, AuthError) |
| `src/auth/middleware.ts` | Authentication middleware (requireAuth, validateToken) |
