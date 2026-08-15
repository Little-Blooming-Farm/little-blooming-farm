import mongoose from 'mongoose';
import env from '../config/env.js';
import { supportsTransactions } from '../config/db.js';
import { Booking, BOOKING_STATUS, PAYMENT_STATUS } from '../models/Booking.js';
import { Property } from '../models/Property.js';
import { findConflicts } from '../lib/availability.js';
import {
  assertDepositChoiceIsValid,
  buildPaymentSchedule,
  computeQuote,
  computeRefundCents,
} from '../lib/pricing.js';
import { propertyLockKey, withLock } from '../lib/lock.js';
import { generateManageToken } from '../lib/tokens.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import logger from '../lib/logger.js';
import {
  createCheckoutSession,
  expireSession,
  refundPayment,
  retrieveSession,
} from '../lib/stripe.js';
import { addDays, toUtcMidnight } from '../lib/dates.js';
import {
  sendBalanceReceipt,
  sendBalanceReminder,
  sendBookingCancellation,
  sendBookingConfirmation,
  sendOwnerNotification,
} from '../lib/email.js';

const DATES_TAKEN =
  'Those nights were just taken. Please choose different dates — the calendar has been refreshed.';

export async function getActiveProperty(propertyId) {
  const property = await Property.findOne({ _id: propertyId, isActive: true });
  if (!property) throw notFound('That home is not available for booking.');
  return property;
}

/**
 * Create a pending booking and its Stripe Checkout Session.
 *
 * Race safety, in layers:
 *
 *  1. A per-property advisory lock serialises the check-then-write. Two
 *     simultaneous requests for the same property cannot interleave at all.
 *  2. When the deployment supports transactions (any replica set, including
 *     every Atlas tier), the availability check and the insert commit together
 *     under `snapshot` read concern and `majority` write concern.
 *  3. After inserting, we re-run the overlap query *including our own row* and
 *     verify we are the only claimant. If anything slipped through — a lock
 *     lost to a clock skew, a standalone mongod with no transactions — the
 *     loser deletes its own booking and reports the conflict. This final check
 *     is what makes double-booking impossible rather than merely unlikely.
 *
 * Stripe is deliberately called *outside* the critical section: a network round
 * trip must never be holding a database transaction open.
 */
export async function createPendingBooking({
  propertyId,
  guestName,
  guestEmail,
  guestPhone,
  guests,
  message,
  checkIn,
  checkOut,
  depositPercent = null,
}) {
  const property = await getActiveProperty(propertyId);
  const quote = computeQuote({ property, checkIn, checkOut, guests });

  // Re-validated here, not just at the route: this is the last point before
  // money is scheduled, and it is the only one that matters.
  const chosenDeposit = assertDepositChoiceIsValid({
    property,
    checkIn: quote.checkIn,
    depositPercent,
  });

  const holdExpiresAt = new Date(Date.now() + env.BOOKING_HOLD_MINUTES * 60_000);

  // Deposit now + balance later, or a single payment — decided by the property's
  // policy and how far out the stay is.
  const schedule = buildPaymentSchedule({
    property,
    checkIn: quote.checkIn,
    totalPriceCents: quote.totalPriceCents,
    depositPercent: chosenDeposit,
  });

  const booking = await withLock(propertyLockKey(property._id.toString()), async () => {
    const draft = {
      propertyId: property._id,
      guestName,
      guestEmail,
      guestPhone: guestPhone ?? '',
      guests: guests ?? 1,
      message: message ?? '',
      checkIn: quote.checkIn,
      checkOut: quote.checkOut,
      nights: quote.nights,
      nightlyRateCents: quote.nightlyRateCents,
      accommodationCents: quote.accommodationCents,
      cleaningFeeCents: quote.cleaningFeeCents,
      totalPriceCents: quote.totalPriceCents,
      currency: quote.currency,
      status: BOOKING_STATUS.PENDING,
      holdExpiresAt,
      source: 'direct',
      payments: schedule,
    };

    const created = supportsTransactions()
      ? await insertWithTransaction(property, quote, draft)
      : await insertWithoutTransaction(property, quote, draft);

    // Layer 3 — post-insert uniqueness proof.
    await assertSoleClaimant(created, property, quote);

    return created;
  });

  // --- Outside the lock: talk to Stripe ------------------------------------
  try {
    // Only the first instalment is charged now. The balance, if any, is taken
    // later from the guest portal.
    const firstPayment = booking.payments[0];

    const session = await createCheckoutSession({
      booking,
      property,
      payment: firstPayment,
      expiresAt: holdExpiresAt,
    });

    firstPayment.stripeSessionId = session.id;
    booking.stripeSessionId = session.id;
    await booking.save();

    return {
      booking,
      property,
      quote,
      checkoutUrl: session.url,
      dueNowCents: firstPayment.amountCents,
    };
  } catch (err) {
    // Never leave an unpayable booking sitting on the calendar.
    await Booking.deleteOne({ _id: booking._id, status: BOOKING_STATUS.PENDING });
    logger.error('Stripe session creation failed; pending booking rolled back', {
      bookingId: booking._id.toString(),
      error: err.message,
    });
    throw err;
  }
}

