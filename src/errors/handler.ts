/**
 * Central error handler.
 * Classifies errors and wraps them with context.
 */
export function handleError(error: unknown, source: string): AppError {
  if (error instanceof NotFoundError) {
    return new AppError('NOT_FOUND', error.message, source, 404);
  }
  if (error instanceof AuthError) {
    return new AppError('UNAUTHORIZED', error.message, source, 401);
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
  ) {
    super(message);
  }
}

export class NotFoundError extends Error {}
export class AuthError extends Error {}
