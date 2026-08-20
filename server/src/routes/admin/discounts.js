import express from 'express';

import Discount from '../../models/Discount.js';
import { Booking } from '../../models/Booking.js';
import { asyncHandler, badRequest, notFound } from '../../lib/errors.js';
import { objectId, optionalText, safeText, validate, z } from '../../middleware/validate.js';

const router = express.Router();

/**
 * Letters, digits and dashes only. A code with a space or a slash in it breaks
 * when someone types it off a card, and a code with a `$` in it invites the
 * question of whether the sanitizer let something through.
 */
const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3, 'A code needs at least 3 characters')
  .max(40)
  .regex(/^[A-Z0-9-]+$/, 'Use letters, numbers and dashes only');

const baseShape = {
  code: codeSchema,
  label: optionalText(120),
  kind: z.enum(['percent', 'fixed']),
  value: z.number().int().min(1),
  isActive: z.boolean().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  maxRedemptions: z.number().int().min(1).max(100000).nullable().optional(),
  propertyIds: z.array(objectId).max(20).optional(),
  minNights: z.number().int().min(1).max(365).nullable().optional(),
  minSubtotalCents: z.number().int().min(0).max(100000000).nullable().optional(),
  notes: optionalText(500),
};

/**
 * A percentage over 100 would pay the guest to stay. Checked here as well as in
 * the model so the admin gets a field-level message rather than a 500.
 */
function assertValueFitsKind({ kind, value }) {
  if (kind === 'percent' && value > 100) {
    throw badRequest('A percentage discount cannot exceed 100%.', [
      { field: 'value', message: 'Must be between 1 and 100' },
    ]);
  }
}

/** GET /api/admin/discounts */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const discounts = await Discount.find().sort({ createdAt: -1 });

    /**
     * How many bookings actually used each code, counted from the bookings
     * themselves rather than from `timesRedeemed`. The two differ on purpose:
     * the counter also holds redemptions claimed by holds that have not been
     * paid yet, and the owner wants to see real bookings.
     */
    const used = await Booking.aggregate([
      { $match: { discountCode: { $nin: ['', null] }, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$discountCode', bookings: { $sum: 1 }, savedCents: { $sum: '$discountCents' } } },
    ]);
    const byCode = new Map(used.map((u) => [u._id, u]));

    res.json({
      discounts: discounts.map((d) => ({
        ...d.toAdminJSON(),
        bookingsUsed: byCode.get(d.code)?.bookings ?? 0,
        guestsSavedCents: byCode.get(d.code)?.savedCents ?? 0,
      })),
    });
  })
);

/** POST /api/admin/discounts */
router.post(
  '/',
  validate({ body: z.object(baseShape).strict() }),
  asyncHandler(async (req, res) => {
    assertValueFitsKind(req.body);

    const existing = await Discount.findOne({ code: req.body.code });
    if (existing) {
      throw badRequest(`The code ${req.body.code} already exists.`, [
        { field: 'code', message: 'Already in use' },
      ]);
    }

    const discount = await Discount.create(req.body);
    res.status(201).json({ discount: discount.toAdminJSON() });
  })
);

/** PATCH /api/admin/discounts/:id */
router.patch(
  '/:id',
  validate({
    params: z.object({ id: objectId }),
    body: z.object(baseShape).partial().strict(),
  }),
  asyncHandler(async (req, res) => {
    const discount = await Discount.findById(req.params.id);
    if (!discount) throw notFound('That discount no longer exists.');

    assertValueFitsKind({
      kind: req.body.kind ?? discount.kind,
      value: req.body.value ?? discount.value,
    });

    if (req.body.code && req.body.code !== discount.code) {
      const clash = await Discount.findOne({ code: req.body.code, _id: { $ne: discount._id } });
      if (clash) {
        throw badRequest(`The code ${req.body.code} already exists.`, [
          { field: 'code', message: 'Already in use' },
        ]);
      }
    }

    /**
     * `timesRedeemed` is deliberately not editable. It is the counter the
     * booking path increments atomically, and letting it be overwritten from a
     * form would reintroduce exactly the race the atomic claim exists to
     * prevent. To give redemptions back, raise `maxRedemptions`.
     */
    Object.assign(discount, req.body);
    await discount.save();

    res.json({ discount: discount.toAdminJSON() });
  })
);

/** DELETE /api/admin/discounts/:id */
router.delete(
  '/:id',
  validate({ params: z.object({ id: objectId }) }),
  asyncHandler(async (req, res) => {
    const discount = await Discount.findById(req.params.id);
    if (!discount) throw notFound('That discount no longer exists.');

    /**
     * Bookings keep the code as text, so deleting one never rewrites what a
     * guest was charged. Deactivating is still the better move for a code that
     * has been used — the admin list can then show its history — so a used code
     * has to be deactivated first, which makes the destructive choice explicit.
     */
    const usedBy = await Booking.countDocuments({ discountCode: discount.code });
    if (usedBy > 0 && discount.isActive) {
      throw badRequest(
        `${discount.code} has been used by ${usedBy} booking${usedBy === 1 ? '' : 's'}. ` +
          'Turn it off first if you want to stop new bookings using it, then delete it.',
        undefined,
        'DISCOUNT_IN_USE'
      );
    }

    await discount.deleteOne();
    res.json({ deleted: true, code: discount.code, bookingsAffected: usedBy });
  })
);

export default router;