async function insertWithTransaction(property, quote, draft) {
  const session = await mongoose.startSession();
  try {
    let created;
    await session.withTransaction(
      async () => {
        const { hasConflict } = await findConflicts(
          property._id,
          quote.checkIn,
          quote.checkOut,
          { session }
        );
        if (hasConflict) throw conflict(DATES_TAKEN, undefined, 'DATES_UNAVAILABLE');

        const [doc] = await Booking.create([draft], { session });
        created = doc;
      },
      {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary',
      }
    );
    return created;
  } finally {
    await session.endSession();
  }
}

async function insertWithoutTransaction(property, quote, draft) {
  const { hasConflict } = await findConflicts(property._id, quote.checkIn, quote.checkOut);
  if (hasConflict) throw conflict(DATES_TAKEN, undefined, 'DATES_UNAVAILABLE');
  return Booking.create(draft);
}

/**
 * Re-check overlaps now that our row exists. If any *other* active booking or
 * block covers these nights, we lost a race we thought we had won — undo.
 */
async function assertSoleClaimant(booking, property, quote) {
  const { hasConflict } = await findConflicts(property._id, quote.checkIn, quote.checkOut, {
    excludeBookingId: booking._id,
  });

  if (hasConflict) {
    await Booking.deleteOne({ _id: booking._id, status: BOOKING_STATUS.PENDING });
    logger.warn('Post-insert conflict detected; pending booking withdrawn', {
      bookingId: booking._id.toString(),
      propertyId: property._id.toString(),
    });
    throw conflict(DATES_TAKEN, undefined, 'DATES_UNAVAILABLE');
  }
}

/**
 * Settle a paid Checkout Session.
 *
 * Driven only by a verified Stripe webhook — never by the browser redirect.
 * Two distinct cases share this path:
 *
 *   • the FIRST instalment (deposit or full) confirms the booking and sends
 *     the guest their portal link;
 *   • a LATER instalment (balance) marks that instalment paid and, once
 *     nothing is outstanding, tells the guest they are fully settled.
 *
 * Idempotency is per-instalment: the filter requires that instalment to still
 * be `due`, so a replayed event matches nothing the second time and cannot
 * double-count a payment.
 */
