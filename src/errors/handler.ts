/**
 * Central error categorizer.
 * Categorizes errors by type and wraps them in a structured API error envelope.
 * All error types map to specific HTTP status codes, machine-readable codes,
 * and include a request trace ID for debugging.
 */
export function categorizeError(error: unknown, source: string, requestId?: string): ApiErrorEnvelope {
  const traceId = requestId ?? generateTraceId();

  if (error instanceof NotFoundError) {
    return createEnvelope('NOT_FOUND', error.message, source, 404, traceId);
  }
  if (error instanceof AuthError) {
    return createEnvelope('UNAUTHORIZED', error.message, source, 401, traceId);
  }
  if (error instanceof ForbiddenError) {
    return createEnvelope('FORBIDDEN', error.message, source, 403, traceId, {
      requiredPermission: error.requiredPermission,
    });
  }
  if (error instanceof ConflictError) {
    return createEnvelope('CONFLICT', error.message, source, 409, traceId, {
      conflictField: error.field,
    });
  }
  if (error instanceof ValidationError) {
    return createEnvelope('VALIDATION', error.message, source, 400, traceId, {
      violations: error.violations,
    });
  }
  if (error instanceof RateLimitError) {
    return createEnvelope('RATE_LIMITED', error.message, source, 429, traceId, {
      retryAfterSeconds: error.retryAfter,
      limit: error.limit,
      windowSeconds: error.windowSeconds,
    });
  }
  if (error instanceof TenantError) {
    return createEnvelope('TENANT_ERROR', error.message, source, 403, traceId, {
      tenantId: error.tenantId,
      limit: error.limit,
    });
  }
  if (error instanceof CacheError) {
    return createEnvelope('CACHE_ERROR', error.message, source, 503, traceId, {
      cacheKey: error.key,
      operation: error.operation,
    });
  }
  if (error instanceof ApiKeyError) {
    return createEnvelope('API_KEY_ERROR', error.message, source, 403, traceId, {
      keyPrefix: error.keyPrefix,
      reason: error.reason,
    });
  }
  // Unknown errors get a generic 500 with sanitized message
  return createEnvelope('INTERNAL', 'An unexpected error occurred', source, 500, traceId);
}

function createEnvelope(
  code: string,
  message: string,
  source: string,
  statusCode: number,
  traceId: string,
  metadata?: Record<string, unknown>,
): ApiErrorEnvelope {
  return {
    error: {
      code,
      message,
      source,
      traceId,
      timestamp: new Date().toISOString(),
      ...(metadata && { metadata }),
    },
    statusCode,
  };
}

function generateTraceId(): string {
  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Structured error response envelope.
 * All API errors are returned in this format for consistency.
 */
export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    source: string;
    traceId: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  };
  statusCode: number;
}

export class NotFoundError extends Error {}
export class AuthError extends Error {}
export class ForbiddenError extends Error {
  constructor(message: string, public requiredPermission?: string) {
    super(message);
  }
}
export class ConflictError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
  }
}
export class ValidationError extends Error {
  constructor(message: string, public violations?: string[]) {
    super(message);
  }
}
export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number,
    public limit: number,
    public windowSeconds: number,
  ) {
    super(message);
  }
}
export class TenantError extends Error {
  constructor(
    message: string,
    public tenantId?: string,
    public limit?: number,
  ) {
    super(message);
  }
}
export class CacheError extends Error {
  constructor(
    message: string,
    public key: string,
    public operation: 'get' | 'set' | 'invalidate',
  ) {
    super(message);
  }
}
export class ApiKeyError extends Error {
  constructor(
    message: string,
    public keyPrefix: string,
    public reason: 'expired' | 'revoked' | 'rate_limited' | 'scope_exceeded',
  ) {
    super(message);
  }
}
