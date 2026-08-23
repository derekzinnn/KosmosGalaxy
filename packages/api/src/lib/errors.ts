/**
 * Application errors.
 *
 * `code` is a stable machine-readable identifier; it is part of the API
 * contract and must not change casually. `message` is for developers and
 * logs — it is English on purpose. All Portuguese copy shown to clients
 * lives in the web package, keyed by `code`, so the API stays language
 * neutral and the product can be translated without touching the backend.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  /** Errors flagged as expected are logged at warn, not error. */
  readonly expected: boolean;

  constructor(options: {
    message: string;
    status: number;
    code: string;
    details?: unknown;
    expected?: boolean;
  }) {
    super(options.message);
    this.name = new.target.name;
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.expected = options.expected ?? true;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Malformed request', code = 'BAD_REQUEST', details?: unknown) {
    super({ message, status: 400, code, details });
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown, message = 'Request failed validation') {
    super({ message, status: 422, code: 'VALIDATION_FAILED', details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = 'UNAUTHORIZED') {
    super({ message, status: 401, code });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions', code = 'FORBIDDEN') {
    super({ message, status: 403, code });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super({ message, status: 404, code });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists', code = 'CONFLICT') {
    super({ message, status: 409, code });
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests', code = 'RATE_LIMITED') {
    super({ message, status: 429, code });
  }
}

/**
 * Raised by the tenant guard when a query for a tenant-scoped model reaches
 * the database without a tenant filter. This is always a programming error,
 * never a user error, so it is deliberately a 500 and is logged loudly.
 */
export class TenantScopeViolationError extends AppError {
  constructor(message: string) {
    super({
      message,
      status: 500,
      code: 'TENANT_SCOPE_VIOLATION',
      expected: false,
    });
  }
}