export async function settlePaidSession(session) {
  const bookingId = session.client_reference_id ?? session.metadata?.bookingId;
  if (!bookingId || !mongoose.isValidObjectId(bookingId)) {
    logger.error('Stripe session carried no usable booking id', { sessionId: session.id });
    return { settled: false, reason: 'NO_BOOKING_ID' };
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    logger.warn('Webhook referenced an unknown booking', { bookingId });
    return { settled: false, reason: 'NOT_FOUND' };
  }
  if (booking.status === BOOKING_STATUS.CANCELLED) {
    // Paying for a cancelled stay should never happen, but if it does we want
    // it visible rather than silently applied.
    logger.error('Payment received for a cancelled booking — refund manually', {
      bookingId,
      sessionId: session.id,
    });
    return { settled: false, reason: 'CANCELLED' };
  }

  // Locate the instalment this session was created for.
  const paymentId = session.metadata?.paymentId;
  const payment =
    (paymentId && booking.payments.id(paymentId)) ||
    booking.payments.find((p) => p.stripeSessionId === session.id) ||
    booking.payments.find((p) => p.status === PAYMENT_STATUS.DUE);

  if (!payment) {
    logger.warn('Webhook could not match an instalment', { bookingId, sessionId: session.id });
    return { settled: false, reason: 'NO_PAYMENT' };
  }

  if (payment.status === PAYMENT_STATUS.PAID) {
    logger.info('Webhook replay ignored — instalment already paid', {
      bookingId,
      paymentKind: payment.kind,
    });
    return { settled: true, replay: true, booking };
  }

  const wasPending = booking.status === BOOKING_STATUS.PENDING;

  payment.status = PAYMENT_STATUS.PAID;
  payment.paidAt = new Date();
  payment.stripeSessionId = session.id;
  payment.stripePaymentIntentId = paymentIntentId;

  if (wasPending) {
    booking.status = BOOKING_STATUS.CONFIRMED;
    booking.holdExpiresAt = null; // a paid stay holds the calendar unconditionally
    booking.stripeSessionId = session.id;
    booking.stripePaymentIntentId = paymentIntentId;
    booking.paidAt = new Date();
  }

  const property = await Property.findById(booking.propertyId);

  let manageUrl = null;
  if (wasPending) {
    // Mint the portal token now and store only its hash.
    const { raw, hash } = generateManageToken();
    booking.cancellationToken = hash;
    booking.confirmationEmailSentAt = new Date();
    manageUrl = `${env.CLIENT_URL}/booking/manage/${raw}`;
  }

  await booking.save();

  if (wasPending) {
    await Promise.all([
      sendBookingConfirmation({ booking, property, manageUrl }),
      sendOwnerNotification({ booking, property, kind: 'new' }),
    ]);
    logger.info('Booking confirmed', {
      bookingId: booking._id.toString(),
      paymentKind: payment.kind,
      balanceDueCents: booking.balanceDueCents(),
    });
  } else {
    await sendBalanceReceipt({ booking, property, payment });
    logger.info('Instalment paid', {
      bookingId: booking._id.toString(),
      paymentKind: payment.kind,
      balanceDueCents: booking.balanceDueCents(),
    });
  }

  return { settled: true, booking, property, payment, confirmed: wasPending };
}

/** Backwards-compatible alias — the webhook router still speaks this name. */
export const confirmBookingFromSession = settlePaidSession;

/**
 * A Checkout Session that expired or was abandoned.
 *
 * Two very different cases, and conflating them would be destructive:
 *
 *   • an unpaid FIRST instalment means the booking was never paid for at all —
 *     delete it and free the dates;
 *   • an abandoned BALANCE payment on an already-confirmed stay must leave the
 *     booking completely alone. We only clear the dead session id so the guest
 *     can start a fresh one.
 */
export async function releaseBookingForSession(session, reason) {
  const bookingId = session.client_reference_id ?? session.metadata?.bookingId;
  if (!bookingId || !mongoose.isValidObjectId(bookingId)) return { released: false };

  const booking = await Booking.findById(bookingId);
  if (!booking) return { released: false };

  if (booking.status === BOOKING_STATUS.PENDING) {
    const result = await Booking.deleteOne({ _id: bookingId, status: BOOKING_STATUS.PENDING });
    if (result.deletedCount > 0) {
      logger.info('Pending booking released', { bookingId, reason });
    }
    return { released: result.deletedCount > 0 };
  }

  // Confirmed stay: forget the expired session, keep everything else.
  const payment = booking.payments.find((p) => p.stripeSessionId === session.id);
  if (payment && payment.status === PAYMENT_STATUS.DUE) {
    payment.stripeSessionId = undefined;
    await booking.save();
    logger.info('Abandoned balance session cleared', { bookingId, reason });
  }
  return { released: false, keptBooking: true };
}

