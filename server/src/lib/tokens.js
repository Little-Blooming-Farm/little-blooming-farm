import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Manage-booking tokens are bearer credentials that travel in a URL. We hand
 * the raw value to the guest exactly once (in the confirmation email) and store
 * only its SHA-256 digest, so a database leak cannot be replayed to cancel
 * someone's stay.
 *
 * SHA-256 without a salt is correct here — unlike a password, the input is 256
 * bits of CSPRNG output, so there is nothing to brute-force.
 */
export function generateManageToken() {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

/** Constant-time comparison of two hex digests. */
export function tokensMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/** Loose shape check before touching the database. */
export function looksLikeToken(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{32,64}$/.test(value);
}
