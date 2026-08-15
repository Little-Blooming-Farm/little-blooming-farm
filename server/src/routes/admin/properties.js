import express from 'express';

import { Property } from '../../models/Property.js';
import { asyncHandler, notFound } from '../../lib/errors.js';
import { assertSafeFeedUrl, syncPropertyCalendars } from '../../services/icalService.js';
import { objectId, optionalText, safeText, validate, z } from '../../middleware/validate.js';

const router = express.Router();

const photoSchema = z.object({
  url: z.string().url().max(1000),
  publicId: z.string().max(300).optional().default(''),
  alt: optionalText(300),
  caption: optionalText(300),
  width: z.number().int().min(0).max(20000).optional(),
  height: z.number().int().min(0).max(20000).optional(),
  order: z.number().int().min(0).max(999).optional().default(0),
});

const updateSchema = z
  .object({
    name: safeText(120).optional(),
    tagline: optionalText(200).optional(),
    shortDescription: optionalText(500).optional(),
    description: optionalText(8000).optional(),

    maxGuests: z.number().int().min(1).max(40).optional(),
    bedrooms: z.number().int().min(0).max(30).optional(),
    bathrooms: z.number().min(0).max(30).optional(),
    beds: z.number().int().min(0).max(60).optional(),

    basePriceCents: z.number().int().min(0).max(10_000_000).optional(),
    cleaningFeeCents: z.number().int().min(0).max(10_000_000).optional(),

    minNights: z.number().int().min(1).max(30).optional(),
    maxNights: z.number().int().min(1).max(365).optional(),
    checkInTime: safeText(40).optional(),
    checkOutTime: safeText(40).optional(),

    photos: z.array(photoSchema).max(80).optional(),
    amenities: z.array(safeText(80)).max(100).optional(),

    airbnbIcalUrl: z.union([z.string().url().max(1000), z.literal('')]).optional(),
    vrboIcalUrl: z.union([z.string().url().max(1000), z.literal('')]).optional(),

    whatsappNumber: optionalText(32).optional(),
    cancellationPolicy: optionalText(3000).optional(),
    houseRules: z.array(safeText(240)).max(40).optional(),

    isActive: z.boolean().optional(),
    displayOrder: z.number().int().min(0).max(999).optional(),

    // --- Payment schedule ---------------------------------------------------
    depositPercent: z.number().int().min(1).max(100).optional(),
    balanceDueDays: z.number().int().min(0).max(365).optional(),
    depositOptions: z.array(z.number().int().min(1).max(99)).max(6).optional(),

    // --- Rental agreement ---------------------------------------------------
    rentalAgreement: z
      .object({
        title: safeText(200).optional(),
        body: optionalText(40000).optional(),
        requireAcceptance: z.boolean().optional(),
      })
      .strict()
      .optional(),

    // --- Arrival information ------------------------------------------------
    address: optionalText(300).optional(),
    arrivalInfoReleaseDays: z.number().int().min(0).max(90).optional(),
    arrivalInfo: z
      .object({
        gateCode: optionalText(40).optional(),
        doorCode: optionalText(40).optional(),
        wifiNetwork: optionalText(80).optional(),
        wifiPassword: optionalText(80).optional(),
        directions: optionalText(4000).optional(),
        parking: optionalText(2000).optional(),
        checkInInstructions: optionalText(4000).optional(),
        checkOutInstructions: optionalText(4000).optional(),
        emergencyContact: optionalText(200).optional(),
        houseManual: z
          .array(z.object({ title: safeText(120), body: optionalText(4000) }).strict())
          .max(30)
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

/** GET /api/admin/properties — includes inactive homes and private iCal URLs. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const properties = await Property.find().sort({ displayOrder: 1, name: 1 }).lean();
    res.set('Cache-Control', 'no-store');
    res.json({ properties });
  })
);

router.get(
  '/:id',
  validate({ params: z.object({ id: objectId }) }),
  asyncHandler(async (req, res) => {
    const property = await Property.findById(req.params.id).lean();
    if (!property) throw notFound('Property not found.');
    res.set('Cache-Control', 'no-store');
    res.json({ property });
  })
);

/** PATCH /api/admin/properties/:id */
router.patch(
  '/:id',
  validate({ params: z.object({ id: objectId }), body: updateSchema }),
  asyncHandler(async (req, res) => {
    const updates = { ...req.body };

    // A feed URL is fetched server-side, so validate it before we ever store it.
    for (const field of ['airbnbIcalUrl', 'vrboIcalUrl']) {
      if (updates[field]) updates[field] = await assertSafeFeedUrl(updates[field]);
    }

    if (updates.photos) {
      updates.photos = updates.photos.map((p, index) => ({ ...p, order: p.order ?? index }));
    }

    /**
     * Editing the agreement bumps its version, which invalidates signatures
     * already collected against the old text — guests are asked to re-sign
     * rather than being silently bound to terms they never read.
     */
    if (updates.rentalAgreement) {
      const existing = await Property.findById(req.params.id).select('rentalAgreement').lean();
      const textChanged =
        updates.rentalAgreement.body !== undefined &&
        updates.rentalAgreement.body !== existing?.rentalAgreement?.body;

      updates.rentalAgreement = {
        ...existing?.rentalAgreement,
        ...updates.rentalAgreement,
        version: (existing?.rentalAgreement?.version ?? 1) + (textChanged ? 1 : 0),
        updatedAt: new Date(),
      };
    }

    // Merge arrival info so a partial save cannot blank the gate code.
    if (updates.arrivalInfo) {
      const existing = await Property.findById(req.params.id).select('arrivalInfo').lean();
      updates.arrivalInfo = { ...existing?.arrivalInfo, ...updates.arrivalInfo };
    }

    const property = await Property.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!property) throw notFound('Property not found.');

    res.json({ property });
  })
);

/** POST /api/admin/properties/:id/sync-ical — run the OTA sync on demand. */
router.post(
  '/:id/sync-ical',
  validate({ params: z.object({ id: objectId }) }),
  asyncHandler(async (req, res) => {
    const property = await Property.findById(req.params.id);
    if (!property) throw notFound('Property not found.');

    const result = await syncPropertyCalendars(property._id);
    res.json({ result });
  })
);

export default router;
