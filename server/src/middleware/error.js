import mongoose from 'mongoose';
import env from '../config/env.js';
import logger from '../lib/logger.js';
import { AppError } from '../lib/errors.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  });
}

/**
 * Terminal error handler. In production the client gets a stable machine code
 * and a short human message — never a stack trace, a mongo error string, or a
 * driver-level detail that describes our schema.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies this by arity
export function errorHandler(err, req, res, _next) {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong on our end. Please try again.';
  let details;

  if (err instanceof AppError) {
    ({ statusCode, code, message, details } = err);
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Some of the details you entered need a second look.';
    details = Object.entries(err.errors).map(([field, e]) => ({ field, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'That identifier is not valid.';
  } else if (err?.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE';
    message = 'That record already exists.';
  } else if (err?.type === 'entity.too.large') {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'That request was too large.';
  } else if (err?.type === 'entity.parse.failed') {
    statusCode = 400;
    code = 'MALFORMED_JSON';
    message = 'The request body was not valid JSON.';
  } else if (err?.code === 'EBADCSRFTOKEN') {
    statusCode = 403;
    code = 'BAD_CSRF';
    message = 'Your session expired. Please reload and try again.';
  }

  const logMeta = {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    code,
    requestId: req.id,
  };

  if (statusCode >= 500) {
    logger.error(err.message ?? 'Unhandled error', { ...logMeta, stack: err.stack });
  } else {
    logger.warn(err.message ?? 'Request rejected', logMeta);
  }

  const body = { error: { code, message } };
  if (details) body.error.details = details;

  // Development only: attach the real cause so the failure is debuggable.
  if (!env.isProduction && statusCode >= 500) {
    body.error.debug = { message: err.message, stack: err.stack?.split('\n').slice(0, 6) };
  }

  res.status(statusCode).json(body);
}
