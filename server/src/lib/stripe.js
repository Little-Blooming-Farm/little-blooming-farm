import Stripe from 'stripe';
import env from '../config/env.js';
import logger from './logger.js';
import { AppError } from './errors.js';
import { formatMoney } from './pricing.js';
import { formatRange } from './dates.js';

/**
 * Outside production, STRIPE_API_BASE can redirect the SDK at `stripe-mock` or
 * a local test double. The guard is deliberate: there is no configuration that
 * lets a production deployment talk to anything but Stripe itself.
 */
function localApiOverride() {
  if (env.isProduction || !env.STRIPE_API_BASE) return {};
  const url = new URL(env.STRIPE_API_BASE);
  return {
    host: url.hostname,
    port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
    protocol: url.protocol === 'https:' ? 'https' : 'http',
  };
}

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
  appInfo: { name: 'The Little Blooming Farm', version: '1.0.0' },
  maxNetworkRetries: 2,
  timeout: 20_000,
  ...localApiOverride(),
});

/**
 * Build the Checkout line items for one instalment.
 *
 * A payment in full is itemised (nights, then cleaning) because that is what
 * the guest expects to see. A deposit or balance is a single line naming what
 * it is and what it is part of — itemising a percentage of a cleaning fee is
 * noise, and Stripe totals must match the instalment exactly.
 */
function buildLineItems({ booking, property, payment, stayLabel }) {
  if (payment.kind === 'full') {
    const items = [
      {
        quantity: 1,
        price_data: {
          currency: booking.currency,
          unit_amount: booking.accommodationCents,
          product_data: {
            name: `${property.name} — ${booking.nights} ${booking.nights === 1 ? 'night' : 'nights'}`,
            description: `${stayLabel} · ${formatMoney(booking.nightlyRateCents)} per night`,
          },
        },
      },
    ];
    if (booking.cleaningFeeCents > 0) {
      items.push({
        quantity: 1,
        price_data: {
          currency: booking.currency,
          unit_amount: booking.cleaningFeeCents,
          product_data: {
            name: 'Cleaning fee',
            description: 'One-time preparation of the home before your arrival',
          },
        },
      });
    }
    return items;
  }

  const label =
    payment.kind === 'deposit'
      ? `Deposit — ${property.name}`
      : `Balance — ${property.name}`;

  const description =
    payment.kind === 'deposit'
      ? `${stayLabel} · deposit of ${formatMoney(booking.totalPriceCents)} total. The balance is due before you arrive.`
      : `${stayLabel} · remaining balance of ${formatMoney(booking.totalPriceCents)} total.`;

  return [
    {
      quantity: 1,
      price_data: {
        currency: booking.currency,
        unit_amount: payment.amountCents,
        product_data: { name: label, description },
      },
    },
  ];
}

/**
 * Create the session, translating Stripe's account-configuration failures into
 * something a human can act on.
 *
 * Without this, "no payment method is activated for this currency" reaches the
 * guest as a bare 500 — a booking looks broken when in fact the site is working
 * and the Stripe account simply is not finished. The guest gets a truthful
 * "payments are not available" message, and the log carries the actual fix.
 */
async function createSessionOrExplain(params, options) {
  try {
    return await stripe.checkout.sessions.create(params, options);
  } catch (err) {
    const misconfigured =
      err?.type === 'StripeInvalidRequestError' &&
      /no valid payment method types/i.test(err.message ?? '');

    if (!misconfigured) throw err;

    logger.error('Stripe has no payment method enabled for this currency', {
      currency: env.STRIPE_CURRENCY,
      pinnedTypes: env.stripePaymentMethodTypes,
      livemode: !/^sk_test_/.test(env.STRIPE_SECRET_KEY),
      fix:
        'Activate the account (Stripe → complete your business profile) and enable ' +
        `card payments for ${env.STRIPE_CURRENCY.toUpperCase()} at ` +
        'https://dashboard.stripe.com/settings/payment_methods. To take card and ' +
        'wallet payments meanwhile, set STRIPE_PAYMENT_METHOD_TYPES=card.',
      stripeMessage: err.message,
    });

    throw new AppError(
      503,
      'PAYMENTS_UNAVAILABLE',
      'Online payment is temporarily unavailable. Your dates are still free — ' +
        'please get in touch and we will confirm your stay directly.'
    );
  }
}

