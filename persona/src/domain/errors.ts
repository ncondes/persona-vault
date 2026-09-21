export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(404, code, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists', code = 'CONFLICT') {
    super(409, code, message);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', fields?: Record<string, string>) {
    super(400, 'VALIDATION_ERROR', message, fields);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(401, code, message);
  }
}

export class TooManyRequestsError extends AppError {
  // Seconds until the caller should try again. The error handler turns it into
  // a Retry-After header, so a client is told how long to wait rather than
  // left to guess and hammer.
  readonly retryAfterSeconds?: number;

  constructor(
    message = 'Too many requests',
    code = 'TOO_MANY_REQUESTS',
    retryAfterSeconds?: number,
  ) {
    super(429, code, message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
