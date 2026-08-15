import { Link } from 'react-router-dom';

import { adminDashboard } from '../lib/api.js';
import useAsync from '../hooks/useAsync.js';
import { ErrorState, LoadingState } from '../components/ui.jsx';
import { AdminPage, Card, EmptyState, Stat, StatusPill, Table, Td } from './components.jsx';
import { formatDate, formatDateRange, formatMoney } from '../lib/format.js';

function ArrivalList({ title, bookings, dateKey, emptyText }) {
  return (
    <Card>
      <h2 className="font-display text-xl font-light text-moss-800">{title}</h2>
      {bookings.length === 0 ? (
        <p className="mt-4 font-sans text-[14px] font-light text-ink-muted">{emptyText}</p>
      ) : (
        <ul className="mt-5 divide-y divide-bloom-300">
          {bookings.slice(0, 6).map((booking) => (
            <li key={booking._id} className="flex items-baseline justify-between gap-4 py-3">
              <div className="min-w-0">
                <Link
                  to={`/admin/bookings/${booking._id}`}
                  className="link-underline block truncate font-sans text-[15px] text-ink"
                >
                  {booking.guestName}
                </Link>
                <p className="mt-0.5 font-sans text-[12px] font-light text-ink-muted">
                  {booking.propertyId?.name} · {booking.guests} guests
                </p>
              </div>
              <span className="shrink-0 font-sans text-[13px] font-light text-ink-soft">
                {formatDate(booking[dateKey], { month: 'short', day: 'numeric' })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const { data, loading, error, refresh } = useAsync(() => adminDashboard(), []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={refresh} />;

  const { stats, upcomingCheckIns, upcomingCheckOuts, inHouse, recentBookings, properties } = data;

  return (
    <AdminPage
      title="Dashboard"
      description={`Today is ${formatDate(data.today)} at the farm.`}
    >
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Confirmed bookings"
          value={stats.confirmed}
          sub={`${stats.pending} awaiting payment`}
        />
        <Stat
          label="Next 30 days"
          value={`${stats.next30Days.occupancyPercent}%`}
          sub={`${stats.next30Days.bookedNights} nights booked`}
        />
        <Stat
          label="Last 30 days"
          value={formatMoney(stats.last30Days.netCents)}
          sub={`${stats.last30Days.bookings} bookings · ${stats.last30Days.nights} nights`}
        />
        <Stat label="In the house now" value={inHouse.length} sub="Currently staying" />
      </div>

      <div className="mt-9 grid gap-5 lg:grid-cols-2">
        <ArrivalList
          title="Arriving soon"
          bookings={upcomingCheckIns}
          dateKey="checkIn"
          emptyText="No arrivals in the next 30 days."
        />
        <ArrivalList
          title="Leaving soon"
          bookings={upcomingCheckOuts}
          dateKey="checkOut"
          emptyText="No departures in the next 30 days."
        />
      </div>

      <div className="mt-9">
        <Card>
          <div className="flex items-center justify-between gap-5">
            <h2 className="font-display text-xl font-light text-moss-800">Recent bookings</h2>
            <Link
              to="/admin/bookings"
              className="link-underline font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted"
            >
              All bookings
            </Link>
          </div>

          {recentBookings.length === 0 ? (
            <EmptyState
              title="No bookings yet"
              body="They will appear here the moment the first one comes through."
            />
          ) : (
            <div className="mt-5">
              <Table headers={['Guest', 'Home', 'Dates', 'Total', 'Status']}>
                {recentBookings.map((booking) => (
                  <tr key={booking._id}>
                    <Td>
                      <Link
                        to={`/admin/bookings/${booking._id}`}
                        className="link-underline text-ink"
                      >
                        {booking.guestName}
                      </Link>
                      <span className="mt-0.5 block font-sans text-[12px] text-ink-muted">
                        {booking.guestEmail}
                      </span>
                    </Td>
                    <Td>{booking.propertyId?.name ?? '—'}</Td>
                    <Td>{formatDateRange(booking.checkIn, booking.checkOut)}</Td>
                    <Td>{formatMoney(booking.totalPriceCents, booking.currency)}</Td>
                    <Td>
                      <StatusPill status={booking.status} />
                    </Td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-9 grid gap-5 sm:grid-cols-2">
        {properties.map((property) => (
          <Card key={property._id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-light text-moss-800">{property.name}</h3>
                <p className="mt-1 font-sans text-[13px] font-light text-ink-muted">
                  {property.isActive ? 'Bookable' : 'Hidden from the site'}
                </p>
              </div>
              <Link
                to={`/admin/properties/${property._id}`}
                className="link-underline font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted"
              >
                Settings
              </Link>
            </div>
            <p className="mt-4 font-sans text-[12px] font-light text-ink-faint">
              {property.lastIcalSyncAt
                ? `Calendars synced ${formatDate(property.lastIcalSyncAt, {
                    month: 'short',
                    day: 'numeric',
                  })} — ${property.lastIcalSyncStatus || 'OK'}`
                : 'Airbnb / VRBO calendars not yet connected'}
            </p>
          </Card>
        ))}
      </div>
    </AdminPage>
  );
}
