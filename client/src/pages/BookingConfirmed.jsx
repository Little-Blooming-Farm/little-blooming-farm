import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';

import { getBookingBySession } from '../lib/api.js';
import Reveal from '../components/Reveal.jsx';
import { Eyebrow, LoadingState, Note } from '../components/ui.jsx';
import { EASE } from '../lib/motion.js';
import { formatDateRange, formatMoney, pluralise } from '../lib/format.js';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 25_000;

export default function BookingConfirmed() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [booking, setBooking] = useState(null);
  const [settled, setSettled] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState(null);
  const startedAt = useRef(Date.now());

  /**
   * Stripe redirects the browser back the instant payment succeeds, which is
   * often a moment *before* their webhook reaches our server. So this page
   * polls its own API for the confirmed state rather than assuming success
   * from the redirect — the redirect is not evidence of payment.
   */
  useEffect(() => {
    if (!sessionId) return undefined;
    let cancelled = false;
    let timer;

    const poll = async () => {
      try {
        const result = await getBookingBySession(sessionId);
        if (cancelled) return;

        setBooking(result.booking);
        setError(null);

        if (result.settled) {
          setSettled(true);
          return;
        }
        if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
          setTimedOut(true);
          return;
        }
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        // A 404 right after redirect usually means the webhook is still in
        // flight; keep trying until the timeout rather than crying wolf.
        if (err.status === 404 && Date.now() - startedAt.current < POLL_TIMEOUT_MS) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }
        setError(err);
      }
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId]);

  if (!sessionId) {
    return (
      <section className="flex min-h-[70vh] items-center bg-bloom-100">
        <div className="mx-auto max-w-2xl px-6 py-30 text-center">
          <h1 className="text-display-sm">Nothing to confirm here</h1>
          <p className="prose-farm mx-auto mt-6 text-center">
            This page appears after a payment. If you were mid-booking, start again from the
            calendar.
          </p>
          <Link to="/book" className="btn-quiet mt-10 text-moss-700">
            <span>Back to the calendar</span>
          </Link>
        </div>
      </section>
    );
  }

  if (!booking && !error) return <LoadingState label="Confirming with Stripe" />;

  const confirmed = settled && booking?.status === 'confirmed';

  return (
    <section className="bg-bloom-50">
      <div className="mx-auto max-w-3xl px-6 pb-30 pt-32 lg:pt-38">
        <Reveal>
          <Eyebrow>{confirmed ? 'Confirmed' : 'Almost there'}</Eyebrow>

          <motion.h1
            className="mt-7 text-display-sm lg:text-display-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: EASE }}
          >
            {confirmed ? 'Your stay is booked' : 'We are confirming your payment'}
          </motion.h1>

          <p className="prose-farm mt-7">
            {confirmed
              ? `Thank you, ${(booking.guestName ?? '').split(' ')[0]}. A confirmation is on its way to ${booking.guestEmail}, with a private link to your booking page — that is where you sign the rental agreement${booking.balanceDueCents > 0 ? ', settle the balance' : ''} and find your arrival details closer to the time.`
              : 'Stripe has taken your payment and we are just finishing up on our side. This usually takes a few seconds.'}
          </p>
        </Reveal>

        {booking && (
          <Reveal delay={0.12}>
            <dl className="mt-14 divide-y divide-bloom-300 border-y border-bloom-300">
              {[
                ['Home', booking.property?.name],
                ['Dates', formatDateRange(booking.checkIn, booking.checkOut)],
                ['Nights', pluralise(booking.nights, 'night')],
                ['Guests', String(booking.guests)],
                ['Check-in', booking.property?.checkInTime],
                ['Check-out', booking.property?.checkOutTime],
                ['Stay total', formatMoney(booking.totalPriceCents, booking.currency)],
                // With a deposit schedule, a bare "Total" reads as though the
                // whole amount was just charged. Show what actually moved.
                ['Paid today', formatMoney(booking.amountPaidCents, booking.currency)],
                ...(booking.balanceDueCents > 0
                  ? [['Balance due later', formatMoney(booking.balanceDueCents, booking.currency)]]
                  : []),
                ['Reference', booking.reference],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-6 py-4">
                    <dt className="eyebrow">{label}</dt>
                    <dd className="text-right font-sans text-[16px] font-light text-ink">
                      {value}
                    </dd>
                  </div>
                ))}
            </dl>
          </Reveal>
        )}

        {timedOut && !confirmed && (
          <Note tone="gold" className="mt-10">
            Your payment went through, but our confirmation is taking longer than usual. Nothing is
            lost — the confirmation email will arrive shortly. If it has not appeared within the
            hour, write to us and quote reference {booking?.reference ?? sessionId.slice(-8)}.
          </Note>
        )}

        {error && (
          <Note tone="clay" className="mt-10">
            {error.message} Your payment is safe — if you were charged, the confirmation email will
            still arrive.
          </Note>
        )}

        <Reveal delay={0.2}>
          <div className="mt-16">
            <h2 className="font-display text-2xl font-light text-moss-800">What happens next</h2>
            <ol className="mt-7 space-y-6">
              {[
                'A confirmation email lands in your inbox, with a private link to view or cancel your stay.',
                'A few days before you arrive, we send the gate code, the wifi, and directions that actually work.',
                'On the day, come whenever suits after check-in. Cowboy will meet you at the gate.',
              ].map((step, index) => (
                <li key={step} className="flex gap-5">
                  <span className="mt-1 font-display text-xl font-light text-gold-500">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <p className="font-sans text-[16px] font-light leading-relaxed text-ink-soft">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>

        <Reveal delay={0.28}>
          <div className="mt-16 flex flex-wrap items-center gap-8 border-t border-bloom-300 pt-10">
            <Link to="/experiences" className="btn-quiet text-moss-700">
              <span>Plan a little</span>
            </Link>
            <Link
              to="/local-guide"
              className="link-underline font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted"
            >
              Read the local guide
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
