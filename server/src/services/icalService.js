import dns from 'node:dns/promises';
import net from 'node:net';
import ical from 'ical-generator';
import nodeIcal from 'node-ical';

import env from '../config/env.js';
import logger from '../lib/logger.js';
import { badRequest } from '../lib/errors.js';
import { Booking, BOOKING_STATUS } from '../models/Booking.js';
import { BlockedDate, BLOCK_SOURCE } from '../models/BlockedDate.js';
import { Property } from '../models/Property.js';
import {
  PROPERTY_TIMEZONE,
  addDays,
  parseDateOnly,
  todayAtProperty,
  toUtcMidnight,
} from '../lib/dates.js';

// ---------------------------------------------------------------------------
// Outbound feed — what Airbnb/VRBO import from us
// ---------------------------------------------------------------------------

/**
 * Build the property's public calendar.
 *
 * Deliberately excludes blocks we imported *from* an OTA: echoing Airbnb's own
 * reservations back at Airbnb creates duplicate blocks and, on re-sync, a feed
 * that slowly amplifies itself. We publish only what originates here.
 */
export async function buildPropertyCalendar(property) {
  const horizonStart = addDays(todayAtProperty(), -90);

  const [bookings, blocks] = await Promise.all([
    Booking.find({
      propertyId: property._id,
      checkOut: { $gte: horizonStart },
      $or: [
        { status: BOOKING_STATUS.CONFIRMED },
        { status: BOOKING_STATUS.PENDING, holdExpiresAt: { $gt: new Date() } },
      ],
    })
      .select('_id checkIn checkOut status createdAt updatedAt')
      .lean(),
    BlockedDate.find({
      propertyId: property._id,
      endDate: { $gte: horizonStart },
      source: { $in: [BLOCK_SOURCE.MANUAL, BLOCK_SOURCE.DIRECT] },
    })
      .select('_id startDate endDate reason createdAt updatedAt')
      .lean(),
  ]);

  const calendar = ical({
    name: `${property.name} — The Little Blooming Farm`,
    prodId: { company: 'The Little Blooming Farm', product: 'direct-booking', language: 'EN' },
    timezone: PROPERTY_TIMEZONE,
    ttl: 60 * 60,
    url: `${env.SERVER_URL}/api/properties/${property._id.toString()}/calendar.ics`,
  });

  for (const booking of bookings) {
    calendar.createEvent({
      id: `booking-${booking._id.toString()}@littlebloomingfarm`,
      start: toUtcMidnight(booking.checkIn),
      end: toUtcMidnight(booking.checkOut),
      allDay: true,
      // No guest names, no amounts — this feed is effectively public.
      summary: booking.status === BOOKING_STATUS.CONFIRMED ? 'Reserved' : 'Reserved (pending)',
      description: 'Booked directly at thelittlebloomingfarm.com',
      stamp: booking.updatedAt ?? booking.createdAt ?? new Date(),
      transparency: 'OPAQUE',
    });
  }

  for (const block of blocks) {
    calendar.createEvent({
      id: `block-${block._id.toString()}@littlebloomingfarm`,
      start: toUtcMidnight(block.startDate),
      end: toUtcMidnight(block.endDate),
      allDay: true,
      summary: 'Unavailable',
      description: block.reason || 'Blocked by the owner',
      stamp: block.updatedAt ?? block.createdAt ?? new Date(),
      transparency: 'OPAQUE',
    });
  }

  return calendar;
}

// ---------------------------------------------------------------------------
// Inbound sync — what we import from Airbnb/VRBO
// ---------------------------------------------------------------------------

/**
 * Admin-supplied URLs are fetched by our server, which makes them an SSRF
 * vector: `http://169.254.169.254/…` would happily read cloud metadata. So we
 * require https and refuse any host that resolves into private address space.
 */
export async function assertSafeFeedUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw badRequest('That calendar link is not a valid URL.');
  }

  const host = url.hostname;

  /**
   * Test-only escape hatch, deliberately narrow: loopback only, and only
   * outside production. It exists so the suite can serve a real Airbnb-format
   * feed from 127.0.0.1 — it must not weaken the guard for anything else, so
   * link-local, RFC1918 and every other private range stay blocked even when
   * it is on.
   */
  const isLoopback = host === '127.0.0.1' || host === 'localhost' || host === '::1';
  if (!env.isProduction && env.ICAL_ALLOW_INSECURE_FEEDS && isLoopback) {
    return url.toString();
  }

  if (url.protocol !== 'https:') {
    throw badRequest('Calendar links must start with https://');
  }

  if (net.isIP(host) && isPrivateAddress(host)) {
    throw badRequest('That calendar link points to a private address.');
  }

  let addresses;
  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    throw badRequest('We could not reach that calendar link.');
  }

  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw badRequest('That calendar link points to a private address.');
  }

  return url.toString();
}

function isPrivateAddress(address) {
  if (address === '::1' || address === '0.0.0.0') return true;
  if (address.startsWith('::ffff:')) return isPrivateAddress(address.slice(7));

  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    if (a === 10 || a === 127) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    return false;
  }

  const lower = address.toLowerCase();
  return lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
}

