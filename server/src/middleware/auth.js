import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { Admin } from '../models/Admin.js';
import { asyncHandler, forbidden, unauthorized } from '../lib/errors.js';
import logger from '../lib/logger.js';

export const SESSION_COOKIE = 'lbf_admin_session';

/**
 * Session cookie options.
 * - httpOnly: JavaScript (and therefore XSS) cannot read the token.
 * - sameSite: 'lax' by default, which blocks the cross-site POST that CSRF
 *   depends on. `COOKIE_SAMESITE=none` is available for split-domain
 *   deployments; it necessarily gives up SameSite as a CSRF defence, which is
 *   why requireSameOrigin below exists.
 * - secure: always in production, and mandatory whenever sameSite is 'none'.
 */
export function sessionCookieOptions(maxAgeMs) {
  const sameSite = env.COOKIE_SAMESITE;
  return {
    httpOnly: true,
    secure: env.isProduction || sameSite === 'none',
    sameSite,
    path: '/',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
}

export function signAdminToken(admin) {
  return jwt.sign(
    { sub: admin._id.toString(), role: admin.role, tv: admin.tokenVersion },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN, issuer: 'lbf-api', audience: 'lbf-admin' }
  );
}

function readToken(req) {
  const fromCookie = req.cookies?.[SESSION_COOKIE];
  if (fromCookie) return fromCookie;

  // Bearer support exists only for scripted/CI use. Browsers use the cookie.
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();

  return null;
}

/** Require a valid admin session. Attaches `req.admin`. */
export const requireAdmin = asyncHandler(async (req, _res, next) => {
  const token = readToken(req);
  if (!token) throw unauthorized('Please sign in to continue.');

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'lbf-api',
      audience: 'lbf-admin',
    });
  } catch (err) {
    throw unauthorized(
      err.name === 'TokenExpiredError' ? 'Your session expired. Please sign in again.' : 'Invalid session.',
      'SESSION_INVALID'
    );
  }

  const admin = await Admin.findById(payload.sub);
  if (!admin || !admin.isActive) throw unauthorized('This account is no longer active.');

  // A password change bumps tokenVersion, retiring every token issued before it.
  if (admin.tokenVersion !== payload.tv) {
    throw unauthorized('Your session is no longer valid. Please sign in again.', 'SESSION_REVOKED');
  }

  req.admin = admin;
  next();
});

/**
 * CSRF backstop for state-changing admin requests.
 *
 * SameSite=Lax already blocks the cross-site POST that CSRF needs, but that
 * protection disappears entirely under COOKIE_SAMESITE=none. Checking that the
 * request announces one of our own origins restores it: a browser sets Origin
 * on every cross-origin state-changing request and a page cannot forge it.
 *
 * Requests with no Origin at all are allowed — those are non-browser clients
 * (curl, scripts), which carry no ambient cookie to abuse.
 */
export function requireSameOrigin(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const origin = req.get('origin');
  if (!origin) return next();

  const allowed = env.corsOrigins.includes(origin.replace(/\/$/, ''));
  if (allowed) return next();

  logger.warn('Blocked cross-origin admin mutation', { origin, path: req.originalUrl });
  return next(forbidden('This request did not come from the admin panel.', 'BAD_ORIGIN'));
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.admin) return next(unauthorized());
    if (!roles.includes(req.admin.role)) return next(forbidden());
    return next();
  };
}
