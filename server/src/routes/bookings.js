import express from 'express';

import { Booking, BOOKING_STATUS } from '../models/Booking.js';
import {
  assertDepositChoiceIsValid,
  buildPaymentSchedule,
  computeQuote,
  computeRefundCents,
  depositChoicesFor,
} from '../lib/pricing.js';
import { isRangeAvailable } from '../lib/availability.js';
import { asyncHandler, conflict, notFound } from '../lib/errors.js';
import { hashToken, looksLikeToken } from '../lib/tokens.js';
import {
  acceptRentalAgreement,
  arrivalInfoStatus,
  cancelBooking,
  createBalancePayment,
  createPendingBooking,
  getActiveProperty,
} from '../services/bookingService.js';
import { findDiscountByCode } from '../services/discountService.js';
import {
  bookingLimiter,
  manageLimiter,
  quoteLimiter,
  sessionLookupLimiter,
} from '../middleware/rateLimit.js';
import {
  dateOnly,
  email as emailSchema,
  objectId,
  optionalText,
  safeText,
  validate,
  z,
} from '../middleware/validate.js';

const router = express.Router();

const stayShape = {
  propertyId: objectId,
  checkIn: dateOnly,
  checkOut: dateOnly,
  guests: z.number().int().min(1).max(40),
  /**
   * Only ever the code itself. What it is worth is decided server-side from the
   * database — an amount posted from the browser is not read anywhere.
   */
  discountCode: z.string().trim().max(40).optional(),
};

/**
 * How much of the total the guest wants to pay now. 100 is pay in full.
 * The value is checked against the property's own options server-side — this
 * only bounds it to something sane before it gets there.
 */
const depositChoice = z.number().int().min(1).max(100).optional();

/**
 * POST /api/bookings/quote
 * Validates the dates, confirms they are still open, returns the breakdown.
 * A quote is advisory — it never holds the calendar.
 */
router.post(
  '/quote',
  quoteLimiter,
  validate({ body: z.object({ ...stayShape, depositPercent: depositChoice }).strict() }),
  asyncHandler(async (req, res) => {
    const { propertyId, checkIn, checkOut, guests, depositPercent, discountCode } = req.body;

    const property = await getActiveProperty(propertyId);
    const discount = discountCode ? await findDiscountByCode(discountCode) : null;
    const quote = computeQuote({ property, checkIn, checkOut, guests, discount, requestedCode: discountCode });

    const chosen = assertDepositChoiceIsValid({
      property,
      checkIn: quote.checkIn,
      depositPercent,
    });

    const available = await isRangeAvailable(property._id, quote.checkIn, quote.checkOut);

    // Preview of what will actually be charged, and when — so the booking page
    // can say "pay this today, the rest before you arrive" before committing.
    const schedule = buildPaymentSchedule({
      property,
      checkIn: quote.checkIn,
      totalPriceCents: quote.totalPriceCents,
      depositPercent: chosen,
    });

    // What the guest may choose, and what each option would cost today — so the
    // booking page can render real amounts rather than doing its own maths.
    const choices = depositChoicesFor({ property, checkIn: quote.checkIn });
    const depositOptions = choices.options.map((percent) => {
      const [first] = buildPaymentSchedule({
        property,
        checkIn: quote.checkIn,
        totalPriceCents: quote.totalPriceCents,
        depositPercent: percent,
      });
      return {
        percent,
        dueNowCents: first.amountCents,
        balanceCents: quote.totalPriceCents - first.amountCents,
      };
    });

    res.json({
      available,
      quote: {
        ...quote,
        checkIn: checkIn,
        checkOut: checkOut,
      },
      schedule: schedule.map((p) => ({
        kind: p.kind,
        amountCents: p.amountCents,
        dueDate: p.dueDate,
      })),
      dueNowCents: schedule[0].amountCents,
      depositChoice: {
        available: choices.choiceAvailable,
        selected: chosen ?? property.depositPercent ?? 100,
        balanceDueDate: choices.balanceDueDate,
        options: depositOptions,
      },
      ...(available
        ? {}
        : {
            message:
              'Those nights are no longer open. Try shifting your dates by a day or two.',
          }),
    });
  })
);