/**
 * OTA feeds use whole-day events; normalise whatever we get to a calendar date.
 *
 * The subtlety that matters: node-ical parses `DTSTART;VALUE=DATE:20280105`
 * into a Date at **local** midnight, not UTC midnight. On a server east of UTC
 * that instant is 2028-01-04T23:00Z, so reading the UTC components would shift
 * every imported Airbnb block one day earlier — silently mis-blocking the
 * calendar on, say, a Frankfurt or Singapore deployment. For date-only values
 * the local components are the authored date, so those are what we read.
 */
function icalDateToCalendarDate(value) {
  if (!value) return null;

  if (value.dateOnly || value.datetype === 'date') {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }

  // A timed event: the calendar date is whichever day it falls on at the farm.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PROPERTY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
  return parseDateOnly(parts);
}

/**
 * Airbnb marks non-reservation entries with summaries like "Airbnb (Not
 * available)". Both kinds block the calendar, so we import both — the summary
 * is kept only so the admin can see where a block came from.
 */
async function fetchFeedEvents(url) {
  const safeUrl = await assertSafeFeedUrl(url);
  const parsed = await nodeIcal.async.fromURL(safeUrl, {
    timeout: 20_000,
    headers: { 'User-Agent': 'LittleBloomingFarm/1.0 (+calendar-sync)' },
  });

  const events = [];
  for (const entry of Object.values(parsed)) {
    if (entry?.type !== 'VEVENT') continue;

    const startDate = icalDateToCalendarDate(entry.start);
    const endDate = icalDateToCalendarDate(entry.end);
    if (!startDate || !endDate || endDate <= startDate) continue;

    events.push({
      uid: String(entry.uid ?? `${startDate.toISOString()}-${endDate.toISOString()}`).slice(0, 400),
      startDate,
      endDate,
      summary: String(entry.summary ?? '').slice(0, 300),
    });
  }
  return events;
}

/**
 * Pull one property's OTA calendars into BlockedDate.
 *
 * Reconciliation is by `externalUid` within `(propertyId, source)`:
 *   • seen again  → update dates in place (an OTA guest extended their stay)
 *   • newly seen  → insert
 *   • absent now  → delete, but only rows from *this* source
 * Manual blocks carry no `externalUid` and are never in scope, so a sync can
 * never wipe the owner's own holds.
 */
export async function syncPropertyCalendars(propertyId) {
  const property = await Property.findById(propertyId);
  if (!property) return { propertyId, skipped: 'not found' };

  const feeds = [
    { source: BLOCK_SOURCE.AIRBNB, url: property.airbnbIcalUrl },
    { source: BLOCK_SOURCE.VRBO, url: property.vrboIcalUrl },
  ].filter((f) => f.url && f.url.trim());

  if (feeds.length === 0) {
    return { propertyId: propertyId.toString(), property: property.name, skipped: 'no feeds' };
  }

  const summary = { propertyId: propertyId.toString(), property: property.name, feeds: [] };
  const errors = [];

  for (const feed of feeds) {
    const syncedAt = new Date();
    try {
      const events = await fetchFeedEvents(feed.url);

      const operations = events.map((event) => ({
        updateOne: {
          filter: { propertyId: property._id, source: feed.source, externalUid: event.uid },
          update: {
            $set: {
              startDate: event.startDate,
              endDate: event.endDate,
              summary: event.summary,
              reason: `Imported from ${feed.source}`,
              lastSyncedAt: syncedAt,
            },
            $setOnInsert: {
              propertyId: property._id,
              source: feed.source,
              externalUid: event.uid,
            },
          },
          upsert: true,
        },
      }));

      let upserted = 0;
      let modified = 0;
      if (operations.length > 0) {
        const result = await BlockedDate.bulkWrite(operations, { ordered: false });
        upserted = result.upsertedCount ?? 0;
        modified = result.modifiedCount ?? 0;
      }

      // Anything from this source we did not just touch is gone upstream.
      const removed = await BlockedDate.deleteMany({
        propertyId: property._id,
        source: feed.source,
        externalUid: { $ne: null },
        $or: [{ lastSyncedAt: { $lt: syncedAt } }, { lastSyncedAt: null }],
      });

      summary.feeds.push({
        source: feed.source,
        events: events.length,
        added: upserted,
        updated: modified,
        removed: removed.deletedCount ?? 0,
      });
    } catch (err) {
      errors.push(`${feed.source}: ${err.message}`);
      summary.feeds.push({ source: feed.source, error: err.message });
      logger.error('iCal feed sync failed', {
        propertyId: property._id.toString(),
        source: feed.source,
        error: err.message,
      });
    }
  }

  property.lastIcalSyncAt = new Date();
  property.lastIcalSyncStatus = errors.length > 0 ? `Errors — ${errors.join('; ')}` : 'OK';
  await property.save();

  return summary;
}

/** Sync every active property that has at least one feed configured. */
export async function syncAllCalendars() {
  const properties = await Property.find({
    isActive: true,
    $or: [
      { airbnbIcalUrl: { $nin: [null, ''] } },
      { vrboIcalUrl: { $nin: [null, ''] } },
    ],
  })
    .select('_id name')
    .lean();

  if (properties.length === 0) {
    logger.debug('iCal sync: no properties with feeds configured');
    return [];
  }

  const results = [];
  // Sequential on purpose — two properties, and OTA endpoints dislike bursts.
  for (const property of properties) {
    results.push(await syncPropertyCalendars(property._id));
  }

  logger.info('iCal sync complete', { properties: results.length });
  return results;
}
