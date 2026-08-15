import { Booking, BOOKING_STATUS } from '../models/Booking.js';
import { BlockedDate } from '../models/BlockedDate.js';
import { formatDateOnly, nightsInRange, toUtcMidnight } from './dates.js';

/**
 * The overlap predicate, in one place, in Mongo terms:
 *
 *     existing.checkIn  <  requested.checkOut
 *   AND existing.checkOut >  requested.checkIn
 *
 * Strict inequalities are what make same-day turnover work: a stay ending on
 * the 7th does not conflict with a stay starting on the 7th.
 */
export function bookingOverlapFilter(propertyId, checkIn, checkOut, now = new Date()) {
  return {
    propertyId,
    checkIn: { $lt: toUtcMidnight(checkOut) },
    checkOut: { $gt: toUtcMidnight(checkIn) },
    $or: [
      // Paid stays always hold the calendar.
      { status: BOOKING_STATUS.CONFIRMED },
      // Unpaid stays hold it only until their checkout hold expires.
      { status: BOOKING_STATUS.PENDING, holdExpiresAt: { $gt: now } },
    ],
  };
}

export function blockOverlapFilter(propertyId, checkIn, checkOut) {
  return {
    propertyId,
    startDate: { $lt: toUtcMidnight(checkOut) },
    endDate: { $gt: toUtcMidnight(checkIn) },
  };
}

/**
 * Everything standing in the way of a stay. Runs both collections, optionally
 * inside a transaction session, optionally ignoring one booking (used when an
 * admin edits an existing reservation's dates).
 */
export async function findConflicts(propertyId, checkIn, checkOut, options = {}) {
  const { session = null, excludeBookingId = null, now = new Date() } = options;

  const bookingFilter = bookingOverlapFilter(propertyId, checkIn, checkOut, now);
  if (excludeBookingId) bookingFilter._id = { $ne: excludeBookingId };

  const query = (q) => (session ? q.session(session) : q);

  const [bookings, blocks] = await Promise.all([
    query(Booking.find(bookingFilter).select('_id checkIn checkOut status').lean()),
    query(
      BlockedDate.find(blockOverlapFilter(propertyId, checkIn, checkOut))
        .select('_id startDate endDate source reason')
        .lean()
    ),
  ]);

  return { bookings, blocks, hasConflict: bookings.length > 0 || blocks.length > 0 };
}

export async function isRangeAvailable(propertyId, checkIn, checkOut, options = {}) {
  const { hasConflict } = await findConflicts(propertyId, checkIn, checkOut, options);
  return !hasConflict;
}

/**
 * Calendar payload for the booking UI. Deliberately anonymised — a public
 * endpoint reveals *that* a night is taken, never who took it.
 */
export async function getUnavailability(propertyId, from, to) {
  const start = toUtcMidnight(from);
  const end = toUtcMidnight(to);
  const now = new Date();

  const [bookings, blocks] = await Promise.all([
    Booking.find(bookingOverlapFilter(propertyId, start, end, now))
      .select('checkIn checkOut status')
      .lean(),
    BlockedDate.find(blockOverlapFilter(propertyId, start, end))
      .select('startDate endDate source reason')
      .lean(),
  ]);

  const ranges = [
    ...bookings.map((b) => ({
      start: formatDateOnly(b.checkIn),
      end: formatDateOnly(b.checkOut),
      source: 'booking',
    })),
    ...blocks.map((b) => ({
      start: formatDateOnly(b.startDate),
      end: formatDateOnly(b.endDate),
      source: b.source,
    })),
  ];

  // Flattened set of occupied nights — what the date picker greys out.
  const nights = new Set();
  for (const range of ranges) {
    for (const night of nightsInRange(range.start, range.end)) nights.add(night);
  }

  return {
    from: formatDateOnly(start),
    to: formatDateOnly(end),
    ranges,
    unavailableNights: [...nights].sort(),
  };
}
