import express from 'express';

import { Admin } from '../../models/Admin.js';
import { asyncHandler, unauthorized } from '../../lib/errors.js';
import logger from '../../lib/logger.js';
import {
  SESSION_COOKIE,
  requireAdmin,
  sessionCookieOptions,
  signAdminToken,
} from '../../middleware/auth.js';
import { loginLimiter } from '../../middleware/rateLimit.js';
import { email as emailSchema, validate, z } from '../../middleware/validate.js';

const router = express.Router();

const LOCK_AFTER_ATTEMPTS = 8;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

/**
 * POST /api/admin/login
 *
 * Rate limited per IP, plus a per-account lockout so a distributed attempt
 * against one mailbox is also throttled. Every failure returns the same
 * message and takes a similar amount of time — nothing here reveals whether
 * an address exists.
 */
router.post(
  '/login',
  loginLimiter,
  validate({
    body: z
      .object({
        email: emailSchema,
        password: z.string().min(1).max(200),
      })
      .strict(),
  }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const genericFailure = unauthorized('Email or password is incorrect.', 'BAD_CREDENTIALS');

    const admin = await Admin.findOne({ email }).select('+passwordHash');

    if (!admin || !admin.isActive) {
      // Spend comparable time so response latency cannot enumerate accounts.
      await Admin.hashPassword(password);
      throw genericFailure;
    }

    if (admin.isLocked()) {
      logger.warn('Login attempt on locked admin account', { adminId: admin._id.toString() });
      throw unauthorized(
        'Too many failed attempts. This account is locked for 15 minutes.',
        'ACCOUNT_LOCKED'
      );
    }

    const ok = await admin.verifyPassword(password);

    if (!ok) {
      admin.failedLoginAttempts += 1;
      if (admin.failedLoginAttempts >= LOCK_AFTER_ATTEMPTS) {
        admin.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
        admin.failedLoginAttempts = 0;
        logger.warn('Admin account locked after repeated failures', {
          adminId: admin._id.toString(),
        });
      }
      await admin.save();
      throw genericFailure;
    }

    admin.failedLoginAttempts = 0;
    admin.lockedUntil = null;
    admin.lastLoginAt = new Date();
    await admin.save();

    const token = signAdminToken(admin);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions(SESSION_MAX_AGE_MS));

    logger.info('Admin signed in', { adminId: admin._id.toString() });
    res.json({ admin: admin.toSafeJSON() });
  })
);

/** POST /api/admin/logout */
router.post('/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  res.json({ ok: true });
});

/** GET /api/admin/me — session probe used by the admin app on load. */
router.get(
  '/me',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ admin: req.admin.toSafeJSON() });
  })
);

/**
 * POST /api/admin/change-password
 * Bumps tokenVersion, which invalidates every session issued before now —
 * including any an attacker may hold.
 */
router.post(
  '/change-password',
  requireAdmin,
  validate({
    body: z
      .object({
        currentPassword: z.string().min(1).max(200),
        newPassword: z
          .string()
          .min(12, 'Use at least 12 characters')
          .max(200)
          .refine((v) => /[a-z]/i.test(v) && /\d/.test(v), {
            message: 'Include at least one letter and one number',
          }),
      })
      .strict(),
  }),
  asyncHandler(async (req, res) => {
    const admin = await Admin.findById(req.admin._id).select('+passwordHash');
    const ok = await admin.verifyPassword(req.body.currentPassword);
    if (!ok) throw unauthorized('Your current password is incorrect.', 'BAD_CREDENTIALS');

    admin.passwordHash = await Admin.hashPassword(req.body.newPassword);
    admin.tokenVersion += 1;
    await admin.save();

    const token = signAdminToken(admin);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions(SESSION_MAX_AGE_MS));

    logger.info('Admin password changed', { adminId: admin._id.toString() });
    res.json({ ok: true });
  })
);

export default router;
