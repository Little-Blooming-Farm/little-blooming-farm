/**
 * Booking dates are calendar dates, not instants. Parsing "2026-03-05" with
 * `new Date()` yields UTC midnight, which renders as the *previous* day in any
 * timezone west of Greenwich — so every date formatter here reads UTC parts.
 */

export function parseDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return new Date(value);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function toDateKey(date) {
  const d = date instanceof Date ? date : parseDateOnly(date);
  if (!d) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}

const fmt = (opts) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts });

export function formatDate(value, opts = { month: 'long', day: 'numeric', year: 'numeric' }) {
  const d = parseDateOnly(value);
  if (!d) return '';
  return fmt(opts).format(d);
}

export function formatShortDate(value) {
  return formatDate(value, { month: 'short', day: 'numeric' });
}

export function formatDateRange(checkIn, checkOut) {
  const a = parseDateOnly(checkIn);
  const b = parseDateOnly(checkOut);
  if (!a || !b) return '';

  const sameMonth = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
  if (sameMonth) {
    // Composed by hand: `{ day, year }` is not a valid Intl skeleton and falls
    // back to output like "2026 (day: 14)".
    return `${fmt({ month: 'long' }).format(a)} ${a.getUTCDate()} – ${b.getUTCDate()}, ${b.getUTCFullYear()}`;
  }
  return `${fmt({ month: 'short', day: 'numeric' }).format(a)} – ${fmt({
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(b)}`;
}

export function formatMoney(cents, currency = 'usd') {
  if (cents == null) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function nightsBetween(checkIn, checkOut) {
  const a = parseDateOnly(checkIn);
  const b = parseDateOnly(checkOut);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function addDays(value, days) {
  const d = parseDateOnly(value);
  return new Date(d.getTime() + days * 86_400_000);
}

export function addMonths(value, months) {
  const d = parseDateOnly(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
}

export function todayKey() {
  const now = new Date();
  // The farm's calendar day, not the visitor's — a guest in Tokyo should not
  // see a night greyed out because it is already tomorrow where they are.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parts;
}

export function pluralise(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function titleCase(value) {
  return String(value ?? '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
