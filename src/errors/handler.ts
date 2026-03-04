/**
 * Central error handler.
 * Classifies errors and wraps them with context.
 */
export function classifyError(error: unknown, source: string): AppError {
  if (error instanceof NotFoundError) {
    return new AppError('NOT_FOUND', error.message, source, 404);
  }
  if (error instanceof AuthError) {
    return new AppError('UNAUTHORIZED', error.message, source, 401);
  }
  if (error instanceof RateLimitError) {
    return new AppError('RATE_LIMITED', error.message, source, 429, {
      retryAfter: error.retryAfter,
    });
  }
  if (error instanceof ValidationError) {
    return new AppError('VALIDATION', error.message, source, 400);
  }
  // Unknown errors get a generic 500
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
export class RateLimitError extends Error {
  constructor(message: string, public retryAfter: number) {
    super(message);
  }
}
export class ValidationError extends Error {}
