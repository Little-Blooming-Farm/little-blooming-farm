/**
 * NoSQL-injection defence, applied before any handler sees the request.
 *
 * Mongo operators only become dangerous when a *user-supplied object* reaches a
 * query. Stripping keys that begin with `$` (operators) or contain `.` (path
 * traversal into subdocuments) removes that capability entirely, without the
 * express-mongo-sanitize dependency and without mutating request getters.
 *
 * This is defence in depth: every route also parses its input through a zod
 * schema that drops unknown keys, and mongoose runs with `sanitizeFilter`.
 */

const MAX_DEPTH = 12;

function scrub(value, depth = 0) {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) value[i] = scrub(value[i], depth + 1);
    return value;
  }

  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete value[key];
      continue;
    }
    // Block prototype-pollution vectors while we're walking the object anyway.
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      delete value[key];
      continue;
    }
    value[key] = scrub(value[key], depth + 1);
  }
  return value;
}

export function sanitizeRequest(req, _res, next) {
  if (req.body) scrub(req.body);
  if (req.params) scrub(req.params);
  // req.query is a getter on some Express versions — mutate in place, never reassign.
  if (req.query) scrub(req.query);
  next();
}

export default sanitizeRequest;
