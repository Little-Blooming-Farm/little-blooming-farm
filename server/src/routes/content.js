import express from 'express';

import { Animal } from '../models/Animal.js';
import { ContentPage } from '../models/ContentPage.js';
import { Experience } from '../models/Experience.js';
import { Media } from '../models/Media.js';
import { asyncHandler, notFound } from '../lib/errors.js';
import { intParam, slug as slugSchema, validate, z } from '../middleware/validate.js';

const router = express.Router();

// Story content changes rarely; let the CDN and browser hold it briefly.
const PUBLIC_CACHE = 'public, max-age=120, stale-while-revalidate=600';

/** GET /api/content/pages/:slug — an editable long-form page. */
router.get(
  '/pages/:slug',
  validate({ params: z.object({ slug: slugSchema }) }),
  asyncHandler(async (req, res) => {
    const page = await ContentPage.findOne({ slug: req.params.slug, isPublished: true });
    if (!page) throw notFound('That page has not been written yet.');

    res.set('Cache-Control', PUBLIC_CACHE);
    res.json({ page: page.toPublicJSON() });
  })
);

/** GET /api/content/pages — slugs only, for nav/sitemap use. */
router.get(
  '/pages',
  asyncHandler(async (_req, res) => {
    const pages = await ContentPage.find({ isPublished: true })
      .select('slug title subtitle updatedAt')
      .sort({ slug: 1 })
      .lean();

    res.set('Cache-Control', PUBLIC_CACHE);
    res.json({ pages });
  })
);

/** GET /api/content/animals — the residents, in display order. */
router.get(
  '/animals',
  asyncHandler(async (_req, res) => {
    const animals = await Animal.find({ isActive: true }).sort({ order: 1, name: 1 });

    res.set('Cache-Control', PUBLIC_CACHE);
    res.json({ animals: animals.map((a) => a.toPublicJSON()) });
  })
);

/** GET /api/content/animals/:slug — one profile. */
router.get(
  '/animals/:slug',
  validate({ params: z.object({ slug: slugSchema }) }),
  asyncHandler(async (req, res) => {
    const animal = await Animal.findOne({ slug: req.params.slug, isActive: true });
    if (!animal) throw notFound('We could not find that one.');

    res.set('Cache-Control', PUBLIC_CACHE);
    res.json({ animal: animal.toPublicJSON() });
  })
);

/** GET /api/content/experiences — content only today, bookable later. */
router.get(
  '/experiences',
  validate({
    query: z.object({
      category: z
        .enum(['animals', 'garden', 'gathering', 'kids', 'seasonal', 'quiet'])
        .optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const filter = { isActive: true };
    if (req.validatedQuery?.category) filter.category = req.validatedQuery.category;

    const experiences = await Experience.find(filter).sort({ order: 1, title: 1 });

    res.set('Cache-Control', PUBLIC_CACHE);
    res.json({ experiences: experiences.map((e) => e.toPublicJSON()) });
  })
);

/** GET /api/content/media?collection=gallery — gallery / page imagery. */
router.get(
  '/media',
  validate({
    query: z.object({
      collection: z
        .string()
        .trim()
        .toLowerCase()
        .max(40)
        .regex(/^[a-z0-9-]+$/)
        .optional()
        .default('gallery'),
      limit: intParam(1, 200, 120),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { collection, limit } = req.validatedQuery;

    const media = await Media.find({ collectionName: collection, isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .limit(limit);

    res.set('Cache-Control', PUBLIC_CACHE);
    res.json({ media: media.map((m) => m.toPublicJSON()) });
  })
);

export default router;
