import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import {
  createBooking,
  getAvailability,
  getProperties,
  getQuote,
} from '../lib/api.js';
import useAsync from '../hooks/useAsync.js';
import AvailabilityCalendar from '../components/booking/AvailabilityCalendar.jsx';
import SmartImage from '../components/SmartImage.jsx';
import Reveal from '../components/Reveal.jsx';
import WalletBadge from '../components/WalletBadge.jsx';
import { ErrorState, Eyebrow, LoadingState, Note } from '../components/ui.jsx';
import { EASE } from '../lib/motion.js';
import {
  addDays,
  formatDate,
  formatDateRange,
  formatMoney,
  nightsBetween,
  pluralise,
  toDateKey,
  todayKey,
} from '../lib/format.js';

const EMPTY_RANGE = { checkIn: null, checkOut: null };

export default function Book() {
  const [searchParams, setSearchParams] = useSearchParams();
  const properties = useAsync(() => getProperties(), []);

  const [selectedId, setSelectedId] = useState(null);
  const [range, setRange] = useState(EMPTY_RANGE);
  const [guests, setGuests] = useState(2);
  const [form, setForm] = useState({ guestName: '', guestEmail: '', guestPhone: '', message: '' });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [serverQuote, setServerQuote] = useState(null);
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  /**
   * `discountCode` is what the guest is typing; `appliedCode` is what the last
   * quote was priced with. Keeping them apart stops every keystroke re-pricing
   * the stay, and lets the field show a rejection without clearing what they
   * typed so they can correct a typo.
   */
  const [discountCode, setDiscountCode] = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const homes = properties.data?.properties ?? [];
  const wasCancelled = searchParams.get('cancelled') === '1';

  // Honour ?property=the-barn from the Stay page, then default sensibly.
  useEffect(() => {
    if (homes.length === 0 || selectedId) return;
    const requested = searchParams.get('property');
    const match = homes.find((p) => p.slug === requested);
    setSelectedId(match?.id ?? homes[0].id);
  }, [homes, searchParams, selectedId]);

  const property = homes.find((p) => p.id === selectedId) ?? null;

  const availability = useAsync(
    () =>
      property
        ? getAvailability(property.id, todayKey(), toDateKey(addDays(todayKey(), 400)))
        : Promise.resolve(null),
    [property?.id]
  );

  const unavailableNights = useMemo(
    () => new Set(availability.data?.unavailableNights ?? []),
    [availability.data]
  );

  const nights = range.checkIn && range.checkOut ? nightsBetween(range.checkIn, range.checkOut) : 0;

  /**
   * Instant local estimate so the price moves the moment a date is clicked.
   * The server quote below is the authority — this is only for responsiveness,
   * and the two are reconciled before anything is submitted.
   */
  const estimate = useMemo(() => {
    if (!property || nights <= 0) return null;
    const accommodationCents = property.basePriceCents * nights;
    return {
      nights,
      nightlyRateCents: property.basePriceCents,
      accommodationCents,
      cleaningFeeCents: property.cleaningFeeCents,
      totalPriceCents: accommodationCents + property.cleaningFeeCents,
    };
  }, [property, nights]);

  // Confirm the price and the availability with the server, debounced.
  const quoteTimer = useRef(null);
  useEffect(() => {
    setServerQuote(null);
    if (!property || !range.checkIn || !range.checkOut) return undefined;

    clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(async () => {
      try {
        const result = await getQuote({
          propertyId: property.id,
          checkIn: range.checkIn,
          checkOut: range.checkOut,
          guests,
          ...(selectedDeposit ? { depositPercent: selectedDeposit } : {}),
          ...(appliedCode ? { discountCode: appliedCode } : {}),
        });
        setServerQuote(result);
        setError(null);
      } catch (err) {
        setServerQuote(null);
        setError(err);
      }
    }, 300);

    return () => clearTimeout(quoteTimer.current);
  }, [property, range.checkIn, range.checkOut, guests, selectedDeposit, appliedCode]);

  // Changing home invalidates the dates — the two calendars are independent.
  const selectProperty = (id) => {
    setSelectedId(id);
    setRange(EMPTY_RANGE);
    setServerQuote(null);
    setSelectedDeposit(null);
    setError(null);
    const next = homes.find((p) => p.id === id);
    if (next) {
      setSearchParams({ property: next.slug }, { replace: true });
      setGuests((g) => Math.min(g, next.maxGuests));
    }
  };

  const quote = serverQuote?.quote ?? estimate;
  const schedule = serverQuote?.schedule ?? null;
  const dueNow = serverQuote?.dueNowCents ?? null;
  const depositChoice = serverQuote?.depositChoice ?? null;
  // Until the guest picks, follow whatever the server says is pre-selected.
  const selected = selectedDeposit ?? depositChoice?.selected ?? 100;
  const unavailable = serverQuote && serverQuote.available === false;
  const ready = Boolean(range.checkIn && range.checkOut && !unavailable);

  const validate = () => {
    const errors = {};
    if (!range.checkIn || !range.checkOut) errors.dates = 'Choose your arrival and departure.';
    if (form.guestName.trim().length < 2) errors.guestName = 'Please tell us your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.guestEmail.trim())) {
      errors.guestEmail = 'We need a working email to send your confirmation.';
    }
    if (!acceptedTerms) errors.acceptedTerms = 'Please accept the booking terms.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const result = await createBooking({
        propertyId: property.id,
        checkIn: range.checkIn,
        checkOut: range.checkOut,
        guests,
        guestName: form.guestName.trim(),
        guestEmail: form.guestEmail.trim(),
        guestPhone: form.guestPhone.trim(),
        message: form.message.trim(),
        acceptedTerms: true,
        ...(depositChoice?.available ? { depositPercent: selected } : {}),
        ...(appliedCode ? { discountCode: appliedCode } : {}),
      });

      // Hand off to Stripe. Nothing is confirmed until their webhook says so.
      window.location.assign(result.checkoutUrl);
    } catch (err) {
      setError(err);
      setSubmitting(false);
      if (err.code === 'DATES_UNAVAILABLE') {
        setRange(EMPTY_RANGE);
        availability.refresh();
      }
    }
  };

  if (properties.loading) return <LoadingState label="Opening the calendar" />;
  if (properties.error) return <ErrorState error={properties.error} onRetry={properties.refresh} />;


  return (
    <div className="bg-bloom-100">
      {/* ------------------------------------------------------------- header */}
      <header className="border-b border-bloom-300 bg-bloom-50">
        <div className="mx-auto max-w-editorial px-6 pb-14 pt-32 lg:px-12 lg:pb-18 lg:pt-38">
          <Reveal>
            <Eyebrow>Availability</Eyebrow>
            <h1 className="mt-6 max-w-[18ch] text-display-sm lg:text-display-md">
              Find the days that suit you
            </h1>
            <p className="prose-farm mt-6">
              Two-night minimum. Payment is taken securely by Stripe — we never see your card
              details — and your dates are held for a few minutes while you check out.
            </p>
          </Reveal>
        </div>
      </header>

      {wasCancelled && (
        <div className="mx-auto max-w-editorial px-6 pt-10 lg:px-12">
          <Note tone="clay">
            You closed the payment page before finishing, so nothing was charged and the dates are
            free again. Pick them back up whenever you are ready.
          </Note>
        </div>
      )}

      <div className="mx-auto max-w-editorial px-6 py-16 lg:px-12 lg:py-22">
        <div className="grid gap-14 lg:grid-cols-[1.35fr_1fr] lg:gap-20">
          {/* ------------------------------------------------------- left column */}
          <div>
            <Eyebrow>Which home</Eyebrow>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {homes.map((home) => {
                const active = home.id === selectedId;
                return (
                  <button
                    key={home.id}
                    type="button"
                    onClick={() => selectProperty(home.id)}
                    className={`group relative overflow-hidden border text-left transition-colors duration-700 ease-gentle ${
                      active ? 'border-moss-600' : 'border-bloom-300 hover:border-moss-300'
                    }`}
                    aria-pressed={active}
                  >
                    <SmartImage
                      src={home.photos?.[0]?.url}
                      alt={home.name}
                      ratio="16 / 9"
                      className="w-full"
                      showMark={false}
                    />
                    <div className="p-5">
                      <div className="flex items-baseline justify-between gap-3">
                        <h2 className="font-display text-2xl font-light text-moss-800">
                          {home.name}
                        </h2>
                        {active && (
                          <motion.span
                            layoutId="property-marker"
                            className="block h-1.5 w-1.5 rounded-full bg-moss-600"
                          />
                        )}
                      </div>
                      <p className="mt-2 font-sans text-[13px] font-light text-ink-muted">
                        Sleeps {home.maxGuests} · from {formatMoney(home.basePriceCents)} a night
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-14">
              {availability.loading && <LoadingState label="Checking the calendar" />}
              {availability.error && (
                <ErrorState error={availability.error} onRetry={availability.refresh} />
              )}
              {!availability.loading && !availability.error && property && (
                <AvailabilityCalendar
                  unavailableNights={unavailableNights}
                  value={range}
                  onChange={(next) => {
                    setRange(next);
                    setFieldErrors((e) => ({ ...e, dates: undefined }));
                  }}
                  minNights={property.minNights}
                  maxNights={property.maxNights}
                  bookableUntil={availability.data?.bookableUntil}
                />
              )}
            </div>

            {property && (
              <div className="mt-16 border-t border-bloom-300 pt-10">
                <Eyebrow>Before you book</Eyebrow>
                <div className="mt-6 grid gap-10 sm:grid-cols-2">
                  <div>
                    <h3 className="font-display text-xl font-light text-moss-800">
                      Cancellation
                    </h3>
                    <p className="mt-3 font-sans text-[14px] font-light leading-relaxed text-ink-soft">
                      {property.cancellationPolicy}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-light text-moss-800">House rules</h3>
                    <ul className="mt-3 space-y-2">
                      {(property.houseRules ?? []).map((rule) => (
                        <li
                          key={rule}
                          className="font-sans text-[14px] font-light leading-relaxed text-ink-soft"
                        >
                          {rule}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 font-sans text-[14px] font-light text-ink-muted">
                      Check-in from {property.checkInTime} · check-out by {property.checkOutTime}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ------------------------------------------------------ right column */}
          <div>
            <form
              onSubmit={submit}
              className="lg:sticky lg:top-28 border border-bloom-300 bg-bloom-50 p-7 lg:p-9"
              noValidate
            >
              <h2 className="font-display text-2xl font-light text-moss-800">
                {property?.name ?? 'Your stay'}
              </h2>

              {/*
                Keyed so it re-mounts and fades on each change. Deliberately
                not wrapped in AnimatePresence `mode="wait"`: this line reports
                the chosen dates, and it must never be briefly absent waiting
                for an exit animation to finish.
              */}
              <motion.p
                key={range.checkIn && range.checkOut ? `${range.checkIn}-${range.checkOut}` : 'empty'}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="mt-2 font-sans text-[14px] font-light text-ink-muted"
              >
                {range.checkIn && range.checkOut
                  ? `${formatDateRange(range.checkIn, range.checkOut)} · ${pluralise(nights, 'night')}`
                  : 'Choose your dates on the calendar'}
              </motion.p>

              {fieldErrors.dates && (
                <p className="mt-3 font-sans text-[13px] text-clay-600">{fieldErrors.dates}</p>
              )}

              {/* --------------------------------------------------- price */}
              <AnimatePresence>
                {quote && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.5, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <dl className="mt-7 space-y-3 border-t border-bloom-300 pt-6">
                      <div className="flex items-baseline justify-between gap-4">
                        <dt className="font-sans text-[14px] font-light text-ink-soft">
                          {formatMoney(quote.nightlyRateCents)} × {pluralise(quote.nights, 'night')}
                        </dt>
                        <dd className="font-sans text-[15px] text-ink">
                          {formatMoney(quote.accommodationCents)}
                        </dd>
                      </div>
                      {quote.discountCents > 0 && (
                        <div className="flex items-baseline justify-between gap-4">
                          <dt className="font-sans text-[14px] font-light text-moss-700">
                            {quote.discountLabel ?? quote.discountCode}
                          </dt>
                          <dd className="font-sans text-[15px] text-moss-700">
                            −{formatMoney(quote.discountCents)}
                          </dd>
                        </div>
                      )}
                      {quote.cleaningFeeCents > 0 && (
                        <div className="flex items-baseline justify-between gap-4">
                          <dt className="font-sans text-[14px] font-light text-ink-soft">
                            Cleaning fee
                          </dt>
                          <dd className="font-sans text-[15px] text-ink">
                            {formatMoney(quote.cleaningFeeCents)}
                          </dd>
                        </div>
                      )}
                      <div className="flex items-baseline justify-between gap-4 border-t border-bloom-300 pt-4">
                        <dt className="font-display text-xl font-light text-moss-800">Stay total</dt>
                        <dd className="font-display text-2xl font-light text-moss-800">
                          {formatMoney(quote.totalPriceCents)}
                        </dd>
                      </div>
                    </dl>

                    {/*
                      Deliberately understated. A large "ENTER PROMO CODE" panel
                      makes a guest without one feel they are paying too much,
                      and sends them off to hunt for a code instead of booking.
                    */}
                    <div className="mt-6">
                      {quote.discountCents > 0 ? (
                        <p className="font-sans text-[13px] font-light text-moss-700">
                          {quote.discountCode} applied.{' '}
                          <button
                            type="button"
                            className="link-underline"
                            onClick={() => {
                              setDiscountCode('');
                              setAppliedCode('');
                            }}
                          >
                            Remove
                          </button>
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-end gap-3">
                          <label className="flex-1">
                            <span className="eyebrow text-ink-muted">Discount code</span>
                            <input
                              type="text"
                              value={discountCode}
                              onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  setAppliedCode(discountCode.trim());
                                }
                              }}
                              placeholder="If you have one"
                              maxLength={40}
                              className="mt-2 w-full border-0 border-b border-bloom-300 bg-transparent pb-2 font-sans text-[15px] uppercase tracking-wide text-ink placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-faint focus:border-moss-600 focus:outline-none"
                            />
                          </label>
                          <button
                            type="button"
                            className="btn-quiet text-moss-700"
                            onClick={() => setAppliedCode(discountCode.trim())}
                            disabled={!discountCode.trim()}
                          >
                            <span>Apply</span>
                          </button>
                        </div>
                      )}
                      {quote.discountError && appliedCode && (
                        <p className="mt-3 font-sans text-[13px] font-light text-clay-600">
                          {quote.discountError}
                        </p>
                      )}
                    </div>

                    {/*
                      How much to pay today. Only shown when the stay is far
                      enough out for a balance to be collectable — otherwise
                      there is nothing to choose and offering a choice would be
                      a lie.
                    */}
                    {depositChoice?.available && (
                      <div className="mt-7 border-t border-bloom-300 pt-6">
                        <p className="eyebrow">How much would you like to pay today?</p>

                        <div className="mt-4 grid grid-cols-2 gap-2.5">
                          {depositChoice.options.map((option) => {
                            const active = option.percent === selected;
                            return (
                              <button
                                key={option.percent}
                                type="button"
                                onClick={() => setSelectedDeposit(option.percent)}
                                aria-pressed={active}
                                className={`border px-4 py-3 text-left transition-colors duration-500 ease-gentle ${
                                  active
                                    ? 'border-moss-600 bg-moss-50'
                                    : 'border-bloom-300 hover:border-moss-300'
                                }`}
                              >
                                <span
                                  className={`block font-sans text-[11px] uppercase tracking-eyebrow ${
                                    active ? 'text-moss-700' : 'text-ink-muted'
                                  }`}
                                >
                                  {option.percent === 100 ? 'Pay in full' : `${option.percent}% now`}
                                </span>
                                <span className="mt-1.5 block font-display text-xl font-light text-moss-800">
                                  {formatMoney(option.dueNowCents)}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {schedule && schedule.length > 1 ? (
                          <div className="mt-5 border border-moss-200 bg-moss-50 px-5 py-4">
                            <div className="space-y-2.5">
                              {schedule.map((part) => (
                                <div
                                  key={part.kind}
                                  className="flex items-baseline justify-between gap-4"
                                >
                                  <span className="font-sans text-[14px] font-light text-moss-700">
                                    {part.kind === 'deposit'
                                      ? 'You pay today'
                                      : part.dueDate
                                        ? `Balance by ${formatDate(part.dueDate)}`
                                        : 'Balance later'}
                                  </span>
                                  <span className="font-sans text-[15px] text-moss-800">
                                    {formatMoney(part.amountCents)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <p className="mt-4 font-sans text-[12px] font-light leading-relaxed text-moss-600">
                              The balance is paid from your own booking page, and we will remind
                              you before it is due. The total is the same either way.
                            </p>
                          </div>
                        ) : (
                          <p className="mt-4 font-sans text-[12px] font-light leading-relaxed text-ink-muted">
                            Nothing further to pay before you arrive.
                          </p>
                        )}
                      </div>
                    )}

                    {!serverQuote && (
                      <p className="mt-3 font-sans text-[12px] font-light text-ink-faint">
                        Confirming with the farm…
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {unavailable && (
                <Note tone="clay" className="mt-6">
                  {serverQuote.message ?? 'Those nights are no longer open.'}
                </Note>
              )}

              {/* --------------------------------------------------- guests */}
              <div className="mt-8 border-t border-bloom-300 pt-7">
                <label className="field-label" htmlFor="guests">
                  Guests
                </label>
                <div className="flex items-center gap-5">
                  <button
                    type="button"
                    onClick={() => setGuests((g) => Math.max(1, g - 1))}
                    className="flex h-9 w-9 items-center justify-center border border-bloom-300 text-lg text-ink-soft transition-colors duration-500 hover:border-moss-400"
                    aria-label="Fewer guests"
                  >
                    −
                  </button>
                  <span id="guests" className="font-display text-2xl font-light text-moss-800">
                    {guests}
                  </span>
                  <button
                    type="button"
                    onClick={() => setGuests((g) => Math.min(property?.maxGuests ?? 10, g + 1))}
                    className="flex h-9 w-9 items-center justify-center border border-bloom-300 text-lg text-ink-soft transition-colors duration-500 hover:border-moss-400"
                    aria-label="More guests"
                  >
                    +
                  </button>
                  <span className="font-sans text-[13px] font-light text-ink-muted">
                    of {property?.maxGuests ?? '—'} maximum
                  </span>
                </div>
              </div>

              {/* --------------------------------------------------- details */}
              <div className="mt-8 space-y-6 border-t border-bloom-300 pt-7">
                {[
                  { name: 'guestName', label: 'Your name', type: 'text', autoComplete: 'name', required: true },
                  { name: 'guestEmail', label: 'Email', type: 'email', autoComplete: 'email', required: true },
                  { name: 'guestPhone', label: 'Phone (optional)', type: 'tel', autoComplete: 'tel' },
                ].map((field) => (
                  <div key={field.name}>
                    <label className="field-label" htmlFor={field.name}>
                      {field.label}
                    </label>
                    <input
                      id={field.name}
                      name={field.name}
                      type={field.type}
                      autoComplete={field.autoComplete}
                      className="field-input"
                      value={form[field.name]}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, [field.name]: e.target.value }));
                        setFieldErrors((errs) => ({ ...errs, [field.name]: undefined }));
                      }}
                      aria-invalid={Boolean(fieldErrors[field.name])}
                      aria-describedby={fieldErrors[field.name] ? `${field.name}-error` : undefined}
                    />
                    {fieldErrors[field.name] && (
                      <p id={`${field.name}-error`} className="mt-2 font-sans text-[13px] text-clay-600">
                        {fieldErrors[field.name]}
                      </p>
                    )}
                  </div>
                ))}

                <div>
                  <label className="field-label" htmlFor="message">
                    Anything we should know?
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={3}
                    className="field-input resize-none"
                    placeholder="Small children, a dietary thing, an arrival time…"
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  />
                </div>
              </div>

              {/* --------------------------------------------------- terms */}
              <label className="mt-8 flex cursor-pointer items-start gap-3 border-t border-bloom-300 pt-7">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => {
                    setAcceptedTerms(e.target.checked);
                    setFieldErrors((errs) => ({ ...errs, acceptedTerms: undefined }));
                  }}
                  className="mt-1 h-4 w-4 shrink-0 accent-moss-700"
                />
                <span className="font-sans text-[13px] font-light leading-relaxed text-ink-soft">
                  I have read the cancellation policy and the house rules, and I accept them.
                </span>
              </label>
              {fieldErrors.acceptedTerms && (
                <p className="mt-2 font-sans text-[13px] text-clay-600">
                  {fieldErrors.acceptedTerms}
                </p>
              )}

              {error && !unavailable && (
                <Note tone="clay" className="mt-6">
                  {error.message}
                </Note>
              )}

              <WalletBadge className="mt-8" />

              <button
                type="submit"
                disabled={!ready || submitting}
                className="btn-solid mt-5 w-full"
              >
                {submitting
                  ? 'Taking you to Stripe…'
                  : dueNow != null
                    ? `Continue to payment — ${formatMoney(dueNow)}`
                    : 'Continue to payment'}
              </button>

              <p className="mt-5 text-center font-sans text-[12px] font-light leading-relaxed text-ink-faint">
                You will be sent to Stripe to pay. Nothing is charged until you complete it there,
                and your dates are held while you do.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
