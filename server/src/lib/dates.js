/**
 * Date handling for a booking system.
 *
 * Check-in and check-out are *calendar dates*, not instants. A guest arriving
 * "March 3rd" means the same thing whether the server runs in UTC or LA. So
 * every stored date is normalised to UTC midnight and compared date-to-date.
 * The only place a timezone matters is deciding what "today" is — for that we
 * use the farm's local timezone, not the server's.
 */

export const PROPERTY_TIMEZONE = 'America/Los_Angeles';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
export const MS_PER_DAY = 86_400_000;

/** Parse a strict `YYYY-MM-DD` string into a UTC-midnight Date. */
export function parseDateOnly(value) {
  if (value instanceof Date) return toUtcMidnight(value);
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) return null;

  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));

  // Rejects impossible dates that JS would otherwise roll over (e.g. 2025-02-31).
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

/** Strip the time component, anchoring to UTC midnight. */
export function toUtcMidnight(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Render a Date as `YYYY-MM-DD` in UTC. */
export function formatDateOnly(date) {
  const d = toUtcMidnight(date);
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

/** Today's calendar date at the farm, as a UTC-midnight Date. */
export function todayAtProperty() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PROPERTY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parseDateOnly(parts);
}

export function addDays(date, days) {
  const d = toUtcMidnight(date);
  return new Date(d.getTime() + days * MS_PER_DAY);
}

/** Whole nights between two calendar dates. */
export function nightsBetween(checkIn, checkOut) {
  const a = toUtcMidnight(checkIn);
  const b = toUtcMidnight(checkOut);
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/**
 * Every occupied night in a stay, as `YYYY-MM-DD` strings.
 * Check-out day is excluded — the guest is gone by then, so it is bookable
 * as the next guest's check-in.
 */
export function nightsInRange(start, end) {
  const out = [];
  let cursor = toUtcMidnight(start);
  const last = toUtcMidnight(end);
  while (cursor < last) {
    out.push(formatDateOnly(cursor));
    cursor = addDays(cursor, 1);
  }
  return out;
}

/**
 * The canonical overlap test, used everywhere:
 *   existing.start < requested.end AND existing.end > requested.start
 * Touching ranges (one checks out the morning another checks in) do NOT overlap.
 */
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return toUtcMidnight(aStart) < toUtcMidnight(bEnd) && toUtcMidnight(aEnd) > toUtcMidnight(bStart);
}

/** Human-readable range, e.g. "Mar 3 – 7, 2026". */
export function formatRange(checkIn, checkOut) {
  const fmt = (d, opts) =>
    new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts }).format(toUtcMidnight(d));
  const a = toUtcMidnight(checkIn);
  const b = toUtcMidnight(checkOut);
  const sameMonth = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();

  if (sameMonth) {
    // Composed by hand: `{ day, year }` is not a valid Intl skeleton and falls
    // back to output like "2026 (day: 14)".
    return `${fmt(a, { month: 'short' })} ${a.getUTCDate()} – ${b.getUTCDate()}, ${b.getUTCFullYear()}`;
  }
  return `${fmt(a, { month: 'short', day: 'numeric' })} – ${fmt(b, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}
