import express from 'express';

import { constructWebhookEvent } from '../lib/stripe.js';
import { Booking } from '../models/Booking.js';
import {
  releaseBookingForSession,
  settlePaidSession,
} from '../services/bookingService.js';
import logger from '../lib/logger.js';

const router = express.Router();

/**
 * POST /api/webhooks/stripe
 *
 * The single source of truth for "this booking is paid". The browser redirect
 * to /booking/confirmed proves nothing — a guest can navigate there by hand —
 * so no state transition anywhere in this codebase trusts it.
 *
 * `express.raw` is mounted on this path in app.js: signature verification needs
 * the exact bytes Stripe signed, which JSON parsing would destroy.
 */
router.post('/stripe', async (req, res) => {
  const signature = req.get('stripe-signature');

  if (!signature) {
    logger.warn('Stripe webhook received without a signature header');
    return res.status(400).json({ error: { code: 'NO_SIGNATURE', message: 'Missing signature' } });
  }
  if (!Buffer.isBuffer(req.body)) {
    logger.error('Stripe webhook body was parsed before verification — check middleware order');
    return res.status(500).json({ error: { code: 'BAD_BODY', message: 'Invalid webhook body' } });
  }

  let event;
  try {
    event = constructWebhookEvent(req.body, signature);
  } catch (err) {
    // Either a forgery or a stale/incorrect STRIPE_WEBHOOK_SECRET.
    logger.warn('Stripe webhook signature verification failed', { error: err.message });
    return res
      .status(400)
      .json({ error: { code: 'INVALID_SIGNATURE', message: 'Signature verification failed' } });
  }

  logger.info('Stripe webhook received', { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        // Card payments arrive already paid. Delayed methods (e.g. bank debits)
        // land as `unpaid` and are confirmed later by async_payment_succeeded.
        if (session.payment_status === 'paid') {
          await settlePaidSession(session);
        } else {
          logger.info('Checkout completed but payment still pending', {
            sessionId: session.id,
            paymentStatus: session.payment_status,
          });
        }
        break;
      }

      case 'checkout.session.async_payment_succeeded':
        await settlePaidSession(event.data.object);
        break;

      case 'checkout.session.expired':
        await releaseBookingForSession(event.data.object, 'checkout_expired');
        break;

      case 'checkout.session.async_payment_failed':
        await releaseBookingForSession(event.data.object, 'async_payment_failed');
        break;

      case 'charge.refunded': {
        // Keep our record straight when a refund is issued from the Stripe
        // dashboard rather than through the admin panel. With instalments the
        // PaymentIntent may belong to the booking or to one of its payments, so
        // both are checked.
        const charge = event.data.object;
        const paymentIntentId =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id;

        if (paymentIntentId) {
          const booking = await Booking.findOne({
            $or: [
              { stripePaymentIntentId: paymentIntentId },
              { 'payments.stripePaymentIntentId': paymentIntentId },
            ],
          });

          if (booking) {
            const instalment = booking.payments.find(
              (p) => p.stripePaymentIntentId === paymentIntentId
            );
            if (instalment) {
              instalment.amountRefundedCents = charge.amount_refunded ?? 0;
              if (instalment.amountRefundedCents >= instalment.amountCents) {
                instalment.status = 'refunded';
              }
            }
            booking.amountRefundedCents = (booking.payments ?? []).reduce(
              (sum, p) => sum + (p.amountRefundedCents ?? 0),
              0
            ) || (charge.amount_refunded ?? 0);
            await booking.save();
          }
        }
        break;
      }

      default:
        logger.debug('Unhandled Stripe event type', { type: event.type });
    }

    return res.json({ received: true });
  } catch (err) {
    // Return 500 so Stripe retries with backoff. Handlers above are idempotent,
    // so a retry after a partial failure is safe.
    logger.error('Stripe webhook handler failed', {
      type: event.type,
      id: event.id,
      error: err.message,
      stack: err.stack,
    });
    return res
      .status(500)
      .json({ error: { code: 'WEBHOOK_HANDLER_FAILED', message: 'Processing failed' } });
  }
});

export default router;
