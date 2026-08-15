import express from 'express';

import { Media } from '../../models/Media.js';
import { asyncHandler, badRequest, notFound } from '../../lib/errors.js';
import { deleteStoredFile, storeFile, uploadMiddleware } from '../../lib/upload.js';
import { uploadLimiter } from '../../middleware/rateLimit.js';
import { intParam, objectId, optionalText, validate, z } from '../../middleware/validate.js';

const router = express.Router();

const collectionName = z
  .string()
  .trim()
  .toLowerCase()
  .max(40)
  .regex(/^[a-z0-9-]+$/, 'use lowercase letters, numbers and dashes');

/** GET /api/admin/media?collection=gallery */
router.get(
  '/',
  validate({
    query: z.object({
      collection: collectionName.optional(),
      type: z.enum(['image', 'video']).optional(),
      limit: intParam(1, 300, 200),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { collection, type, limit } = req.validatedQuery;

    const filter = {};
    if (collection) filter.collectionName = collection;
    if (type) filter.type = type;

    const media = await Media.find(filter)
      .sort({ collectionName: 1, order: 1, createdAt: -1 })
      .limit(limit)
      .lean();

    res.set('Cache-Control', 'no-store');
    res.json({ media });
  })
);

/**
 * POST /api/admin/media — multipart upload.
 * Every file is checked by magic bytes, not by its declared type or extension,
 * before it reaches storage.
 */
router.post(
  '/',
  uploadLimiter,
  uploadMiddleware.array('files', 12),
  asyncHandler(async (req, res) => {
    if (!req.files?.length) throw badRequest('No files were uploaded.');

    const collection = collectionName.parse(req.body.collection || 'gallery');
    const alt = String(req.body.alt ?? '').slice(0, 300);

    const highest = await Media.findOne({ collectionName: collection })
      .sort({ order: -1 })
      .select('order')
      .lean();
    let nextOrder = (highest?.order ?? -1) + 1;

    const created = [];
    for (const file of req.files) {
      const stored = await storeFile(file);
      const doc = await Media.create({
        ...stored,
        alt,
        collectionName: collection,
        order: nextOrder,
        uploadedBy: req.admin._id,
      });
      nextOrder += 1;
      created.push(doc.toObject());
    }

    res.status(201).json({ media: created });
  })
);

/** PATCH /api/admin/media/:id — captions, alt text, collection, ordering. */
router.patch(
  '/:id',
  validate({
    params: z.object({ id: objectId }),
    body: z
      .object({
        alt: optionalText(300).optional(),
        caption: optionalText(300).optional(),
        collectionName: collectionName.optional(),
        tags: z.array(z.string().trim().max(40)).max(20).optional(),
        order: z.number().int().min(0).max(9999).optional(),
        isActive: z.boolean().optional(),
      })
      .strict(),
  }),
  asyncHandler(async (req, res) => {
    const media = await Media.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!media) throw notFound('That file no longer exists.');
    res.json({ media: media.toObject() });
  })
);

/** POST /api/admin/media/reorder */
router.post(
  '/reorder',
  validate({
    body: z
      .object({
        order: z
          .array(z.object({ id: objectId, order: z.number().int().min(0).max(9999) }))
          .max(300),
      })
      .strict(),
  }),
  asyncHandler(async (req, res) => {
    await Media.bulkWrite(
      req.body.order.map(({ id, order }) => ({
        updateOne: { filter: { _id: id }, update: { $set: { order } } },
      })),
      { ordered: false }
    );
    res.json({ ok: true });
  })
);

/** DELETE /api/admin/media/:id — removes the record and the stored asset. */
router.delete(
  '/:id',
  validate({ params: z.object({ id: objectId }) }),
  asyncHandler(async (req, res) => {
    const media = await Media.findById(req.params.id);
    if (!media) throw notFound('That file no longer exists.');

    await deleteStoredFile({
      provider: media.provider,
      publicId: media.publicId,
      type: media.type,
    });
    await media.deleteOne();

    res.json({ ok: true });
  })
);

export default router;
