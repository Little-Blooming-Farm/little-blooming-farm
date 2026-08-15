import express from 'express';

import env from '../../config/env.js';
import { Booking, BOOKING_STATUS } from '../../models/Booking.js';
import { Property } from '../../models/Property.js';
import { asyncHandler, badRequest, notFound } from '../../lib/errors.js';
import { computeRefundCents } from '../../lib/pricing.js';
import { parseDateOnly } from '../../lib/dates.js';
import { generateManageToken } from '../../lib/tokens.js';
import { sendBookingConfirmation } from '../../lib/email.js';
import { cancelBooking } from '../../services/bookingService.js';
import {
  dateOnly,
  intParam,
  objectId,
  optionalText,
  validate,
  z,
} from '../../middleware/validate.js';

const router = express.Router();

/**
 * GET /api/admin/bookings
 * Filterable by property, status and date window, with an email/name search.
 */
router.get(
  '/',
  validate({
    query: z.object({
      propertyId: objectId.optional(),
      status: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
      from: dateOnly.optional(),
      to: dateOnly.optional(),
      q: z.string().trim().max(120).optional(),
      page: intParam(1, 1000, 1),
      limit: intParam(1, 100, 25),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { propertyId, status, from, to, q, page, limit } = req.validatedQuery;

    const filter = {};
    if (propertyId) filter.propertyId = propertyId;
    if (status) filter.status = status;

    // Window semantics: any stay that touches the requested range.
    if (from) filter.checkOut = { $gte: parseDateOnly(from) };
    if (to) filter.checkIn = { $lte: parseDateOnly(to) };

    if (q) {
      // Escaped — a guest search must never be able to inject a regex bomb.
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(safe, 'i');
      filter.$or = [{ guestName: rx }, { guestEmail: rx }, { guestPhone: rx }];
    }

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate('propertyId', 'name slug')
        .sort({ checkIn: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Booking.countDocuments(filter),
    ]);

    res.set('Cache-Control', 'no-store');
    res.json({
      bookings,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  })
);

/** GET /api/admin/bookings/:id */
router.get(
  '/:id',
  validate({ params: z.object({ id: objectId }) }),
  asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id).populate('propertyId');
    if (!booking) throw notFound('Booking not found.');

    res.set('Cache-Control', 'no-store');
    res.json({
      booking: booking.toObject(),
      refundIfCancelledNowCents: computeRefundCents(booking),
    });
  })
);

/** PATCH /api/admin/bookings/:id — contact corrections and internal notes only. */
router.patch(
  '/:id',
  validate({
    params: z.object({ id: objectId }),
    body: z
      .object({
        guestPhone: optionalText(40).optional(),
        adminNotes: optionalText(4000).optional(),
      })
      .strict(),
  }),
  asyncHandler(async (req, res) => {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!booking) throw notFound('Booking not found.');
    res.json({ booking: booking.toObject() });
  })
);

/**
 * POST /api/admin/bookings/:id/cancel
 * `refundCents` overrides the policy calculation — for goodwill refunds, or
 * when the owner cancels and wants to make the guest whole.
 */
router.post(
  '/:id/cancel',
  validate({
    params: z.object({ id: objectId }),
    body: z
      .object({
        reason: optionalText(1000),
        refundCents: z.number().int().min(0).max(10_000_000).optional(),
      })
      .strict(),
  }),
  asyncHandler(async (req, res) => {
    const existing = await Booking.findById(req.params.id).lean();
    if (!existing) throw notFound('Booking not found.');

    if (req.body.refundCents != null) {
      const alreadyRefunded = existing.amountRefundedCents ?? 0;
      if (req.body.refundCents > existing.totalPriceCents - alreadyRefunded) {
        throw badRequest('A refund cannot exceed the amount still held for this booking.');
      }
    }

    const { booking, refundCents } = await cancelBooking({
      bookingId: req.params.id,
      cancelledBy: 'admin',
      reason: req.body.reason,
      refundOverrideCents: req.body.refundCents,
    });

    res.json({ booking: booking.toObject(), refundCents });
  })
);

/**
 * POST /api/admin/bookings/:id/resend-confirmation
 * Issues a *new* manage token and emails a fresh link. The old link stops
 * working, which is the point: we store only hashes, so a lost link can be
 * replaced but never recovered.
 */
router.post(
  '/:id/resend-confirmation',
  validate({ params: z.object({ id: objectId }) }),
  asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id);
    if (!booking) throw notFound('Booking not found.');
    if (booking.status !== BOOKING_STATUS.CONFIRMED) {
      throw badRequest('Only confirmed bookings have a confirmation to resend.');
    }

    const property = await Property.findById(booking.propertyId);
    const { raw, hash } = generateManageToken();

    booking.cancellationToken = hash;
    booking.confirmationEmailSentAt = new Date();
    await booking.save();

    await sendBookingConfirmation({
      booking,
      property,
      manageUrl: `${env.CLIENT_URL}/booking/manage/${raw}`,
    });

    res.json({ ok: true, sentTo: booking.guestEmail });
  })
);

export default router;
