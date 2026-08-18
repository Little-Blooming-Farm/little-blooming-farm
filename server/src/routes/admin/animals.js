import express from 'express';

import { Animal } from '../../models/Animal.js';
import { asyncHandler, notFound } from '../../lib/errors.js';
import {
  mediaUrl,
  objectId,
  optionalText,
  safeText,
  slug as slugSchema,
  validate,
  z,
} from '../../middleware/validate.js';

const router = express.Router();

const imageSchema = z.object({
  url: mediaUrl(1000).or(z.literal('')),
  publicId: z.string().max(300).optional().default(''),
  alt: optionalText(300),
});

const bodySchema = z.object({
  name: safeText(80),
  slug: slugSchema,
  species: optionalText(80),
  title: optionalText(120),
  photo: imageSchema.optional(),
  gallery: z.array(imageSchema).max(20).optional(),
  bio: optionalText(6000),
  funFacts: z.array(safeText(300)).max(12).optional(),
  order: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
});

/** GET /api/admin/animals — including hidden profiles. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const animals = await Animal.find().sort({ order: 1, name: 1 }).lean();
    res.set('Cache-Control', 'no-store');
    res.json({ animals });
  })
);

router.post(
  '/',
  validate({ body: bodySchema.strict() }),
  asyncHandler(async (req, res) => {
    const animal = await Animal.create(req.body);
    res.status(201).json({ animal: animal.toObject() });
  })
);

router.patch(
  '/:id',
  validate({ params: z.object({ id: objectId }), body: bodySchema.partial().strict() }),
  asyncHandler(async (req, res) => {
    const animal = await Animal.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!animal) throw notFound('That profile no longer exists.');
    res.json({ animal: animal.toObject() });
  })
);

router.delete(
  '/:id',
  validate({ params: z.object({ id: objectId }) }),
  asyncHandler(async (req, res) => {
    const animal = await Animal.findByIdAndDelete(req.params.id);
    if (!animal) throw notFound('That profile no longer exists.');
    res.json({ ok: true });
  })
);

/** POST /api/admin/animals/reorder — persist a drag-and-drop ordering. */
router.post(
  '/reorder',
  validate({
    body: z
      .object({
        order: z.array(z.object({ id: objectId, order: z.number().int().min(0).max(999) })).max(200),
      })
      .strict(),
  }),
  asyncHandler(async (req, res) => {
    await Animal.bulkWrite(
      req.body.order.map(({ id, order }) => ({
        updateOne: { filter: { _id: id }, update: { $set: { order } } },
      })),
      { ordered: false }
    );
    res.json({ ok: true });
  })
);

export default router;