/**
 * Cancel a booking and refund per policy. Uses an atomic status transition so
 * a guest double-clicking "cancel" cannot trigger two refunds.
 */
export async function cancelBooking({ bookingId, cancelledBy, reason, refundOverrideCents }) {
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: { $in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED] } },
    {
      $set: {
        status: BOOKING_STATUS.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy,
        cancellationReason: (reason ?? '').slice(0, 1000),
      },
    },
    { new: false } // capture the pre-cancellation state for refund maths
  );

  if (!booking) {
    const existing = await Booking.findById(bookingId).lean();
    if (existing?.status === BOOKING_STATUS.CANCELLED) {
      throw conflict('This booking has already been cancelled.', undefined, 'ALREADY_CANCELLED');
    }
    throw notFound('Booking not found.');
  }

  const property = await Property.findById(booking.propertyId);

  // A pending booking never charged the card — just let the session lapse.
  if (booking.status === BOOKING_STATUS.PENDING) {
    if (booking.stripeSessionId) await expireSession(booking.stripeSessionId);
    const fresh = await Booking.findById(bookingId);
    return { booking: fresh, property, refundCents: 0 };
  }

  const refundCents =
    refundOverrideCents != null ? refundOverrideCents : computeRefundCents(booking);

  /**
   * Refund across instalments, newest paid first.
   *
   * With a deposit and a balance the money sits behind two separate
   * PaymentIntents, and Stripe can only refund each against its own. So the
   * amount owed is drawn down instalment by instalment — refunding the balance
   * before touching the deposit, which is both the intuitive order and the one
   * that leaves the cleanest audit trail.
   */
  const paidInstalments = (booking.payments ?? [])
    .filter((p) => p.status === PAYMENT_STATUS.PAID && p.stripePaymentIntentId)
    .sort((a, b) => new Date(b.paidAt ?? 0) - new Date(a.paidAt ?? 0));

  let remaining = refundCents;
  let refundedTotal = 0;
  let lastRefundId = null;
  const refundedByPayment = new Map();

  for (const instalment of paidInstalments) {
    if (remaining <= 0) break;

    const refundable = instalment.amountCents - (instalment.amountRefundedCents ?? 0);
    const slice = Math.min(remaining, refundable);
    if (slice <= 0) continue;

    try {
      const refund = await refundPayment({
        paymentIntentId: instalment.stripePaymentIntentId,
        amountCents: slice,
        bookingId: `${booking._id.toString()}:${instalment._id.toString()}`,
        reason,
      });
      if (refund) {
        lastRefundId = refund.id;
        refundedTotal += slice;
        remaining -= slice;
        refundedByPayment.set(instalment._id.toString(), slice);
      }
    } catch (err) {
      // The cancellation stands; the refund is retried by hand from admin.
      logger.error('Refund failed after cancellation', {
        bookingId: booking._id.toString(),
        paymentKind: instalment.kind,
        error: err.message,
      });
    }
  }

  // Legacy bookings with no instalment schedule still refund off the booking.
  if (paidInstalments.length === 0 && refundCents > 0 && booking.stripePaymentIntentId) {
    try {
      const refund = await refundPayment({
        paymentIntentId: booking.stripePaymentIntentId,
        amountCents: refundCents,
        bookingId: booking._id.toString(),
        reason,
      });
      if (refund) {
        lastRefundId = refund.id;
        refundedTotal = refundCents;
      }
    } catch (err) {
      logger.error('Refund failed after cancellation', {
        bookingId: booking._id.toString(),
        error: err.message,
      });
    }
  }

  const fresh = await Booking.findById(bookingId);
  fresh.stripeRefundId = lastRefundId;
  fresh.amountRefundedCents = refundedTotal;
  for (const instalment of fresh.payments ?? []) {
    const slice = refundedByPayment.get(instalment._id.toString());
    if (slice) {
      instalment.amountRefundedCents = (instalment.amountRefundedCents ?? 0) + slice;
      if (instalment.amountRefundedCents >= instalment.amountCents) {
        instalment.status = PAYMENT_STATUS.REFUNDED;
      }
    }
    // Nothing further can be collected on a cancelled stay.
    if (instalment.status === PAYMENT_STATUS.DUE) instalment.status = PAYMENT_STATUS.VOID;
  }
  await fresh.save();

  const updated = fresh;

  await Promise.all([
    sendBookingCancellation({
      booking: updated,
      property,
      refundCents: refundedTotal,
    }),
    sendOwnerNotification({ booking: updated, property, kind: 'cancelled' }),
  ]);

  logger.info('Booking cancelled', {
    bookingId: booking._id.toString(),
    cancelledBy,
    refundCents: refundedTotal,
  });

  return { booking: updated, property, refundCents: refundedTotal };
}

