# architecture.md — Changelog

## Error Handling

### 2026-03-04 — PR #1 by Mario Širić
**Changed:** `handleError()` renamed to `classifyError()`. Two new error types added: `RateLimitError` (429, `RATE_LIMITED`) and `ValidationError` (400, `VALIDATION`). `AppError` now includes an optional `metadata` field.
**Why:** The error handling system was reclassified for clarity. Rate limiting and input validation were added as new features, requiring new error types to represent these failure modes.

---

## API Endpoints

### 2026-03-04 — PR #1 by Mario Širić
**Changed:** Rate limiting documented for all three endpoints (GET /api/users: 100/min, GET /api/users/:id: 200/min, POST /api/users: 10/min). Input validation added: user ID format check on getUser, email required on createUser.
**Why:** Rate limiting was missing entirely from the API. Input validation did not exist for user IDs or required fields. Both were added to harden the API against abuse and malformed requests.

---

## Authentication

### 2026-03-04 — PR #1 by Mario Širić
**Changed:** New rate limiting subsystem added via `src/auth/rate-limiter.ts` with `checkRateLimit()` function. Per-IP tracking with configurable per-endpoint limits.
**Why:** No rate limiting existed previously. Added per-endpoint rate limits to protect against abuse, with `RateLimitError` thrown when limits are exceeded.

---
