import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

/**
 * Rate limiters. All of them key on the client IP, which behind Render/Railway
 * arrives via X-Forwarded-For — `app.set('trust proxy', 1)` in app.js is what
 * makes that trustworthy, and without it every request would share one key.
 */
const base = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Rate limiting is a safety net, not a feature — disabling it in tests keeps
  // the suite from flaking, but it is always on in dev and production.
  skip: () => env.isTest,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'That was a few too many requests. Please wait a moment and try again.',
      },
    });
  },
};

/** Broad ceiling for the whole public API. */
export const generalLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 600,
});

/** Price quoting is cheap but hammering it probes the calendar. */
export const quoteLimiter = rateLimit({
  ...base,
  windowMs: 10 * 60 * 1000,
  limit: 60,
});

/** Booking creation opens a Stripe session and takes a lock — keep it tight. */
export const bookingLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 12,
  message: 'Too many booking attempts.',
});

/** Credential stuffing brake. Successful logins are not counted. */
export const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 8,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many sign-in attempts. Try again in 15 minutes.',
      },
    });
  },
});

/** Guessing manage-booking tokens. */
export const manageLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 30,
});

/**
 * The confirmation page's own polling.
 *
 * After returning from Stripe the page polls this every couple of seconds until
 * the webhook lands — around a dozen requests per booking, and more if the guest
 * reloads or books twice. Under the general manage limit that trips the limiter
 * and shows a "too many requests" error at the worst possible moment: right
 * after someone has paid.
 *
 * A looser ceiling is safe here because the endpoint is read-only and keyed on
 * an unguessable Stripe session id — there is nothing to enumerate.
 */
export const sessionLookupLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 200,
});

/** Uploads are expensive and authenticated, but still worth bounding. */
export const uploadLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 120,
});
