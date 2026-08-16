import { randomUUID } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';

import env from './config/env.js';
import logger from './lib/logger.js';
import sanitizeRequest from './middleware/sanitize.js';
import { LOCAL_UPLOAD_DIR } from './lib/upload.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { generalLimiter } from './middleware/rateLimit.js';

import webhookRoutes from './routes/webhooks.js';
import propertyRoutes from './routes/properties.js';
import bookingRoutes from './routes/bookings.js';
import contentRoutes from './routes/content.js';
import adminRoutes from './routes/admin/index.js';

export function createApp() {
  const app = express();

  // Render/Railway/Vercel put exactly one proxy in front of us. Trusting a
  // single hop lets express-rate-limit see the real client IP without letting a
  // client forge X-Forwarded-For to dodge limits.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.set('etag', 'strong');

  // --- Security headers ----------------------------------------------------
  app.use(
    helmet({
      // This service returns JSON and iCal, never HTML, so a restrictive CSP
      // costs nothing and blocks any accidental content sniffing surface.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: env.isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
    })
  );

  // --- CORS ----------------------------------------------------------------
  const allowed = new Set(env.corsOrigins);
  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header: curl, server-to-server, and the OTA calendar
        // fetchers. Those requests carry no cookies, so they cannot be CSRF.
        if (!origin) return callback(null, true);
        if (allowed.has(origin.replace(/\/$/, ''))) return callback(null, true);

        // Deny by omitting the CORS headers rather than by throwing: the
        // browser still blocks the response, but the request gets a clean
        // status from our own handlers instead of a 500 from the error
        // middleware. requireSameOrigin is what actually refuses the write.
        logger.warn('Blocked cross-origin request', { origin });
        return callback(null, false);
      },
      credentials: true, // the admin session cookie rides on these requests
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86_400,
    })
  );

  // --- Request identity + logging -----------------------------------------
  app.use((req, res, next) => {
    req.id = randomUUID();
    res.set('X-Request-Id', req.id);
    const startedAt = Date.now();
    res.on('finish', () => {
      const meta = {
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        ms: Date.now() - startedAt,
        requestId: req.id,
      };
      if (res.statusCode >= 500) logger.error('request', meta);
      else if (res.statusCode >= 400) logger.warn('request', meta);
      else logger.debug('request', meta);
    });
    next();
  });

  app.use(compression());

  /**
   * Stripe webhooks MUST be mounted before the JSON parser: signature
   * verification hashes the exact bytes Stripe sent, and JSON.parse →
   * JSON.stringify does not round-trip byte-for-byte.
   */
  app.use(
    '/api/webhooks',
    express.raw({ type: 'application/json', limit: '1mb' }),
    webhookRoutes
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  app.use(sanitizeRequest);

  /**
   * Development-only static serving for the local-disk upload fallback.
   * Production requires Cloudinary (env validation enforces it), so this path
   * never exists there — and `dotfiles: 'deny'` plus the generated filenames
   * keep it from becoming a file-read primitive even locally.
   */
  if (!env.isProduction && !env.cloudinaryEnabled) {
    app.use(
      '/uploads',
      express.static(LOCAL_UPLOAD_DIR, {
        dotfiles: 'deny',
        index: false,
        maxAge: '1h',
        setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
      })
    );
  }

  // --- Health --------------------------------------------------------------
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  /**
   * The root is not the website — this service is the API, and the site lives
   * at CLIENT_URL. Landing here in a browser used to return a bare JSON 404,
   * which looks broken; say plainly what this is and point at the site.
   */
  app.get('/', (_req, res) => {
    res.json({
      service: 'The Little Blooming Farm API',
      status: 'ok',
      website: env.CLIENT_URL,
      health: '/api/health',
      note: 'This is the API. The website is at the address above.',
    });
  });

  // --- API -----------------------------------------------------------------
  app.use('/api', generalLimiter);
  app.use('/api/properties', propertyRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/content', contentRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
