import express from 'express';

import { requireAdmin, requireSameOrigin } from '../../middleware/auth.js';
import { syncAllCalendars } from '../../services/icalService.js';
import { releaseExpiredHolds } from '../../services/bookingService.js';
import { asyncHandler } from '../../lib/errors.js';

import authRoutes from './auth.js';
import dashboardRoutes from './dashboard.js';
import propertyRoutes from './properties.js';
import bookingRoutes from './bookings.js';
import blockedDateRoutes from './blockedDates.js';
import animalRoutes from './animals.js';
import contentRoutes from './content.js';
import experienceRoutes from './experiences.js';
import mediaRoutes from './media.js';
import diagnosticsRoutes from './diagnostics.js';

const router = express.Router();

// Admin responses are never cacheable, anywhere, by anyone.
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  next();
});

// Every state-changing admin request must announce one of our own origins.
router.use(requireSameOrigin);

// Login / logout / session probe are the only unauthenticated admin routes.
router.use('/', authRoutes);

// --- Everything below requires a valid admin session ------------------------
router.use(requireAdmin);

router.use('/dashboard', dashboardRoutes);
router.use('/properties', propertyRoutes);
router.use('/bookings', bookingRoutes);
router.use('/blocked-dates', blockedDateRoutes);
router.use('/animals', animalRoutes);
router.use('/content', contentRoutes);
router.use('/experiences', experienceRoutes);
router.use('/media', mediaRoutes);
router.use('/', diagnosticsRoutes);

/** POST /api/admin/maintenance/sync-calendars — run every OTA sync now. */
router.post(
  '/maintenance/sync-calendars',
  asyncHandler(async (_req, res) => {
    const results = await syncAllCalendars();
    res.json({ results });
  })
);

/** POST /api/admin/maintenance/release-holds — clear lapsed unpaid holds now. */
router.post(
  '/maintenance/release-holds',
  asyncHandler(async (_req, res) => {
    const result = await releaseExpiredHolds();
    res.json(result);
  })
);

export default router;
