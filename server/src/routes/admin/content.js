import express from 'express';

import { BLOCK_TYPES, ContentPage } from '../../models/ContentPage.js';
import { asyncHandler, badRequest, notFound } from '../../lib/errors.js';
import {
  optionalText,
  safeText,
  slug as slugSchema,
  validate,
  z,
} from '../../middleware/validate.js';

const router = express.Router();

const MAX_SECTION_BYTES = 60_000;

/**
 * Section content is intentionally open-ended — the whole point is that the
 * owner can restructure a page without a deploy. It is bounded by size and by
 * a known block `type`, and it is only ever reachable behind admin auth.
 */
const sectionSchema = z.object({
  type: z.enum(BLOCK_TYPES),
  order: z.number().int().min(0).max(999).optional().default(0),
  content: z
    .record(z.any())
    .refine((c) => JSON.stringify(c).length <= MAX_SECTION_BYTES, {
      message: 'This section is too large — split it into two.',
    })
    .optional()
    .default({}),
});

const pageSchema = z.object({
  slug: slugSchema,
  title: safeText(200),
  subtitle: optionalText(400),
  seo: z
    .object({
      title: optionalText(200),
      description: optionalText(400),
      image: z.string().max(1000).optional().default(''),
    })
    .optional(),
  heroImage: z.string().max(1000).optional(),
  heroVideo: z.string().max(1000).optional(),
  sections: z.array(sectionSchema).max(60).optional(),
  isPublished: z.boolean().optional(),
});

/** GET /api/admin/content/pages */
router.get(
  '/pages',
  asyncHandler(async (_req, res) => {
    const pages = await ContentPage.find()
      .select('slug title subtitle isPublished updatedAt')
      .sort({ slug: 1 })
      .lean();
    res.set('Cache-Control', 'no-store');
    res.json({ pages });
  })
);

/** GET /api/admin/content/pages/:slug — full document, including drafts. */
router.get(
  '/pages/:slug',
  validate({ params: z.object({ slug: slugSchema }) }),
  asyncHandler(async (req, res) => {
    const page = await ContentPage.findOne({ slug: req.params.slug }).lean();
    if (!page) throw notFound('That page does not exist yet.');
    res.set('Cache-Control', 'no-store');
    res.json({ page });
  })
);

/** POST /api/admin/content/pages — create a new editable page. */
router.post(
  '/pages',
  validate({ body: pageSchema.strict() }),
  asyncHandler(async (req, res) => {
    const existing = await ContentPage.findOne({ slug: req.body.slug }).lean();
    if (existing) throw badRequest('A page with that address already exists.');

    const page = await ContentPage.create({ ...req.body, updatedBy: req.admin._id });
    res.status(201).json({ page: page.toObject() });
  })
);

/**
 * PUT /api/admin/content/pages/:slug
 * Full replace — the editor sends the whole page, which keeps section
 * reordering and deletion trivial and avoids partial-update ambiguity.
 */
router.put(
  '/pages/:slug',
  validate({
    params: z.object({ slug: slugSchema }),
    body: pageSchema.omit({ slug: true }).strict(),
  }),
  asyncHandler(async (req, res) => {
    const sections = (req.body.sections ?? []).map((s, index) => ({
      ...s,
      order: s.order ?? index,
    }));

    const page = await ContentPage.findOneAndUpdate(
      { slug: req.params.slug },
      { $set: { ...req.body, sections, updatedBy: req.admin._id } },
      { new: true, runValidators: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ page: page.toObject() });
  })
);

router.delete(
  '/pages/:slug',
  validate({ params: z.object({ slug: slugSchema }) }),
  asyncHandler(async (req, res) => {
    const page = await ContentPage.findOneAndDelete({ slug: req.params.slug });
    if (!page) throw notFound('That page does not exist.');
    res.json({ ok: true });
  })
);

export default router;