/**
 * Janitor for pending bookings whose hold lapsed without payment. The
 * availability queries already ignore them, so this is housekeeping rather
 * than correctness — it keeps the collection and the admin views honest.
 */
export async function releaseExpiredHolds() {
  const stale = await Booking.find({
    status: BOOKING_STATUS.PENDING,
    holdExpiresAt: { $lt: new Date() },
  })
    .select('_id stripeSessionId')
    .lean();

  if (stale.length === 0) return { released: 0 };

  await Promise.all(
    stale.map((b) => (b.stripeSessionId ? expireSession(b.stripeSessionId) : Promise.resolve()))
  );

  const result = await Booking.deleteMany({
    _id: { $in: stale.map((b) => b._id) },
    status: BOOKING_STATUS.PENDING,
  });

  logger.info('Expired booking holds released', { count: result.deletedCount });
  return { released: result.deletedCount };
}

/**
 * Open a Checkout Session for a booking's outstanding balance.
 *
 * Reuses the existing session when one is already open for that instalment, so
 * a guest who clicks twice cannot end up with two payable pages for the same
 * money. Only a confirmed booking with something actually due can reach here.
 */
export async function createBalancePayment({ booking, property, manageToken }) {
  if (booking.status !== BOOKING_STATUS.CONFIRMED) {
    throw conflict('Only a confirmed booking can take a further payment.');
  }

  const payment = booking.nextPayment();
  if (!payment) {
    throw conflict('This booking is fully paid — there is nothing left to settle.', undefined, 'NOTHING_DUE');
  }

  if (payment.stripeSessionId) {
    // An open session already exists; hand back the same one if it is still live.
    try {
      const existing = await retrieveSession(payment.stripeSessionId);
      if (existing?.status === 'open' && existing.url) {
        return { checkoutUrl: existing.url, payment, reused: true };
      }
    } catch {
      // Gone or unreadable — fall through and make a new one.
    }
  }

  const session = await createCheckoutSession({
    booking,
    property,
    payment,
    // Both routes land back in the guest's own portal. The raw token comes from
    // the request that triggered this — it is never stored, only forwarded.
    successPath: `${env.CLIENT_URL}/booking/manage/${manageToken}?payment=success`,
    cancelPath: `${env.CLIENT_URL}/booking/manage/${manageToken}?payment=cancelled`,
  });

  payment.stripeSessionId = session.id;
  await booking.save();

  return { checkoutUrl: session.url, payment, reused: false };
}

/**
 * Record the guest's acceptance of the rental agreement.
 *
 * Stores the agreement version alongside the signature, so later edits to the
 * property's terms cannot retroactively change what this guest agreed to. The
 * IP and user agent are kept as ordinary evidence of assent.
 */