/**
 * POST /api/bookings
 * Creates a pending booking (race-safe) and returns the Stripe Checkout URL.
 * Nothing is confirmed here — only the webhook can do that.
 */
router.post(
  '/',
  bookingLimiter,
  validate({
    body: z
      .object({
        ...stayShape,
        depositPercent: depositChoice,
        guestName: safeText(120).pipe(z.string().min(2, 'Please tell us your name')),
        guestEmail: emailSchema,
        guestPhone: optionalText(40),
        message: optionalText(2000),
        acceptedTerms: z.literal(true, {
          errorMap: () => ({ message: 'Please accept the booking terms to continue.' }),
        }),
      })
      .strict(),
  }),
  asyncHandler(async (req, res) => {
    const { booking, quote, checkoutUrl, dueNowCents } = await createPendingBooking({
      propertyId: req.body.propertyId,
      guestName: req.body.guestName,
      guestEmail: req.body.guestEmail,
      guestPhone: req.body.guestPhone,
      guests: req.body.guests,
      message: req.body.message,
      checkIn: req.body.checkIn,
      checkOut: req.body.checkOut,
      depositPercent: req.body.depositPercent,
      discountCode: req.body.discountCode,
    });

    if (!checkoutUrl) {
      throw conflict('We could not open the payment page. Please try again.');
    }

    res.status(201).json({
      bookingId: booking._id.toString(),
      checkoutUrl,
      expiresAt: booking.holdExpiresAt,
      dueNowCents,
      quote,
    });
  })
);

/**
 * GET /api/bookings/manage/:token
 *
 * The guest portal payload. Token-based, no login: the stored value is a hash,
 * so we hash the incoming token and look that up — the raw token exists only in
 * the guest's inbox.
 *
 * Arrival details (gate code, wifi, directions) are gated server-side by
 * `arrivalInfoIsReleased`. The client is told *whether* they are available and
 * why not, but never receives them early.
 */
router.get(
  '/manage/:token',
  manageLimiter,
  validate({ params: z.object({ token: z.string().max(128) }) }),
  asyncHandler(async (req, res) => {
    const booking = await findBookingByToken(req.params.token);
    const property = booking.propertyId;

    const arrival = arrivalInfoStatus({ booking, property });
    const refundIfCancelledNow = computeRefundCents(booking);

    res.set('Cache-Control', 'no-store, private');
    res.json({
      booking: booking.toGuestJSON({ includeArrivalInfo: arrival.released }),
      arrival,
      agreement: {
        required: property?.rentalAgreement?.requireAcceptance ?? false,
        version: property?.rentalAgreement?.version ?? 1,
        title: property?.rentalAgreement?.title ?? 'Rental Agreement',
        body: property?.rentalAgreement?.body ?? '',
        accepted: Boolean(booking.agreement?.acceptedAt),
        acceptedAt: booking.agreement?.acceptedAt ?? null,
        signatureName: booking.agreement?.signatureName ?? '',
      },
      cancellation: {
        refundIfCancelledNowCents: refundIfCancelledNow,
        canCancel: booking.status !== BOOKING_STATUS.CANCELLED,
        policy: property?.cancellationPolicy ?? '',
      },
    });
  })
);

/**
 * POST /api/bookings/manage/:token/agreement
 * Typed-name acceptance of the rental agreement, recorded with the version the
 * guest actually saw.
 */
