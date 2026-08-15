import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  adminBooking,
  adminCancelBooking,
  adminResendConfirmation,
  adminUpdateBooking,
} from '../lib/api.js';
import useAsync from '../hooks/useAsync.js';
import { ErrorState, LoadingState } from '../components/ui.jsx';
import {
  AdminPage,
  Banner,
  Button,
  Card,
  Field,
  Input,
  StatusPill,
  Textarea,
} from './components.jsx';
import { formatDate, formatDateRange, formatMoney, pluralise } from '../lib/format.js';

function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-bloom-300 py-3.5 last:border-0">
      <span className="eyebrow">{label}</span>
      <span className="text-right font-sans text-[15px] font-light text-ink">{children}</span>
    </div>
  );
}

export default function BookingDetail() {
  const { id } = useParams();
  const { data, loading, error, refresh } = useAsync(() => adminBooking(id), [id]);

  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [refundOverride, setRefundOverride] = useState('');

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={refresh} />;

  const { booking, refundIfCancelledNowCents } = data;
  const property = booking.propertyId ?? {};

  const paid = (booking.payments ?? [])
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amountCents - (p.amountRefundedCents ?? 0), 0);
  const outstanding = (booking.payments ?? [])
    .filter((p) => p.status === 'due')
    .reduce((sum, p) => sum + p.amountCents, 0);
  const noteValue = notes ?? booking.adminNotes ?? '';

  const run = async (action, successMessage) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice({ tone: 'moss', text: successMessage });
      await refresh();
    } catch (err) {
      setNotice({ tone: 'clay', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const doCancel = () => {
    const override = refundOverride.trim();
    const payload = { reason: cancelReason };
    if (override !== '') {
      const cents = Math.round(Number(override) * 100);
      if (!Number.isFinite(cents) || cents < 0) {
        setNotice({ tone: 'clay', text: 'That refund amount is not a number.' });
        return;
      }
      payload.refundCents = cents;
    }
    run(
      () => adminCancelBooking(id, payload),
      'Booking cancelled. The guest has been emailed and the dates are free again.'
    ).then(() => setCancelOpen(false));
  };

  return (
    <AdminPage
      title={booking.guestName}
      description={`${property.name ?? 'Unknown home'} · ${formatDateRange(booking.checkIn, booking.checkOut)}`}
      actions={
        <>
          <Link
            to="/admin/bookings"
            className="font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted hover:text-ink"
          >
            All bookings
          </Link>
          <StatusPill status={booking.status} />
        </>
      }
    >
      {notice && (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-5 font-display text-xl font-light text-moss-800">The stay</h2>
            <Row label="Home">{property.name ?? '—'}</Row>
            <Row label="Check-in">
              {formatDate(booking.checkIn)} from {property.checkInTime ?? '4:00 PM'}
            </Row>
            <Row label="Check-out">
              {formatDate(booking.checkOut)} by {property.checkOutTime ?? '11:00 AM'}
            </Row>
            <Row label="Nights">{pluralise(booking.nights, 'night')}</Row>
            <Row label="Guests">{booking.guests}</Row>
            <Row label="Reference">{booking._id.slice(-8).toUpperCase()}</Row>
            <Row label="Booked">{formatDate(booking.createdAt)}</Row>
            <Row label="Source">{booking.source}</Row>
          </Card>

          <Card>
            <h2 className="mb-5 font-display text-xl font-light text-moss-800">Payment</h2>
            <Row label={`${formatMoney(booking.nightlyRateCents)} × ${booking.nights}`}>
              {formatMoney(booking.accommodationCents, booking.currency)}
            </Row>
            {booking.cleaningFeeCents > 0 && (
              <Row label="Cleaning fee">
                {formatMoney(booking.cleaningFeeCents, booking.currency)}
              </Row>
            )}
            <Row label="Total">{formatMoney(booking.totalPriceCents, booking.currency)}</Row>
            <Row label="Paid">
              {booking.paidAt ? formatDate(booking.paidAt) : 'Not yet paid'}
            </Row>
            {paid != null && <Row label="Collected">{formatMoney(paid, booking.currency)}</Row>}
            {outstanding > 0 && (
              <Row label="Outstanding">
                <span className="text-clay-600">{formatMoney(outstanding, booking.currency)}</span>
              </Row>
            )}
            {booking.amountRefundedCents > 0 && (
              <Row label="Refunded">
                {formatMoney(booking.amountRefundedCents, booking.currency)}
              </Row>
            )}
            {booking.stripePaymentIntentId && (
              <Row label="Stripe payment">
                <code className="font-mono text-[12px] text-ink-muted">
                  {booking.stripePaymentIntentId}
                </code>
              </Row>
            )}
            {booking.cancelledAt && (
              <>
                <Row label="Cancelled">
                  {formatDate(booking.cancelledAt)} by {booking.cancelledBy}
                </Row>
                {booking.cancellationReason && (
                  <Row label="Reason">{booking.cancellationReason}</Row>
                )}
              </>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {booking.payments?.length > 0 && (
            <Card>
              <h2 className="mb-5 font-display text-xl font-light text-moss-800">
                Payment schedule
              </h2>
              <div className="divide-y divide-bloom-300">
                {booking.payments.map((payment) => (
                  <div
                    key={payment._id}
                    className="flex items-baseline justify-between gap-4 py-3.5"
                  >
                    <div>
                      <p className="font-sans text-[15px] text-ink">
                        {payment.kind === 'deposit'
                          ? 'Deposit'
                          : payment.kind === 'balance'
                            ? 'Balance'
                            : 'Payment in full'}
                      </p>
                      <p className="mt-0.5 font-sans text-[12px] font-light text-ink-muted">
                        {payment.paidAt
                          ? `Paid ${formatDate(payment.paidAt)}`
                          : payment.dueDate
                            ? `Due ${formatDate(payment.dueDate)}`
                            : 'Due'}
                        {payment.reminderSentAt && ' · reminder sent'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-sans text-[15px] text-ink">
                        {formatMoney(payment.amountCents, booking.currency)}
                      </p>
                      <StatusPill status={payment.status === 'due' ? 'pending' : payment.status} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <h2 className="mb-5 font-display text-xl font-light text-moss-800">Agreement</h2>
            {booking.agreement?.acceptedAt ? (
              <>
                <Row label="Signed by">{booking.agreement.signatureName}</Row>
                <Row label="Signed on">{formatDate(booking.agreement.acceptedAt)}</Row>
                <Row label="Version">{booking.agreement.version}</Row>
                <Row label="From">
                  <code className="font-mono text-[12px] text-ink-muted">
                    {booking.agreement.ip || '—'}
                  </code>
                </Row>
              </>
            ) : (
              <p className="font-sans text-[14px] font-light text-ink-muted">
                Not signed yet. Arrival details stay locked until it is.
              </p>
            )}
          </Card>

          <Card>
            <h2 className="mb-5 font-display text-xl font-light text-moss-800">Guest</h2>
            <Row label="Name">{booking.guestName}</Row>
            <Row label="Email">
              <a href={`mailto:${booking.guestEmail}`} className="link-underline">
                {booking.guestEmail}
              </a>
            </Row>
            <Row label="Phone">{booking.guestPhone || '—'}</Row>
            {booking.message && (
              <div className="pt-5">
                <p className="eyebrow">Their message</p>
                <p className="mt-3 font-sans text-[15px] font-light italic leading-relaxed text-ink-soft">
                  “{booking.message}”
                </p>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-5 font-display text-xl font-light text-moss-800">Private notes</h2>
            <Textarea
              rows={4}
              value={noteValue}
              maxLength={4000}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Only you can see this."
            />
            <Button
              className="mt-5"
              variant="quiet"
              disabled={busy || notes === null}
              onClick={() => run(() => adminUpdateBooking(id, { adminNotes: noteValue }), 'Notes saved.')}
            >
              Save notes
            </Button>
          </Card>

          <Card>
            <h2 className="mb-5 font-display text-xl font-light text-moss-800">Actions</h2>

            {booking.status === 'confirmed' && (
              <Button
                variant="quiet"
                disabled={busy}
                onClick={() =>
                  run(
                    () => adminResendConfirmation(id),
                    'A fresh confirmation has been sent. The previous manage link no longer works.'
                  )
                }
              >
                Resend confirmation email
              </Button>
            )}

            {booking.status !== 'cancelled' && (
              <div className="mt-7 border-t border-bloom-300 pt-6">
                {!cancelOpen ? (
                  <>
                    <p className="font-sans text-[14px] font-light leading-relaxed text-ink-soft">
                      Cancelling now would refund{' '}
                      <strong className="font-normal text-moss-700">
                        {formatMoney(refundIfCancelledNowCents, booking.currency)}
                      </strong>{' '}
                      under the current policy.
                    </p>
                    <Button
                      variant="ghost"
                      className="mt-4 !text-clay-600"
                      onClick={() => setCancelOpen(true)}
                    >
                      Cancel this booking
                    </Button>
                  </>
                ) : (
                  <div className="border border-clay-200 bg-clay-100 p-5">
                    <p className="font-display text-lg font-light text-ink">Cancel and refund</p>

                    <Field label="Reason (sent to nobody, kept for your records)" className="mt-5">
                      <Textarea
                        rows={2}
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                      />
                    </Field>

                    <Field
                      label="Refund amount"
                      hint={`Leave blank to use the policy amount (${formatMoney(refundIfCancelledNowCents, booking.currency)}).`}
                      className="mt-5"
                    >
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={(refundIfCancelledNowCents / 100).toFixed(2)}
                        value={refundOverride}
                        onChange={(e) => setRefundOverride(e.target.value)}
                      />
                    </Field>

                    <div className="mt-6 flex flex-wrap items-center gap-5">
                      <Button variant="danger" disabled={busy} onClick={doCancel}>
                        {busy ? 'Cancelling…' : 'Cancel booking'}
                      </Button>
                      <Button variant="ghost" onClick={() => setCancelOpen(false)}>
                        Keep it
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AdminPage>
  );
}
