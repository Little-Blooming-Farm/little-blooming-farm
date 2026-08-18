import express from 'express';

import { Experience } from '../../models/Experience.js';
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

const bodySchema = z.object({
  title: safeText(120),
  slug: slugSchema,
  shortDescription: optionalText(400),
  description: optionalText(6000),
  image: z
    .object({
      url: mediaUrl(1000).or(z.literal('')),
      publicId: z.string().max(300).optional().default(''),
      alt: optionalText(300),
    })
    .optional(),
  category: z.enum(['animals', 'garden', 'gathering', 'kids', 'seasonal', 'quiet']).optional(),
  season: optionalText(120),
  duration: optionalText(80),

  // Dormant until the owner decides to sell add-ons.
  isBookable: z.boolean().optional(),
  priceCents: z.number().int().min(0).max(1_000_000).optional(),
  maxParticipants: z.number().int().min(0).max(200).optional(),
  requiresAdvanceNotice: z.boolean().optional(),
  advanceNoticeHours: z.number().int().min(0).max(720).optional(),

  order: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
});

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const experiences = await Experience.find().sort({ order: 1, title: 1 }).lean();
    res.set('Cache-Control', 'no-store');
    res.json({ experiences });
  })
);

router.post(
  '/',
  validate({ body: bodySchema.strict() }),
  asyncHandler(async (req, res) => {
    const experience = await Experience.create(req.body);
    res.status(201).json({ experience: experience.toObject() });
  })
);

router.patch(
  '/:id',
  validate({ params: z.object({ id: objectId }), body: bodySchema.partial().strict() }),
  asyncHandler(async (req, res) => {
    const experience = await Experience.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!experience) throw notFound('That experience no longer exists.');
    res.json({ experience: experience.toObject() });
  })
);

router.delete(
  '/:id',
  validate({ params: z.object({ id: objectId }) }),
  asyncHandler(async (req, res) => {
    const experience = await Experience.findByIdAndDelete(req.params.id);
    if (!experience) throw notFound('That experience no longer exists.');
    res.json({ ok: true });
  })
);

export default router;
