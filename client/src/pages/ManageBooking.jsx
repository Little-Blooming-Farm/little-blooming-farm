import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import {
  acceptAgreement,
  cancelManagedBooking,
  getManagedBooking,
  payBalance,
} from '../lib/api.js';
import useAsync from '../hooks/useAsync.js';
import Reveal from '../components/Reveal.jsx';
import WalletBadge from '../components/WalletBadge.jsx';
import { ErrorState, Eyebrow, LoadingState, Note, Paragraphs } from '../components/ui.jsx';
import { EASE } from '../lib/motion.js';
import { formatDate, formatDateRange, formatMoney, pluralise } from '../lib/format.js';

const STATUS_COPY = {
  pending: {
    label: 'Awaiting payment',
    dot: 'bg-gold-400',
    note: 'This booking has not been paid for yet. If you closed the payment page, the dates will be released shortly and you can start again.',
  },
  confirmed: { label: 'Confirmed', dot: 'bg-moss-500', note: null },
  cancelled: { label: 'Cancelled', dot: 'bg-clay-400', note: 'This booking has been cancelled.' },
};

function Section({ id, eyebrow, title, children, className = '' }) {
  return (
    <section id={id} className={`scroll-mt-28 border-t border-bloom-300 pt-10 ${className}`}>
      <Reveal>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="mt-5 font-display text-2xl font-light text-moss-800 lg:text-3xl">{title}</h2>
        <div className="mt-7">{children}</div>
      </Reveal>
    </section>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-bloom-300 py-3.5 last:border-0">
      <span className="eyebrow shrink-0">{label}</span>
      <span className="text-right font-sans text-[15px] font-light text-ink">{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ payments */

function Payments({ booking, token, onPaid }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const outstanding = booking.balanceDueCents > 0;

  const startPayment = async () => {
    setBusy(true);
    setError(null);
    try {
      const { checkoutUrl } = await payBalance(token);
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(err);
      setBusy(false);
      if (err.code === 'NOTHING_DUE') onPaid?.();
    }
  };

  return (
    <>
      <div className="divide-y divide-bloom-300 border-y border-bloom-300">
        {booking.payments.map((payment) => {
          const label =
            payment.kind === 'deposit'
              ? 'Deposit'
              : payment.kind === 'balance'
                ? 'Balance'
                : 'Payment in full';
          return (
            <div key={payment.id} className="flex items-baseline justify-between gap-5 py-4">
              <div className="min-w-0">
                <p className="font-sans text-[15px] text-ink">{label}</p>
                <p className="mt-0.5 font-sans text-[13px] font-light text-ink-muted">
                  {payment.status === 'paid' && payment.paidAt
                    ? `Paid ${formatDate(payment.paidAt)}`
                    : payment.status === 'due' && payment.dueDate
                      ? `Due by ${formatDate(payment.dueDate)}`
                      : payment.status === 'due'
                        ? 'Due now'
                        : payment.status === 'refunded'
                          ? 'Refunded'
                          : 'No longer payable'}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-sans text-[15px] text-ink">
                  {formatMoney(payment.amountCents, booking.currency)}
                </p>
                <span
                  className={`mt-1 inline-block border px-2 py-0.5 font-sans text-[10px] uppercase tracking-label ${
                    payment.status === 'paid'
                      ? 'border-moss-300 bg-moss-50 text-moss-700'
                      : payment.status === 'due'
                        ? 'border-gold-300 bg-[#FBF4E2] text-gold-600'
                        : 'border-bloom-300 bg-bloom-100 text-ink-muted'
                  }`}
                >
                  {payment.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-7 flex flex-wrap items-baseline justify-between gap-4">
        <span className="font-display text-xl font-light text-moss-800">
          {outstanding ? 'Still to pay' : 'Paid in full'}
        </span>
        <span className="font-display text-2xl font-light text-moss-800">
          {formatMoney(outstanding ? booking.balanceDueCents : booking.amountPaidCents, booking.currency)}
        </span>
      </div>

      {outstanding && booking.status !== 'cancelled' && (
        <div className="mt-8">
          <WalletBadge className="mb-6" />
          {error && (
            <Note tone="clay" className="mb-5">
              {error.message}
            </Note>
          )}
          <button type="button" onClick={startPayment} disabled={busy} className="btn-solid w-full">
            {busy
              ? 'Opening payment…'
              : `Pay ${formatMoney(booking.balanceDueCents, booking.currency)} now`}
          </button>
          <p className="mt-4 text-center font-sans text-[12px] font-light text-ink-faint">
            You will be sent to Stripe. We never see your card details.
          </p>
        </div>
      )}
    </>
  );
}

/* ----------------------------------------------------------------- agreement */

function Agreement({ agreement, booking, token, onSigned }) {
  const [signature, setSignature] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  if (agreement.accepted) {
    return (
      <>
        <Note tone="moss">
          Signed by {agreement.signatureName} on {formatDate(agreement.acceptedAt)}.
        </Note>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="link-underline mt-6 font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted"
        >
          {expanded ? 'Hide the agreement' : 'Read the agreement again'}
        </button>
        {expanded && (
          <div className="mt-6 max-h-[28rem] overflow-y-auto border border-bloom-300 bg-bloom-100 p-6">
            <Paragraphs text={agreement.body} />
          </div>
        )}
      </>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await acceptAgreement(token, signature.trim(), agreement.version);
      onSigned();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="max-h-[28rem] overflow-y-auto border border-bloom-300 bg-bloom-100 p-6">
        <Paragraphs text={agreement.body} />
      </div>

      <form onSubmit={submit} className="mt-8">
        <label className="field-label" htmlFor="signature">
          Type your full name to sign
        </label>
        <input
          id="signature"
          className="field-input"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder={booking.guestName}
          autoComplete="name"
          required
        />
        <p className="mt-2 font-sans text-[12px] font-light text-ink-faint">
          Exactly as it appears on the booking: {booking.guestName}
        </p>

        {error && (
          <Note tone="clay" className="mt-5">
            {error.message}
          </Note>
        )}

        <button type="submit" disabled={busy || signature.trim().length < 2} className="btn-solid mt-7">
          {busy ? 'Signing…' : 'Sign the agreement'}
        </button>
      </form>
    </>
  );
}

/* -------------------------------------------------------------- arrival info */

function ArrivalInfo({ arrival, property }) {
  if (!arrival.released) {
    return (
      <Note tone="gold">
        <strong className="font-normal">Not yet.</strong> {arrival.reason}
      </Note>
    );
  }

  const info = property.arrivalInfo ?? {};
  const codes = [
    ['Gate code', info.gateCode],
    ['Door code', info.doorCode],
    ['Wifi network', info.wifiNetwork],
    ['Wifi password', info.wifiPassword],
  ].filter(([, value]) => value);

  return (
    <>
      {codes.length > 0 && (
        <div className="mb-9 grid gap-4 sm:grid-cols-2">
          {codes.map(([label, value]) => (
            <div key={label} className="border border-moss-200 bg-moss-50 px-5 py-4">
              <p className="eyebrow text-moss-600">{label}</p>
              <p className="mt-2 font-mono text-xl text-moss-800">{value}</p>
            </div>
          ))}
        </div>
      )}

      {property.address && (
        <div className="mb-8">
          <p className="eyebrow">Address</p>
          <p className="mt-2 font-sans text-[16px] font-light text-ink-soft">{property.address}</p>
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(property.address)}`}
            target="_blank"
            rel="noreferrer noopener"
            className="link-underline mt-2 inline-block font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted"
          >
            Open in maps
          </a>
        </div>
      )}

      {[
        ['Getting here', info.directions],
        ['Parking', info.parking],
        ['Checking in', info.checkInInstructions],
        ['Checking out', info.checkOutInstructions],
        ['If you need us', info.emergencyContact],
      ]
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <div key={label} className="mb-7">
            <p className="eyebrow">{label}</p>
            <Paragraphs text={value} className="mt-3" />
          </div>
        ))}

      {info.houseManual?.length > 0 && (
        <div className="mt-10 border-t border-bloom-300 pt-8">
          <p className="eyebrow">The house manual</p>
          <dl className="mt-6 space-y-6">
            {info.houseManual.map((entry) => (
              <div key={entry.title}>
                <dt className="font-display text-xl font-light text-moss-800">{entry.title}</dt>
                <dd className="mt-2 font-sans text-[15px] font-light leading-relaxed text-ink-soft">
                  {entry.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------------- page */

export default function ManageBooking() {
  const { token } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, loading, error, refresh } = useAsync(() => getManagedBooking(token), [token]);

  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [result, setResult] = useState(null);

  const paymentOutcome = searchParams.get('payment');

  /**
   * Returning from Stripe, the webhook may still be in flight. Poll briefly so
   * the balance flips to paid without the guest having to reload — and clear
   * the query param so a refresh does not repeat the message.
   */
  useEffect(() => {
    if (paymentOutcome !== 'success') return undefined;

    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      const fresh = await refresh();
      if (attempts >= 6 || fresh?.booking?.balanceDueCents === 0) {
        clearInterval(timer);
      }
    }, 1800);

    return () => clearInterval(timer);
  }, [paymentOutcome, refresh]);

  if (loading && !data) return <LoadingState label="Finding your booking" />;

  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={error.status === 404 ? undefined : refresh}
        title={error.status === 404 ? 'This link is no longer valid' : 'That did not load'}
      />
    );
  }

  const { booking, cancellation, agreement, arrival } = data;
  const status = STATUS_COPY[booking.status] ?? STATUS_COPY.pending;
  const needsSignature = agreement.required && !agreement.accepted;

  const doCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      const response = await cancelManagedBooking(token, reason);
      setResult(response);
      setConfirming(false);
      refresh();
    } catch (err) {
      setCancelError(err);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <section className="bg-bloom-50">
      <div className="mx-auto max-w-3xl px-6 pb-30 pt-32 lg:pt-38">
        {/* ---------------------------------------------------------- header */}
        <Reveal>
          <Eyebrow>Your booking</Eyebrow>
          <h1 className="mt-7 text-display-sm lg:text-display-md">
            {booking.property?.name ?? 'Your stay'}
          </h1>
          <p className="mt-5 font-display text-xl font-light italic text-moss-600">
            {formatDateRange(booking.checkIn, booking.checkOut)}
          </p>

          <div className="mt-7 inline-flex items-center gap-3 border border-bloom-300 px-4 py-2">
            <span className={`block h-1.5 w-1.5 rounded-full ${status.dot}`} />
            <span className="font-sans text-[11px] uppercase tracking-eyebrow text-ink-soft">
              {status.label}
            </span>
          </div>
        </Reveal>

        {/* --------------------------------------------------------- notices */}
        <AnimatePresence>
          {paymentOutcome === 'success' && booking.balanceDueCents === 0 && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
              <Note tone="moss" className="mt-8">
                Payment received — your stay is settled in full. Thank you.
              </Note>
            </motion.div>
          )}
          {paymentOutcome === 'success' && booking.balanceDueCents > 0 && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
              <Note tone="gold" className="mt-8">
                We are confirming your payment with Stripe. This usually takes a few seconds.
              </Note>
            </motion.div>
          )}
          {paymentOutcome === 'cancelled' && (
            <Note tone="clay" className="mt-8">
              You closed the payment page, so nothing was charged. The balance is still here
              whenever you are ready.
            </Note>
          )}
        </AnimatePresence>

        {status.note && (
          <Note tone={booking.status === 'cancelled' ? 'clay' : 'gold'} className="mt-8">
            {status.note}
          </Note>
        )}

        {result && (
          <Note tone="moss" className="mt-8">
            {result.message}
            {result.refundCents > 0 && (
              <>
                {' '}
                A refund of {formatMoney(result.refundCents, booking.currency)} has been issued and
                typically lands within 5–10 business days.
              </>
            )}
          </Note>
        )}

        {/* --------------------------------------------------- what to do next */}
        {booking.status === 'confirmed' && (needsSignature || booking.balanceDueCents > 0) && (
          <Reveal className="mt-10">
            <div className="border border-gold-200 bg-[#FBF4E2] px-6 py-5">
              <p className="eyebrow text-gold-600">Before you arrive</p>
              <ul className="mt-4 space-y-2">
                {needsSignature && (
                  <li className="font-sans text-[15px] font-light text-ink-soft">
                    <a href="#agreement" className="link-underline">
                      Sign the rental agreement
                    </a>
                  </li>
                )}
                {booking.balanceDueCents > 0 && (
                  <li className="font-sans text-[15px] font-light text-ink-soft">
                    <a href="#payments" className="link-underline">
                      Settle the balance of{' '}
                      {formatMoney(booking.balanceDueCents, booking.currency)}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          </Reveal>
        )}

        {/* ---------------------------------------------------- reservation */}
        <div className="mt-14 space-y-14">
          <Section id="reservation" eyebrow="Reservation" title="Your stay">
            <div className="divide-y divide-bloom-300 border-y border-bloom-300">
              <DetailRow label="Reference">{booking.reference}</DetailRow>
              <DetailRow label="Guest">{booking.guestName}</DetailRow>
              <DetailRow label="Email">{booking.guestEmail}</DetailRow>
              <DetailRow label="Guests">{booking.guests}</DetailRow>
              <DetailRow label="Nights">{pluralise(booking.nights, 'night')}</DetailRow>
              <DetailRow label="Check-in">
                {formatDate(booking.checkIn)} from {booking.property?.checkInTime ?? '4:00 PM'}
              </DetailRow>
              <DetailRow label="Check-out">
                {formatDate(booking.checkOut)} by {booking.property?.checkOutTime ?? '11:00 AM'}
              </DetailRow>
              <DetailRow
                label={`${formatMoney(booking.nightlyRateCents, booking.currency)} × ${pluralise(booking.nights, 'night')}`}
              >
                {formatMoney(booking.accommodationCents, booking.currency)}
              </DetailRow>
              {booking.cleaningFeeCents > 0 && (
                <DetailRow label="Cleaning fee">
                  {formatMoney(booking.cleaningFeeCents, booking.currency)}
                </DetailRow>
              )}
              <DetailRow label="Stay total">
                {formatMoney(booking.totalPriceCents, booking.currency)}
              </DetailRow>
              {booking.amountRefundedCents > 0 && (
                <DetailRow label="Refunded">
                  {formatMoney(booking.amountRefundedCents, booking.currency)}
                </DetailRow>
              )}
            </div>
          </Section>

          {/* ------------------------------------------------------ payments */}
          <Section id="payments" eyebrow="Payments" title="What you have paid">
            <Payments booking={booking} token={token} onPaid={refresh} />
          </Section>

          {/* ----------------------------------------------------- agreement */}
          {agreement.required && (
            <Section
              id="agreement"
              eyebrow="Paperwork"
              title={agreement.title || 'Rental agreement'}
            >
              <Agreement
                agreement={agreement}
                booking={booking}
                token={token}
                onSigned={refresh}
              />
            </Section>
          )}

          {/* -------------------------------------------------- arrival info */}
          <Section id="arrival" eyebrow="Arriving" title="Everything you need">
            <ArrivalInfo arrival={arrival} property={booking.property ?? {}} />
          </Section>

          {/* --------------------------------------------- property & policy */}
          <Section id="policies" eyebrow="Good to know" title="House rules & cancellation">
            {booking.property?.houseRules?.length > 0 && (
              <ul className="mb-8 space-y-3">
                {booking.property.houseRules.map((rule) => (
                  <li
                    key={rule}
                    className="font-sans text-[15px] font-light leading-relaxed text-ink-soft"
                  >
                    {rule}
                  </li>
                ))}
              </ul>
            )}
            {booking.property?.cancellationPolicy && (
              <Paragraphs text={booking.property.cancellationPolicy} />
            )}
          </Section>

          {/* -------------------------------------------------- cancellation */}
          {cancellation?.canCancel && booking.status !== 'cancelled' && (
            <Section id="cancel" eyebrow="If plans change" title="Cancel this booking">
              {cancellation.refundIfCancelledNowCents > 0 ? (
                <p className="font-sans text-[15px] font-light leading-relaxed text-ink-soft">
                  If you cancel today you would be refunded{' '}
                  <strong className="font-normal text-moss-700">
                    {formatMoney(cancellation.refundIfCancelledNowCents, booking.currency)}
                  </strong>
                  .
                </p>
              ) : (
                <p className="font-sans text-[15px] font-light leading-relaxed text-ink-soft">
                  These dates are inside the non-refundable window, so cancelling now would not
                  return anything. If something has gone wrong, write to us before you cancel — we
                  would rather hear from you.
                </p>
              )}

              <AnimatePresence mode="wait">
                {!confirming ? (
                  <motion.button
                    key="start"
                    type="button"
                    onClick={() => setConfirming(true)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="link-underline mt-6 inline-block font-sans text-[11px] uppercase tracking-eyebrow text-clay-600"
                  >
                    Cancel this booking
                  </motion.button>
                ) : (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.5, ease: EASE }}
                    className="mt-8 border border-clay-200 bg-clay-100 p-6"
                  >
                    <p className="font-display text-xl font-light text-ink">Cancel this booking?</p>
                    <p className="mt-2 font-sans text-[14px] font-light leading-relaxed text-ink-soft">
                      This cannot be undone, and the dates go back on the calendar straight away.
                    </p>

                    <label className="field-label mt-6" htmlFor="reason">
                      Anything you would like us to know? (optional)
                    </label>
                    <textarea
                      id="reason"
                      rows={2}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="field-input resize-none"
                      maxLength={1000}
                    />

                    {cancelError && (
                      <p className="mt-4 font-sans text-[13px] text-clay-600">
                        {cancelError.message}
                      </p>
                    )}

                    <div className="mt-7 flex flex-wrap items-center gap-6">
                      <button
                        type="button"
                        onClick={doCancel}
                        disabled={cancelling}
                        className="btn-solid !bg-clay-500 hover:!bg-clay-600"
                      >
                        {cancelling ? 'Cancelling…' : 'Yes, cancel it'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(false)}
                        className="link-underline font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted"
                      >
                        Keep my booking
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Section>
          )}
        </div>

        {/* ---------------------------------------------------------- footer */}
        <Reveal>
          <div className="mt-16 flex flex-wrap items-center gap-8 border-t border-bloom-300 pt-10">
            <Link to="/local-guide" className="btn-quiet text-moss-700">
              <span>The local guide</span>
            </Link>
            <Link
              to="/experiences"
              className="link-underline font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted"
            >
              What to do while you are here
            </Link>
            {booking.property?.whatsappNumber && (
              <a
                href={`https://wa.me/${booking.property.whatsappNumber.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer noopener"
                className="link-underline font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted"
              >
                Message us on WhatsApp
              </a>
            )}
          </div>
          <p className="mt-8 font-sans text-[12px] font-light text-ink-faint">
            Keep this link private — anyone who has it can view this booking, and once your arrival
            details appear it contains the codes to the house.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