export async function acceptRentalAgreement({ booking, property, signatureName, ip, userAgent }) {
  if (booking.agreement?.acceptedAt) {
    throw conflict('This agreement has already been signed.', undefined, 'ALREADY_SIGNED');
  }

  const expected = booking.guestName.trim().toLowerCase();
  const given = signatureName.trim().toLowerCase();
  if (given !== expected) {
    throw badRequest(
      `Please type your name exactly as it appears on the booking: ${booking.guestName}.`,
      undefined,
      'SIGNATURE_MISMATCH'
    );
  }

  booking.agreement = {
    version: property.rentalAgreement?.version ?? 1,
    acceptedAt: new Date(),
    signatureName: signatureName.trim(),
    ip: (ip ?? '').slice(0, 64),
    userAgent: (userAgent ?? '').slice(0, 300),
  };
  await booking.save();

  logger.info('Rental agreement accepted', {
    bookingId: booking._id.toString(),
    version: booking.agreement.version,
  });

  return booking;
}

/**
 * Whether the sensitive arrival details should be released to this guest yet.
 *
 * Three conditions, all required: the stay is confirmed, nothing is outstanding,
 * and check-in is close. Money and paperwork before keys.
 */
export function arrivalInfoIsReleased({ booking, property, now = new Date() }) {
  if (booking.status !== BOOKING_STATUS.CONFIRMED) return false;
  if (booking.balanceDueCents() > 0) return false;

  if (property?.rentalAgreement?.requireAcceptance && !booking.agreement?.acceptedAt) {
    return false;
  }

  const releaseDays = property?.arrivalInfoReleaseDays ?? 7;
  const releaseFrom = addDays(toUtcMidnight(booking.checkIn), -releaseDays);
  if (now < releaseFrom) return false;

  // Stops being useful once the stay is over.
  return now < addDays(toUtcMidnight(booking.checkOut), 1);
}

/** Explain, in the guest's terms, why the arrival details are not showing yet. */
export function arrivalInfoStatus({ booking, property, now = new Date() }) {
  if (arrivalInfoIsReleased({ booking, property, now })) {
    return { released: true, reason: null };
  }
  if (booking.status !== BOOKING_STATUS.CONFIRMED) {
    return { released: false, reason: 'This booking is not confirmed.' };
  }
  if (booking.balanceDueCents() > 0) {
    return { released: false, reason: 'Your arrival details unlock once the balance is settled.' };
  }
  if (property?.rentalAgreement?.requireAcceptance && !booking.agreement?.acceptedAt) {
    return { released: false, reason: 'Sign the rental agreement and your arrival details appear here.' };
  }

  const releaseDays = property?.arrivalInfoReleaseDays ?? 7;
  return {
    released: false,
    reason: `Gate code, wifi and directions appear here ${releaseDays} days before you arrive.`,
  };
}

/**
 * Email guests whose balance is due soon and has not been paid.
 *
 * Runs daily. `reminderSentAt` makes it at-most-once per instalment, so a
 * restart or a double tick cannot spam anybody.
 */
export async function sendBalanceReminders({ withinDays = 7, now = new Date() } = {}) {
  const horizon = addDays(now, withinDays);

  const bookings = await Booking.find({
    status: BOOKING_STATUS.CONFIRMED,
    payments: {
      $elemMatch: {
        status: PAYMENT_STATUS.DUE,
        dueDate: { $lte: horizon },
        reminderSentAt: null,
      },
    },
  }).populate('propertyId');

  let sent = 0;
  for (const booking of bookings) {
    const payment = booking.payments.find(
      (p) => p.status === PAYMENT_STATUS.DUE && p.dueDate && p.dueDate <= horizon && !p.reminderSentAt
    );
    if (!payment) continue;

    // The portal token is hashed, so a fresh one is minted for the reminder.
    const { raw, hash } = generateManageToken();
    booking.cancellationToken = hash;
    payment.reminderSentAt = new Date();
    await booking.save();

    await sendBalanceReminder({
      booking,
      property: booking.propertyId,
      payment,
      manageUrl: `${env.CLIENT_URL}/booking/manage/${raw}`,
    });
    sent += 1;
  }

  if (sent > 0) logger.info('Balance reminders sent', { count: sent });
  return { sent };
}
