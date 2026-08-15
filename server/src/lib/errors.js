/**
 * Operational errors — the ones we *expect* and deliberately surface to the
 * client. Anything that isn't an AppError is treated as a bug and becomes an
 * opaque 500 in production.
 */
export class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, AppError);
  }
}

export const badRequest = (message, details, code = 'BAD_REQUEST') =>
  new AppError(400, code, message, details);

export const unauthorized = (message = 'Authentication required', code = 'UNAUTHORIZED') =>
  new AppError(401, code, message);

export const forbidden = (message = 'Not allowed', code = 'FORBIDDEN') =>
  new AppError(403, code, message);

export const notFound = (message = 'Not found', code = 'NOT_FOUND') =>
  new AppError(404, code, message);

export const conflict = (message, details, code = 'CONFLICT') =>
  new AppError(409, code, message, details);

export const tooManyRequests = (message = 'Too many requests', code = 'RATE_LIMITED') =>
  new AppError(429, code, message);

export const serverError = (message = 'Something went wrong', code = 'INTERNAL_ERROR') =>
  new AppError(500, code, message);

/** Wraps an async route handler so rejections reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
