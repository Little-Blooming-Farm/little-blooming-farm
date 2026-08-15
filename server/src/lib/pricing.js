import env from '../config/env.js';
import { badRequest } from './errors.js';
import { addDays, nightsBetween, todayAtProperty, toUtcMidnight } from './dates.js';

/**
 * Validate a requested stay against the property's own rules.
 * Throws a 400 AppError with a guest-readable message on the first failure.
 */
export function assertStayIsValid({ property, checkIn, checkOut, guests }) {
  const start = toUtcMidnight(checkIn);
  const end = toUtcMidnight(checkOut);

  if (!start || !end) throw badRequest('Please choose valid arrival and departure dates.');

  if (end <= start) {
    throw badRequest('Departure must be at least one night after arrival.', undefined, 'BAD_RANGE');
  }

  const today = todayAtProperty();
  if (start < today) {
    throw badRequest('Arrival cannot be in the past.', undefined, 'PAST_DATE');
  }

  const latest = addDays(today, env.MAX_ADVANCE_DAYS);
  if (start > latest) {
    throw badRequest(
      `We open the calendar about ${Math.round(env.MAX_ADVANCE_DAYS / 30)} months ahead. ` +
        'Write to us for dates beyond that.',
      undefined,
      'TOO_FAR_AHEAD'
    );
  }

  const nights = nightsBetween(start, end);
  const minNights = property.minNights || env.MIN_NIGHTS;
  if (nights < minNights) {
    throw badRequest(
      `${property.name} has a ${minNights}-night minimum.`,
      { minNights },
      'MIN_NIGHTS'
    );
  }

  const maxNights = property.maxNights || 30;
  if (nights > maxNights) {
    throw badRequest(
      `Stays longer than ${maxNights} nights are arranged directly — please write to us.`,
      { maxNights },
      'MAX_NIGHTS'
    );
  }

  if (guests != null) {
    if (guests < 1) throw badRequest('At least one guest is required.');
    if (guests > property.maxGuests) {
      throw badRequest(
        `${property.name} sleeps up to ${property.maxGuests} guests.`,
        { maxGuests: property.maxGuests },
        'TOO_MANY_GUESTS'
      );
    }
  }

  return { start, end, nights };
}

/**
 * Price breakdown: nights × nightly rate + cleaning fee.
 * Integer cents throughout — no floating point ever touches money.
 */
export function computeQuote({ property, checkIn, checkOut, guests }) {
  const { start, end, nights } = assertStayIsValid({ property, checkIn, checkOut, guests });

  const nightlyRateCents = property.basePriceCents;
  const accommodationCents = nightlyRateCents * nights;
  const cleaningFeeCents = property.cleaningFeeCents ?? 0;
  const totalPriceCents = accommodationCents + cleaningFeeCents;

  return {
    propertyId: property._id.toString(),
    propertyName: property.name,
    propertySlug: property.slug,
    checkIn: start,
    checkOut: end,
    nights,
    guests: guests ?? null,
    nightlyRateCents,
    accommodationCents,
    cleaningFeeCents,
    totalPriceCents,
    currency: env.STRIPE_CURRENCY,
    lineItems: [
      {
        label: `${formatMoney(nightlyRateCents)} × ${nights} ${nights === 1 ? 'night' : 'nights'}`,
        amountCents: accommodationCents,
      },
      ...(cleaningFeeCents > 0
        ? [{ label: 'Cleaning fee', amountCents: cleaningFeeCents }]
        : []),
    ],
  };
}

/**
 * Which deposit sizes a guest may actually choose for this stay.
 *
 * Paying in full is always available. Deposits are only offered when the stay
 * is far enough out that a balance could realistically be collected — inside
 * that window the question is moot and the guest simply pays.
 */
export function depositChoicesFor({ property, checkIn, now = new Date() }) {
  const balanceDueDays = property.balanceDueDays ?? 30;
  const balanceDueDate = addDays(toUtcMidnight(checkIn), -balanceDueDays);
  const splitPossible = balanceDueDate.getTime() > now.getTime();

  if (!splitPossible) {
    return { runway: false, choiceAvailable: false, balanceDueDate: null, options: [100] };
  }

  const options = [...new Set((property.depositOptions ?? []).filter((v) => v > 0 && v < 100))].sort(
    (a, b) => a - b
  );

  return {
    // Is there time to collect a balance at all? Governs whether a split can
    // happen, guest choice or not.
    runway: true,
    // Is the guest actually offered a menu? A property can run a fixed deposit
    // with no options, which is a split without a choice.
    choiceAvailable: options.length > 0,
    balanceDueDate,
    // Ascending deposits, then "pay in full" last.
    options: [...options, 100],
  };
}

