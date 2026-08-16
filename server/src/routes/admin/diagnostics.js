import express from 'express';
import rateLimit from 'express-rate-limit';

import env from '../../config/env.js';
import { asyncHandler, badRequest } from '../../lib/errors.js';
import { sendTestEmail } from '../../lib/email.js';

const router = express.Router();

/**
 * Deliberately tight. This is the one admin route that causes an outbound
 * message, so it should not be usable to generate volume even by a signed-in
 * admin whose session has been taken.
 */
const testEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many test emails. Try again shortly.' } },
});

/**
 * Send a test message to the signed-in admin.
 *
 * The recipient is taken from the session and is NOT accepted from the body:
 * an endpoint that mails an arbitrary address is an open relay wearing a
 * different hat, and this one needs no such power to be useful.
 *
 * Errors are surfaced rather than swallowed. The two failures worth naming:
 * an unverified sending domain, and Resend's sandbox rule that
 * onboarding@resend.dev may only deliver to the account owner's own address.
 */
router.post(
  '/test-email',
  testEmailLimiter,
  asyncHandler(async (req, res) => {
    if (!env.mailEnabled) {
      throw badRequest(
        'Email is not configured. Set RESEND_API_KEY, or SMTP_HOST, SMTP_USER and SMTP_PASS.',
        undefined,
        'MAIL_NOT_CONFIGURED'
      );
    }

    const to = req.admin.email;

    try {
      const info = await sendTestEmail({ to });
      res.json({
        ok: true,
        to,
        from: env.MAIL_FROM,
        via: env.mailTransport,
        messageId: info.messageId ?? null,
      });
    } catch (err) {
      const message = err.message ?? 'send failed';
      const sandboxed = /resend\.dev/.test(env.MAIL_FROM) && /403|not allowed|own email/i.test(message);

      throw badRequest(
        sandboxed
          ? `${message} — onboarding@resend.dev can only deliver to the address that owns the ` +
            `Resend account. Either sign in as that address, or verify your own domain.`
          : message,
        undefined,
        'MAIL_SEND_FAILED'
      );
    }
  })
);

export default router;