/**
 * Create a Checkout Session for one instalment of a booking.
 *
 * The booking id and the instalment id travel in metadata so the webhook can
 * settle exactly the right payment without trusting anything the browser sends
 * back. `expires_at`, when given, is aligned to the booking's hold so Stripe
 * and our calendar release the dates at roughly the same moment.
 *
 * ---- Wallets / Apple Pay -------------------------------------------------
 * By default `payment_method_types` is NOT set, so Checkout offers whatever is
 * enabled in the dashboard. That is the better setup when the account is fully
 * configured: it picks up Link, Cash App and the rest without a code change.
 *
 * Apple Pay and Google Pay are NOT separate entries in that list — they have no
 * `payment_method_types` enum at all. They are wallet presentations of `card`,
 * so they appear as the first, full-width button above the card form whenever
 * `card` is available and the device supports it. Naming `card` explicitly does
 * not suppress them. (An earlier version of this comment claimed it did, and
 * that was wrong.) Nothing else is needed for Apple Pay on hosted Checkout —
 * Stripe owns checkout.stripe.com, so the Apple domain association exists.
 *
 * The dashboard-driven default has one sharp edge: if the account has no method
 * activated for STRIPE_CURRENCY — which is the normal state of an account whose
 * business profile has not been completed — Stripe refuses to create the
 * session at all. STRIPE_PAYMENT_METHOD_TYPES is the escape hatch: set it to
 * `card` to pin the list and keep taking cards and wallets while the account
 * is being activated.
 */
export async function createCheckoutSession({
  booking,
  property,
  payment,
  expiresAt = null,
  successPath,
  cancelPath,
}) {
  const stayLabel = formatRange(booking.checkIn, booking.checkOut);
  const bookingId = booking._id.toString();
  const paymentId = payment._id ? payment._id.toString() : payment.kind;

  const session = await createSessionOrExplain(
    {
      mode: 'payment',
      line_items: buildLineItems({ booking, property, payment, stayLabel }),
      customer_email: booking.guestEmail,
      client_reference_id: bookingId,
      // Shows the wallet button before the card form wherever it is supported.
      ui_mode: 'hosted',
      metadata: {
        bookingId,
        paymentId,
        paymentKind: payment.kind,
        propertyId: property._id.toString(),
        propertySlug: property.slug,
        checkIn: booking.checkIn.toISOString().slice(0, 10),
        checkOut: booking.checkOut.toISOString().slice(0, 10),
      },
      payment_intent_data: {
        description: `${property.name} · ${stayLabel} · ${booking.guestName} · ${payment.kind}`,
        metadata: { bookingId, paymentId, paymentKind: payment.kind },
      },
      success_url:
        successPath ?? `${env.CLIENT_URL}/booking/confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelPath ?? `${env.CLIENT_URL}/book?cancelled=1&property=${property.slug}`,
      ...(expiresAt ? { expires_at: Math.floor(expiresAt.getTime() / 1000) } : {}),
      ...(env.stripePaymentMethodTypes.length
        ? { payment_method_types: env.stripePaymentMethodTypes }
        : {}),
    },
    // One session per instalment. A retried request reuses the same session
    // rather than creating a second one the guest could also pay.
    { idempotencyKey: `checkout:${bookingId}:${paymentId}` }
  );

  logger.info('Stripe Checkout session created', {
    bookingId,
    paymentKind: payment.kind,
    sessionId: session.id,
  });

  return session;
}

export async function retrieveSession(sessionId) {
  return stripe.checkout.sessions.retrieve(sessionId);
}

export async function expireSession(sessionId) {
  try {
    await stripe.checkout.sessions.expire(sessionId);
  } catch (err) {
    // Already completed or expired — nothing to do.
    logger.debug('Could not expire Stripe session', { sessionId, error: err.message });
  }
}

/** Issue a partial or full refund against the booking's PaymentIntent. */
export async function refundPayment({ paymentIntentId, amountCents, bookingId, reason }) {
  if (!paymentIntentId || amountCents <= 0) return null;

  const refund = await stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      amount: amountCents,
      reason: 'requested_by_customer',
      metadata: { bookingId, note: (reason ?? '').slice(0, 200) },
    },
    { idempotencyKey: `refund:${bookingId}:${amountCents}` }
  );

  logger.info('Stripe refund issued', { bookingId, refundId: refund.id, amountCents });
  return refund;
}

export function constructWebhookEvent(rawBody, signature) {
  return stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
}
