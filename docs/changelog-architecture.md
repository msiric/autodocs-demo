# architecture.md — Changelog

## API Endpoints

### 2026-03-22 — PR #3 by msiric
**Changed:** Added per-endpoint rate limiting via `enforceRateLimit()` from new file `src/api/rate-limiter.ts`. `listUsers()` rate limited to 100 req/60s per tenant. `createUser()` rate limited to 10 req/60s per tenant. `updateUser()` limited to 30 req/60s per user. `deleteUser()` limited to 5 req/60s per user. Rate limit status exposed via `getRateLimitStatus()` for `X-RateLimit-*` response headers. Exceeded limits are audit-logged and throw `RateLimitError`.
**Why:** Per-endpoint rate limiting with sliding window counters was added to protect the API from abuse, with different thresholds per endpoint based on expected usage patterns (reads are more permissive than writes/deletes).




### 2026-03-10 — PR #1 by Mario Širić
**Changed:** `listUsers()` now supports dual authentication (JWT Bearer or API key via `X-API-Key` header) using `detectAuthMethod()`. The endpoint table listed 3 endpoints but the source contains 5 — `updateUser()` (PATCH) and `deleteUser()` (DELETE) were undocumented.
**Why:** API key authentication was added as an alternative to JWT for service-to-service calls. The dual-auth pattern allows both human users (JWT) and automated systems (API keys) to access the user listing endpoint.




---

## Authentication



### 2026-03-10 — PR #1 by Mario Širić
**Changed:** `src/auth/rbac.ts` renamed to `src/auth/permissions.ts`. Added new files: `src/auth/api-keys.ts` (API key authentication with `requireApiKey`, `createApiKey`, `revokeApiKey`), `src/auth/audit.ts` (audit logging with `logAuditEvent`, `queryAuditLog`). Added `detectAuthMethod()` to `src/auth/jwt-auth.ts`. JWT authentication now emits audit events via `logAuditEvent()`. The section intro stating "all endpoints require JWT" is no longer accurate due to dual-auth support.
**Why:** API key authentication was introduced for service-to-service calls that don't have a user context. Audit logging was added for security compliance — all authentication events are now tracked in an append-only audit trail.




---

## Error Handling



### 2026-03-10 — PR #1 by Mario Širić
**Changed:** Added `ApiKeyError` class to `src/errors/handler.ts`. It maps to code `API_KEY_ERROR`, HTTP 403, with metadata fields `keyPrefix` and `reason` (values: `expired`, `revoked`, `rate_limited`, `scope_exceeded`).
**Why:** The new API key authentication system needed a dedicated error type to communicate structured failure reasons (e.g., revoked key vs. exceeded scope) distinct from generic auth errors.




---

## Webhook Events



### 2026-03-10 — PR #1 by Mario Širić
**Changed:** Added three new webhook event types in `src/webhooks/dispatcher.ts`: `api_key.created`, `api_key.revoked`, `auth.failed`. The full event list is now: `user.created`, `user.updated`, `user.deleted`, `user.role_changed`, `api_key.created`, `api_key.revoked`, `auth.failed`. No "Webhook Events" section exists in the doc yet.
**Why:** API key lifecycle events and authentication failures need to be observable by external systems for security monitoring and automation.




---

## File Index



### 2026-03-10 — PR #1 by Mario Širić
**Changed:** `src/auth/rbac.ts` renamed to `src/auth/permissions.ts`. `src/auth/middleware.ts` reference is stale (replaced by `src/auth/jwt-auth.ts`). New files added: `src/auth/api-keys.ts`, `src/auth/audit.ts`. Missing entries: `src/auth/jwt-auth.ts`, `src/webhooks/dispatcher.ts`. `users.ts` now contains 5 endpoints (`listUsers`, `getUser`, `createUser`, `updateUser`, `deleteUser`). Error classes list should include `ApiKeyError`.
**Why:** PR #1 added new authentication modules and renamed the RBAC file. The file index had not been updated to reflect the current source tree.

---
