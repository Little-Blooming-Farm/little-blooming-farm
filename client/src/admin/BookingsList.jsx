import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { adminBookings, adminProperties } from '../lib/api.js';
import useAsync from '../hooks/useAsync.js';
import { ErrorState, LoadingState } from '../components/ui.jsx';
import {
  AdminPage,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  StatusPill,
  Table,
  Td,
} from './components.jsx';
import { formatDate, formatDateRange, formatMoney } from '../lib/format.js';

const EMPTY_FILTERS = { propertyId: '', status: '', from: '', to: '', q: '' };

export default function BookingsList() {
  const properties = useAsync(() => adminProperties(), []);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(applied).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    params.set('page', String(page));
    params.set('limit', '25');
    return `?${params.toString()}`;
  }, [applied, page]);

  const bookings = useAsync(() => adminBookings(query), [query]);

  const apply = (event) => {
    event.preventDefault();
    setPage(1);
    setApplied(filters);
  };

  const reset = () => {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  };

  if (bookings.loading && !bookings.data) return <LoadingState />;
  if (bookings.error) return <ErrorState error={bookings.error} onRetry={bookings.refresh} />;

  const rows = bookings.data?.bookings ?? [];
  const pagination = bookings.data?.pagination;

  return (
    <AdminPage
      title="Bookings"
      description={pagination ? `${pagination.total} in total` : undefined}
    >
      <Card className="mb-7">
        <form onSubmit={apply} className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="Home">
            <Select
              value={filters.propertyId}
              onChange={(e) => setFilters((f) => ({ ...f, propertyId: e.target.value }))}
            >
              <option value="">All homes</option>
              {(properties.data?.properties ?? []).map((property) => (
                <option key={property._id} value={property._id}>
                  {property.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Status">
            <Select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">Any status</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>

          <Field label="Staying after">
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            />
          </Field>

          <Field label="Arriving before">
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            />
          </Field>

          <Field label="Search">
            <Input
              type="search"
              placeholder="Name, email or phone"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
          </Field>

          <div className="flex items-end gap-5 sm:col-span-2 xl:col-span-5">
            <Button type="submit">Apply filters</Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Reset
            </Button>
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          body="Try widening the dates, or clearing the filters entirely."
        />
      ) : (
        <Card>
          <Table headers={['Guest', 'Home', 'Dates', 'Nights', 'Total', 'Status', 'Booked']}>
            {rows.map((booking) => (
              <tr key={booking._id}>
                <Td>
                  <Link to={`/admin/bookings/${booking._id}`} className="link-underline text-ink">
                    {booking.guestName}
                  </Link>
                  <span className="mt-0.5 block font-sans text-[12px] text-ink-muted">
                    {booking.guestEmail}
                  </span>
                </Td>
                <Td>{booking.propertyId?.name ?? '—'}</Td>
                <Td>{formatDateRange(booking.checkIn, booking.checkOut)}</Td>
                <Td>{booking.nights}</Td>
                <Td>
                  {formatMoney(booking.totalPriceCents, booking.currency)}
                  {booking.amountRefundedCents > 0 && (
                    <span className="mt-0.5 block font-sans text-[12px] text-clay-600">
                      −{formatMoney(booking.amountRefundedCents, booking.currency)} refunded
                    </span>
                  )}
                </Td>
                <Td>
                  <StatusPill status={booking.status} />
                </Td>
                <Td className="whitespace-nowrap text-ink-muted">
                  {formatDate(booking.createdAt, { month: 'short', day: 'numeric' })}
                </Td>
              </tr>
            ))}
          </Table>

          {pagination && pagination.pages > 1 && (
            <div className="mt-7 flex items-center justify-between border-t border-bloom-300 pt-5">
              <Button
                variant="ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="font-sans text-[13px] font-light text-ink-muted">
                Page {pagination.page} of {pagination.pages}
              </span>
              <Button
                variant="ghost"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </Card>
      )}
    </AdminPage>
  );
}