router.post(
  '/manage/:token/agreement',
  manageLimiter,
  validate({
    params: z.object({ token: z.string().max(128) }),
    body: z
      .object({
        signatureName: safeText(120).pipe(z.string().min(2, 'Please type your full name')),
        agreementVersion: z.number().int().min(1).max(10_000),
      })
      .strict(),
  }),
  asyncHandler(async (req, res) => {
    const booking = await findBookingByToken(req.params.token);
    const property = booking.propertyId;

    if (booking.status === BOOKING_STATUS.CANCELLED) {
      throw conflict('This booking has been cancelled.');
    }

    // The version the guest signed must be the version currently published,
    // otherwise they are agreeing to text they were never shown.
    const current = property?.rentalAgreement?.version ?? 1;
    if (req.body.agreementVersion !== current) {
      throw conflict(
        'The rental agreement has been updated. Please reload the page and read it again before signing.',
        undefined,
        'AGREEMENT_CHANGED'
      );
    }

    await acceptRentalAgreement({
      booking,
      property,
      signatureName: req.body.signatureName,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    const arrival = arrivalInfoStatus({ booking, property });

    res.json({
      booking: booking.toGuestJSON({ includeArrivalInfo: arrival.released }),
      arrival,
      message: 'Thank you — your agreement is signed.',
    });
  })
);

/**
 * POST /api/bookings/manage/:token/pay
 * Opens a Stripe Checkout Session for whatever is still owed.
 */
router.post(
  '/manage/:token/pay',
  manageLimiter,
  validate({
    params: z.object({ token: z.string().max(128) }),
    body: z.object({}).strict(),
  }),
  asyncHandler(async (req, res) => {
    const booking = await findBookingByToken(req.params.token);

    const { checkoutUrl, payment } = await createBalancePayment({
      booking,
      property: booking.propertyId,
      manageToken: req.params.token,
    });

    if (!checkoutUrl) throw conflict('We could not open the payment page. Please try again.');

    res.json({
      checkoutUrl,
      amountCents: payment.amountCents,
      kind: payment.kind,
    });
  })
);

/**
 * POST /api/bookings/manage/:token/cancel
 * Guest-initiated cancellation, refunded per the property's policy.
 */
router.post(
  '/manage/:token/cancel',
  manageLimiter,
  validate({
    params: z.object({ token: z.string().max(128) }),
    body: z.object({ reason: optionalText(1000) }).strict(),
  }),
  asyncHandler(async (req, res) => {
    const existing = await findBookingByToken(req.params.token);

    if (existing.status === BOOKING_STATUS.CANCELLED) {
      throw conflict('This booking has already been cancelled.', undefined, 'ALREADY_CANCELLED');
    }

    const { booking, refundCents } = await cancelBooking({
      bookingId: existing._id,
      cancelledBy: 'guest',
      reason: req.body.reason,
    });

    res.json({
      booking: booking.toGuestJSON(),
      refundCents,
      message:
        refundCents > 0
          ? 'Your booking is cancelled and your refund is on its way.'
          : 'Your booking is cancelled.',
    });
  })
);

async function findBookingByToken(token) {
  if (!looksLikeToken(token)) throw notFound('That link is no longer valid.');

  // Full property document: the portal needs the agreement text, arrival info
  // and release policy, and the release decision is made here on the server.
  const booking = await Booking.findOne({ cancellationToken: hashToken(token) }).populate(
    'propertyId'
  );

  if (!booking) throw notFound('That link is no longer valid.');
  return booking;
}

/**
 * GET /api/bookings/session/:sessionId
 * Read-only lookup for the confirmation page. It reports whatever the webhook
 * has already recorded — the page never gets to *declare* a booking paid.
 */
router.get(
  '/session/:sessionId',
  sessionLookupLimiter,
  validate({
    params: z.object({ sessionId: z.string().trim().max(200).regex(/^cs_[A-Za-z0-9_]+$/) }),
  }),
  asyncHandler(async (req, res) => {
    const booking = await Booking.findOne({ stripeSessionId: req.params.sessionId }).populate(
      'propertyId',
      'name slug checkInTime checkOutTime whatsappNumber'
    );

    if (!booking) throw notFound('We could not find that booking.');

    res.set('Cache-Control', 'no-store');
    res.json({
      booking: booking.toGuestJSON(),
      // The webhook may still be in flight a second after redirect — tell the
      // client to poll rather than to assume failure.
      settled: booking.status !== BOOKING_STATUS.PENDING,
    });
  })
);

export default router;
