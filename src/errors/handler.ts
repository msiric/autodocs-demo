/**
 * Central error classifier.
 * Classifies errors by type and wraps them with context for API responses.
 * All error types map to specific HTTP status codes and machine-readable codes.
 */
export function classifyError(error: unknown, source: string): AppError {
  if (error instanceof NotFoundError) {
    return new AppError('NOT_FOUND', error.message, source, 404);
  }
  if (error instanceof AuthError) {
    return new AppError('UNAUTHORIZED', error.message, source, 401);
  }
  if (error instanceof ForbiddenError) {
    return new AppError('FORBIDDEN', error.message, source, 403, {
      requiredPermission: error.requiredPermission,
    });
  }
  if (error instanceof ConflictError) {
    return new AppError('CONFLICT', error.message, source, 409, {
      conflictField: error.field,
    });
  }
  if (error instanceof ValidationError) {
    return new AppError('VALIDATION', error.message, source, 400);
  }
  // Unknown errors get a generic 500 with sanitized message
  return new AppError('INTERNAL', 'An unexpected error occurred', source, 500);
}

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public source: string,
    public statusCode: number,
    public metadata?: Record<string, unknown>,
  ) {
    super(message);
  }
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
export class ValidationError extends Error {}
