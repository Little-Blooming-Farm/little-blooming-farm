import express from 'express';
import mongoose from 'mongoose';

import { Property } from '../models/Property.js';
import { getUnavailability } from '../lib/availability.js';
import { asyncHandler, notFound } from '../lib/errors.js';
import { addDays, formatDateOnly, parseDateOnly, todayAtProperty } from '../lib/dates.js';
import { buildPropertyCalendar } from '../services/icalService.js';
import { dateOnly, validate, z } from '../middleware/validate.js';
import env from '../config/env.js';

const router = express.Router();

/** Accept either a Mongo id or a slug in the URL — both are stable references. */
async function resolveProperty(identifier) {
  const query = mongoose.isValidObjectId(identifier)
    ? { _id: identifier }
    : { slug: String(identifier).toLowerCase() };

  const property = await Property.findOne({ ...query, isActive: true });
  if (!property) throw notFound('We could not find that home.');
  return property;
}

/** GET /api/properties — the homes, in display order. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const properties = await Property.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });
    res.json({ properties: properties.map((p) => p.toPublicJSON()) });
  })
);

/** GET /api/properties/:identifier — one home, by slug or id. */
router.get(
  '/:identifier',
  validate({ params: z.object({ identifier: z.string().trim().max(80) }) }),
  asyncHandler(async (req, res) => {
    const property = await resolveProperty(req.params.identifier);
    res.json({ property: property.toPublicJSON() });
  })
);

/**
 * GET /api/properties/:identifier/availability?from=&to=
 * Anonymised: the response says which nights are taken, never by whom.
 */
router.get(
  '/:identifier/availability',
  validate({
    params: z.object({ identifier: z.string().trim().max(80) }),
    query: z.object({ from: dateOnly.optional(), to: dateOnly.optional() }),
  }),
  asyncHandler(async (req, res) => {
    const property = await resolveProperty(req.params.identifier);
    const { from, to } = req.validatedQuery ?? {};

    const today = todayAtProperty();
    const start = (from && parseDateOnly(from)) || today;
    const requestedEnd = (to && parseDateOnly(to)) || addDays(today, env.MAX_ADVANCE_DAYS);

    // Bound the window so one request cannot ask for a decade of calendar.
    const maxEnd = addDays(start, 400);
    const end = requestedEnd > maxEnd ? maxEnd : requestedEnd;

    const availability = await getUnavailability(property._id, start, end);

    res.set('Cache-Control', 'public, max-age=60');
    res.json({
      propertyId: property._id.toString(),
      slug: property.slug,
      minNights: property.minNights,
      maxNights: property.maxNights,
      maxGuests: property.maxGuests,
      basePriceCents: property.basePriceCents,
      cleaningFeeCents: property.cleaningFeeCents,
      currency: env.STRIPE_CURRENCY,
      today: formatDateOnly(today),
      bookableUntil: formatDateOnly(addDays(today, env.MAX_ADVANCE_DAYS)),
      ...availability,
    });
  })
);

/**
 * GET /api/properties/:identifier/calendar.ics
 * The outbound feed Airbnb and VRBO subscribe to. Unauthenticated by necessity
 * — OTAs fetch it anonymously — which is why it contains no guest data.
 */
router.get(
  '/:identifier/calendar.ics',
  validate({ params: z.object({ identifier: z.string().trim().max(80) }) }),
  asyncHandler(async (req, res) => {
    const property = await resolveProperty(req.params.identifier);
    const calendar = await buildPropertyCalendar(property);

    res.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${property.slug}.ics"`,
      'Cache-Control': 'public, max-age=900',
      'X-Robots-Tag': 'noindex',
    });
    res.send(calendar.toString());
  })
);

export default router;
