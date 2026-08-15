import express from 'express';

import { BlockedDate, BLOCK_SOURCE } from '../../models/BlockedDate.js';
import { Booking } from '../../models/Booking.js';
import { asyncHandler, badRequest, conflict, notFound } from '../../lib/errors.js';
import { bookingOverlapFilter } from '../../lib/availability.js';
import { addDays, parseDateOnly, todayAtProperty } from '../../lib/dates.js';
import { propertyLockKey, withLock } from '../../lib/lock.js';
import { dateOnly, objectId, optionalText, validate, z } from '../../middleware/validate.js';

const router = express.Router();

/** GET /api/admin/blocked-dates?propertyId=&from=&to= */
router.get(
  '/',
  validate({
    query: z.object({
      propertyId: objectId.optional(),
      from: dateOnly.optional(),
      to: dateOnly.optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { propertyId, from, to } = req.validatedQuery;

    const start = from ? parseDateOnly(from) : addDays(todayAtProperty(), -30);
    const end = to ? parseDateOnly(to) : addDays(todayAtProperty(), 420);

    const filter = { startDate: { $lt: end }, endDate: { $gt: start } };
    if (propertyId) filter.propertyId = propertyId;

    const blocks = await BlockedDate.find(filter)
      .populate('propertyId', 'name slug')
      .sort({ startDate: 1 })
      .lean();

    res.set('Cache-Control', 'no-store');
    res.json({ blocks });
  })
);

/**
 * POST /api/admin/blocked-dates — a manual hold.
 *
 * Takes the same per-property lock the booking path uses, so an owner blocking
 * dates and a guest paying for them cannot both succeed on the same nights.
 * `force` exists because sometimes the owner genuinely needs the house back and
 * will handle the guest personally — but it has to be deliberate.
 */
router.post(
  '/',
  validate({
    body: z
      .object({
        propertyId: objectId,
        startDate: dateOnly,
        endDate: dateOnly,
        reason: optionalText(300),
        force: z.boolean().optional().default(false),
      })
      .strict(),
  }),
  asyncHandler(async (req, res) => {
    const { propertyId, startDate, endDate, reason, force } = req.body;

    const start = parseDateOnly(startDate);
    const end = parseDateOnly(endDate);
    if (!start || !end || end <= start) {
      throw badRequest('The block must end at least one day after it starts.');
    }

    const block = await withLock(propertyLockKey(propertyId), async () => {
      if (!force) {
        const clashing = await Booking.find(bookingOverlapFilter(propertyId, start, end))
          .select('_id guestName checkIn checkOut status')
          .lean();

        if (clashing.length > 0) {
          throw conflict(
            'There are live bookings on those nights. Cancel them first, or re-send with force to block anyway.',
            { bookings: clashing },
            'BOOKINGS_IN_RANGE'
          );
        }
      }

      // `externalUid` is deliberately omitted, not set to null — the unique
      // index only covers rows where it is a string.
      return BlockedDate.create({
        propertyId,
        startDate: start,
        endDate: end,
        source: BLOCK_SOURCE.MANUAL,
        reason: reason || 'Blocked by the owner',
        createdBy: req.admin._id,
      });
    });

    res.status(201).json({ block });
  })
);

/** PATCH /api/admin/blocked-dates/:id — manual blocks only. */
router.patch(
  '/:id',
  validate({
    params: z.object({ id: objectId }),
    body: z
      .object({
        startDate: dateOnly.optional(),
        endDate: dateOnly.optional(),
        reason: optionalText(300).optional(),
      })
      .strict(),
  }),
  asyncHandler(async (req, res) => {
    const block = await BlockedDate.findById(req.params.id);
    if (!block) throw notFound('That block no longer exists.');

    if (block.source !== BLOCK_SOURCE.MANUAL) {
      throw badRequest(
        'Blocks imported from Airbnb or VRBO are managed there — the next sync would overwrite any change made here.'
      );
    }

    if (req.body.startDate) block.startDate = parseDateOnly(req.body.startDate);
    if (req.body.endDate) block.endDate = parseDateOnly(req.body.endDate);
    if (req.body.reason !== undefined) block.reason = req.body.reason;

    if (block.endDate <= block.startDate) {
      throw badRequest('The block must end at least one day after it starts.');
    }

    await block.save();
    res.json({ block });
  })
);

/**
 * DELETE /api/admin/blocked-dates/:id
 * Removing an OTA-sourced block is allowed but pointless — the next sync pass
 * restores it — so we say so instead of silently letting it reappear.
 */
router.delete(
  '/:id',
  validate({ params: z.object({ id: objectId }) }),
  asyncHandler(async (req, res) => {
    const block = await BlockedDate.findById(req.params.id);
    if (!block) throw notFound('That block no longer exists.');

    if (block.source !== BLOCK_SOURCE.MANUAL) {
      throw badRequest(
        `This block came from ${block.source}. Remove it there — deleting it here only lasts until the next sync.`
      );
    }

    await block.deleteOne();
    res.json({ ok: true });
  })
);

export default router;
