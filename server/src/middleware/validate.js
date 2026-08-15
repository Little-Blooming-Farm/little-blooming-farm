import { z } from 'zod';
import { badRequest } from '../lib/errors.js';

/**
 * Parse `req.body` / `req.query` / `req.params` through zod schemas and replace
 * them with the parsed result. Because zod strips unknown keys by default, a
 * handler can only ever see fields the schema declared — extra fields (and any
 * operator smuggled past the sanitizer) simply do not exist downstream.
 */
export function validate(schemas) {
  return (req, _res, next) => {
    const issues = [];

    for (const source of ['body', 'query', 'params']) {
      const schema = schemas[source];
      if (!schema) continue;

      const result = schema.safeParse(req[source] ?? {});
      if (!result.success) {
        for (const issue of result.error.issues) {
          issues.push({
            field: [source, ...issue.path].join('.'),
            message: issue.message,
          });
        }
        continue;
      }

      if (source === 'query') {
        // Assigning to req.query is unsupported on newer Express — expose the
        // validated data separately and clear the original in place.
        req.validatedQuery = result.data;
      } else {
        req[source] = result.data;
      }
    }

    if (issues.length > 0) {
      return next(badRequest('Some of the details you entered need a second look.', issues, 'VALIDATION_ERROR'));
    }
    return next();
  };
}

// --- Shared field schemas ---------------------------------------------------

export const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'must be a valid id');

export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a valid slug')
  .max(80);

export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date in YYYY-MM-DD format');

export const email = z.string().trim().toLowerCase().email('must be a valid email address').max(200);

export const safeText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    // Strip control characters that have no business in user text.
    .transform((v) => v.replace(/[\u0000-\u001F\u007F]/g, ''));

export const optionalText = (max) => safeText(max).optional().default('');

/** Coerce a `?limit=25` style query param into a bounded integer. */
export const intParam = (min, max, fallback) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : Number(v)))
    .refine((n) => Number.isInteger(n) && n >= min && n <= max, {
      message: `must be an integer between ${min} and ${max}`,
    });

export const boolParam = (fallback = undefined) =>
  z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? fallback : v === 'true'));

export { z };
