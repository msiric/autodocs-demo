# architecture.md — Changelog

## Error Handling

### 2026-03-05 — PR #3 by Mario Širić
**Changed:** `handleError()` renamed to `classifyError()` (confirming PR #1 rename). Added `ForbiddenError` (403, `FORBIDDEN`) and `ConflictError` (409, `CONFLICT`) to the error classification. Removed `RateLimitError` (rate limiting moved to infrastructure). `AppError.metadata` field now used for structured error context (`requiredPermission`, `conflictField`).
**Why:** Auth was migrated to JWT with RBAC. Role/permission violations now throw `ForbiddenError` instead of `AuthError`. Rate limiting was moved to infrastructure, so `RateLimitError` is no longer needed. `ConflictError` was added for resource conflict scenarios.

### 2026-03-04 — PR #1 by Mario Širić
**Changed:** `handleError()` renamed to `classifyError()`. Two new error types added: `RateLimitError` (429, `RATE_LIMITED`) and `ValidationError` (400, `VALIDATION`). `AppError` now includes an optional `metadata` field.
**Why:** The error handling system was reclassified for clarity. Rate limiting and input validation were added as new features, requiring new error types to represent these failure modes.

---

## API Endpoints

### 2026-03-05 — PR #3 by Mario Širić
**Changed:** Four new endpoints added: `PATCH /api/users/:id` (update user profile), `GET /api/admin/users` (admin user list), `PATCH /api/admin/users/:id/role` (update user role), `GET /api/admin/audit` (audit log retrieval). Auth requirements changed from "Yes/Admin only" to permission-based RBAC (e.g. `users:read`, `users:write`, `admin:access`). Default role for new users changed from `member` to `viewer`. `listUsers` now returns paginated responses.
**Why:** JWT auth with RBAC replaced the token-store system. Admin dashboard endpoints were added for user management and audit log access. Rate limiting was moved to infrastructure.

### 2026-03-04 — PR #1 by Mario Širić
**Changed:** Rate limiting documented for all three endpoints (GET /api/users: 100/min, GET /api/users/:id: 200/min, POST /api/users: 10/min). Input validation added: user ID format check on getUser, email required on createUser.
**Why:** Rate limiting was missing entirely from the API. Input validation did not exist for user IDs or required fields. Both were added to harden the API against abuse and malformed requests.

---

## Authentication

### 2026-03-05 — PR #3 by Mario Širić
**Changed:** Token-store auth (`requireAuth` in `src/auth/middleware.ts`) replaced with JWT auth (`requireJWT` in `src/auth/jwt-auth.ts`). Access tokens expire after 15 minutes with refresh token support. RBAC permissions system added via `src/auth/permissions.ts` with role hierarchy (admin > member > viewer). Role/permission violations now throw `ForbiddenError` (403) instead of `AuthError` (401). Rate limiter (`src/auth/rate-limiter.ts`) removed — moved to infrastructure.
**Why:** Replaced token-store auth with JWT auth for better security and scalability. Added RBAC permissions system with role hierarchy to support granular access control for admin dashboard and audit features. Rate limiting moved to infrastructure layer.

### 2026-03-04 — PR #1 by Mario Širić
**Changed:** New rate limiting subsystem added via `src/auth/rate-limiter.ts` with `checkRateLimit()` function. Per-IP tracking with configurable per-endpoint limits.
**Why:** No rate limiting existed previously. Added per-endpoint rate limits to protect against abuse, with `RateLimitError` thrown when limits are exceeded.

---

## Audit Logging

### 2026-03-05 — PR #3 by Mario Širić
**Changed:** New audit logging subsystem added via `src/audit/logger.ts`. Functions: `logAuditEvent()` records admin actions with userId, action, target, details, outcome, and IP. `getAuditLog()` retrieves entries with optional filters. New admin endpoint `GET /api/admin/audit` exposes the audit log. New files: `src/api/admin.ts`, `src/audit/logger.ts`, `src/auth/permissions.ts`, `src/auth/jwt-auth.ts`.
**Why:** Audit logging was added for compliance. All admin actions are logged with full context (who, what, when, outcome, IP) to provide an audit trail.

---