/**
 * Reject a deposit choice the property does not offer.
 *
 * The split is money, so it is decided here rather than by whatever the browser
 * sent. A request for 5% on a property offering 25/50/75 is refused outright —
 * not silently rounded — because quietly charging something other than what was
 * asked for is worse than an error.
 */
export function assertDepositChoiceIsValid({ property, checkIn, depositPercent, now = new Date() }) {
  if (depositPercent == null) return null;

  const { choiceAvailable, options } = depositChoicesFor({ property, checkIn, now });

  if (depositPercent === 100) return 100;

  if (!choiceAvailable) {
    throw badRequest(
      'These dates are too close to arrival to split the payment — the stay is paid in full at booking.',
      undefined,
      'SPLIT_UNAVAILABLE'
    );
  }
  if (!options.includes(depositPercent)) {
    const offered = options.filter((o) => o < 100).join('%, ');
    throw badRequest(
      `That deposit is not one we offer. Choose ${offered}%, or pay in full.`,
      { options },
      'BAD_DEPOSIT_CHOICE'
    );
  }
  return depositPercent;
}

/**
 * Split a total into the instalments the guest will actually be charged.
 *
 * Two shapes only:
 *   • `full`               — one payment now
 *   • `deposit` + `balance` — part now, the rest before arrival
 *
 * `depositPercent` is the guest's choice when they made one, falling back to
 * the property's default. Either way the split is only used when check-in is
 * far enough out that a balance could realistically be collected; a stay booked
 * inside that window is charged in full, because a balance due yesterday helps
 * nobody.
 *
 * Rounding always favours the deposit, and the balance is computed as the
 * remainder rather than as its own percentage — so the instalments sum to the
 * total exactly, with no lost or invented cent.
 */
export function buildPaymentSchedule({
  property,
  checkIn,
  totalPriceCents,
  depositPercent = null,
  now = new Date(),
}) {
  const chosen = depositPercent ?? property.depositPercent ?? 100;
  const { runway, balanceDueDate } = depositChoicesFor({ property, checkIn, now });

  if (chosen >= 100 || !runway) {
    return [{ kind: 'full', amountCents: totalPriceCents, dueDate: null }];
  }

  const depositCents = Math.ceil((totalPriceCents * chosen) / 100);
  const balanceCents = totalPriceCents - depositCents;

  // A balance of zero is just a full payment wearing a different hat, and an
  // instalment below Stripe's minimum charge cannot be collected at all.
  const STRIPE_MINIMUM_CENTS = 50;
  if (balanceCents < STRIPE_MINIMUM_CENTS || depositCents < STRIPE_MINIMUM_CENTS) {
    return [{ kind: 'full', amountCents: totalPriceCents, dueDate: null }];
  }

  return [
    { kind: 'deposit', amountCents: depositCents, dueDate: null },
    { kind: 'balance', amountCents: balanceCents, dueDate: balanceDueDate },
  ];
}

export function formatMoney(cents, currency = env.STRIPE_CURRENCY) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Refund owed on cancellation, mirroring the default policy copy:
 *   30+ days out → 100%, 7–30 days → 50%, under 7 days → 0%.
 *
 * Calculated against what the guest has actually *paid*, not the booking total
 * — with instalments those differ, and refunding a percentage of the total to
 * someone who only paid a deposit would hand back money never collected.
 */
export function computeRefundCents(booking, now = new Date()) {
  if (booking.status !== 'confirmed') return 0;

  const msUntilCheckIn = toUtcMidnight(booking.checkIn).getTime() - now.getTime();
  const daysUntilCheckIn = Math.floor(msUntilCheckIn / 86_400_000);

  const collected = (booking.payments ?? [])
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amountCents - (p.amountRefundedCents ?? 0), 0);

  // Bookings created before instalments existed carry no schedule.
  const paid =
    booking.payments?.length > 0
      ? collected
      : booking.totalPriceCents - (booking.amountRefundedCents ?? 0);

  if (paid <= 0) return 0;
  if (daysUntilCheckIn >= 30) return paid;
  if (daysUntilCheckIn >= 7) return Math.floor(paid / 2);
  return 0;
}
