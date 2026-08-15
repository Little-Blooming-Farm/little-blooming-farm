import express from 'express';

import { Booking, BOOKING_STATUS } from '../../models/Booking.js';
import { Property } from '../../models/Property.js';
import { asyncHandler } from '../../lib/errors.js';
import { addDays, todayAtProperty } from '../../lib/dates.js';

const router = express.Router();

/**
 * GET /api/admin/dashboard
 * Everything the owner needs on one screen: who is arriving, who is leaving,
 * what came in recently, and how the next 30 days look.
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const today = todayAtProperty();
    const horizon = addDays(today, 30);
    const monthAgo = addDays(today, -30);

    const activeStatuses = [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.PENDING];

    const [
      properties,
      upcomingCheckIns,
      upcomingCheckOuts,
      inHouse,
      recentBookings,
      counts,
      revenue,
    ] = await Promise.all([
      Property.find().select('name slug isActive lastIcalSyncAt lastIcalSyncStatus').lean(),

      Booking.find({
        status: BOOKING_STATUS.CONFIRMED,
        checkIn: { $gte: today, $lte: horizon },
      })
        .populate('propertyId', 'name slug')
        .sort({ checkIn: 1 })
        .limit(30)
        .lean(),

      Booking.find({
        status: BOOKING_STATUS.CONFIRMED,
        checkOut: { $gte: today, $lte: horizon },
      })
        .populate('propertyId', 'name slug')
        .sort({ checkOut: 1 })
        .limit(30)
        .lean(),

      Booking.find({
        status: BOOKING_STATUS.CONFIRMED,
        checkIn: { $lte: today },
        checkOut: { $gt: today },
      })
        .populate('propertyId', 'name slug')
        .lean(),

      Booking.find()
        .populate('propertyId', 'name slug')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),

      Booking.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      Booking.aggregate([
        {
          $match: {
            status: BOOKING_STATUS.CONFIRMED,
            paidAt: { $gte: monthAgo },
          },
        },
        {
          $group: {
            _id: null,
            grossCents: { $sum: '$totalPriceCents' },
            refundedCents: { $sum: '$amountRefundedCents' },
            bookings: { $sum: 1 },
            nights: { $sum: '$nights' },
          },
        },
      ]),
    ]);

    const byStatus = Object.fromEntries(counts.map((c) => [c._id, c.count]));
    const money = revenue[0] ?? { grossCents: 0, refundedCents: 0, bookings: 0, nights: 0 };

    // Occupancy over the next 30 days, across all active homes.
    const activeProperties = properties.filter((p) => p.isActive).length;
    const bookedNights = await Booking.aggregate([
      {
        $match: {
          status: { $in: activeStatuses },
          checkIn: { $lt: horizon },
          checkOut: { $gt: today },
        },
      },
      { $group: { _id: null, nights: { $sum: '$nights' } } },
    ]);

    const capacityNights = activeProperties * 30;
    const occupancyPercent =
      capacityNights > 0
        ? Math.min(100, Math.round(((bookedNights[0]?.nights ?? 0) / capacityNights) * 100))
        : 0;

    res.set('Cache-Control', 'no-store');
    res.json({
      today: today.toISOString().slice(0, 10),
      properties,
      stats: {
        pending: byStatus.pending ?? 0,
        confirmed: byStatus.confirmed ?? 0,
        cancelled: byStatus.cancelled ?? 0,
        last30Days: {
          bookings: money.bookings,
          nights: money.nights,
          grossCents: money.grossCents,
          refundedCents: money.refundedCents,
          netCents: money.grossCents - money.refundedCents,
        },
        next30Days: { occupancyPercent, bookedNights: bookedNights[0]?.nights ?? 0 },
      },
      inHouse,
      upcomingCheckIns,
      upcomingCheckOuts,
      recentBookings,
    });
  })
);

export default router;
