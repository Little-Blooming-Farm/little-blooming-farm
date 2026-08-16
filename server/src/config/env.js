import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load server/.env regardless of the cwd the process was started from.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const bool = (defaultValue) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? defaultValue : v === 'true'));

const intWithin = (min, max, defaultValue) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? defaultValue : Number(v)))
    .refine((n) => Number.isInteger(n) && n >= min && n <= max, {
      message: `must be an integer between ${min} and ${max}`,
    });

const csv = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? '')
      .split(',')
      .map((s) => s.trim().replace(/\/$/, ''))
      .filter(Boolean)
  );

const noTrailingSlash = (schema) => schema.transform((v) => v.replace(/\/+$/, ''));

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: intWithin(1, 65535, 4000),

    CLIENT_URL: noTrailingSlash(z.string().url()),
    SERVER_URL: noTrailingSlash(z.string().url()).default('http://localhost:4000'),
    CORS_ORIGINS: csv,

    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('8h'),
    COOKIE_DOMAIN: z.string().optional().transform((v) => (v ? v : undefined)),
    /**
     * `lax` is right when the site and API share a registrable domain
     * (thelittlebloomingfarm.com + api.thelittlebloomingfarm.com). If they do
     * not — e.g. a vercel.app front end calling an onrender.com API — the
     * session cookie is third-party and `lax` means the browser never sends
     * it, so admin login appears to succeed and then immediately fails.
     * `none` is the escape hatch, and it forces Secure.
     */
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

    STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required'),
    STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required'),
    STRIPE_CURRENCY: z.string().toLowerCase().default('usd'),
    // Point the SDK at `stripe-mock` or a local double. Ignored in production.
    STRIPE_API_BASE: z.string().optional(),

    /**
     * Resend's HTTP API key. Preferred over SMTP where available: it needs no
     * outbound SMTP ports, which several hosts block (Render's free tier blocks
     * 25, 465 and 587; port 25 is blocked on every Render plan). When this is
     * set the SMTP settings below are ignored entirely.
     */
    RESEND_API_KEY: z.string().optional(),

    SMTP_HOST: z.string().optional(),
    SMTP_PORT: intWithin(1, 65535, 587),
    SMTP_SECURE: bool(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().default('The Little Blooming Farm <stay@example.com>'),
    OWNER_NOTIFICATION_EMAIL: z.string().optional(),

    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    CLOUDINARY_FOLDER: z.string().default('little-blooming-farm'),

    BOOKING_HOLD_MINUTES: intWithin(5, 1440, 35),
    MIN_NIGHTS: intWithin(1, 30, 2),
    MAX_ADVANCE_DAYS: intWithin(30, 1825, 540),

    ICAL_SYNC_CRON: z.string().default('*/30 * * * *'),
    ICAL_SYNC_ENABLED: bool(true),
    /**
     * Permits http:// and private-network calendar feeds. Test-only: this
     * disables the SSRF guard, so it is ignored outright in production.
     */
    ICAL_ALLOW_INSECURE_FEEDS: bool(false),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.NODE_ENV !== 'production') return;

    // Production-only hard requirements. Fail at boot, not at request time.
    if (cfg.CORS_ORIGINS.length === 0 || cfg.CORS_ORIGINS.includes('*')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message: 'must list explicit origins in production (wildcard "*" is not allowed)',
      });
    }
    const hasResend = Boolean(cfg.RESEND_API_KEY);
    const hasSmtp = Boolean(cfg.SMTP_HOST && cfg.SMTP_USER && cfg.SMTP_PASS);
    if (!hasResend && !hasSmtp) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RESEND_API_KEY'],
        message:
          'email is not configured. Set RESEND_API_KEY (recommended — uses HTTPS, ' +
          'so it works even where outbound SMTP ports are blocked), or all of ' +
          'SMTP_HOST, SMTP_USER and SMTP_PASS.',
      });
    }
    if (!cfg.CLOUDINARY_CLOUD_NAME || !cfg.CLOUDINARY_API_KEY || !cfg.CLOUDINARY_API_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CLOUDINARY_CLOUD_NAME'],
        message:
          'Cloudinary credentials are required in production — local disk storage is not durable',
      });
    }
    if (/^sk_test_/.test(cfg.STRIPE_SECRET_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STRIPE_SECRET_KEY'],
        message: 'refusing to run in production with a Stripe TEST key',
      });
    }
    /**
     * A connection string with no database path silently lands everything in a
     * database called `test`. That is almost never what someone means in
     * production, and by the time it is noticed there are real bookings in the
     * wrong place — so it fails at boot instead.
     */
    const dbName = databaseNameFrom(cfg.MONGODB_URI);
    if (!dbName || dbName === 'test') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MONGODB_URI'],
        message:
          `no database name in the connection string, so Mongo would use "test". ` +
          `Add one before the "?", e.g. ` +
          `mongodb+srv://user:pass@cluster.mongodb.net/little_blooming_farm?retryWrites=true&w=majority`,
      });
    }

    if (cfg.CLIENT_URL.startsWith('http://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CLIENT_URL'],
        message: 'must be https in production (session cookies are Secure-only)',
      });
    }
    if (!sameSite(cfg.CLIENT_URL, cfg.SERVER_URL) && cfg.COOKIE_SAMESITE !== 'none') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_SAMESITE'],
        message:
          `CLIENT_URL and SERVER_URL are on different sites, so the admin session cookie is ` +
          `third-party and a "${cfg.COOKIE_SAMESITE}" cookie will never be sent — admin login ` +
          `would fail after appearing to succeed. Either put the API on a subdomain of the ` +
          `site's domain (recommended), or set COOKIE_SAMESITE=none.`,
      });
    }
  });

/** The database path from a Mongo URI, ignoring the query string. */
function databaseNameFrom(uri) {
  const match = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/.exec(uri ?? '');
  return match ? decodeURIComponent(match[1]) : null;
}

/** Compare registrable domains, approximately — enough for a boot-time check. */
function sameSite(a, b) {
  try {
    const hostA = new URL(a).hostname;
    const hostB = new URL(b).hostname;
    const base = (host) => host.split('.').slice(-2).join('.');
    return base(hostA) === base(hostB);
  } catch {
    return true; // malformed URLs are already reported by the schema above
  }
}

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  // Deliberately loud and fatal: a misconfigured server is worse than no server.
  console.error(`\nInvalid server environment configuration:\n${details}\n`);
  console.error('Copy server/.env.example to server/.env and fill in the values.\n');
  process.exit(1);
}

export const env = Object.freeze({
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  // In development, fall back to allowing the Vite dev server explicitly.
  corsOrigins:
    parsed.data.CORS_ORIGINS.length > 0
      ? parsed.data.CORS_ORIGINS
      : [parsed.data.CLIENT_URL, 'http://localhost:5173'],
  mailEnabled: Boolean(
    parsed.data.RESEND_API_KEY ||
      (parsed.data.SMTP_HOST && parsed.data.SMTP_USER && parsed.data.SMTP_PASS)
  ),
  mailTransport: parsed.data.RESEND_API_KEY ? 'resend-http' : 'smtp',
  cloudinaryEnabled: Boolean(
    parsed.data.CLOUDINARY_CLOUD_NAME &&
      parsed.data.CLOUDINARY_API_KEY &&
      parsed.data.CLOUDINARY_API_SECRET
  ),
});

export default env;
