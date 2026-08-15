import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  adminBlockedDates,
  adminBookings,
  adminCreateBlock,
  adminDeleteBlock,
  adminProperties,
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
  Select,
  SourcePill,
} from './components.jsx';
import { addDays, formatDate, formatDateRange, toDateKey, todayKey } from '../lib/format.js';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABEL = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
});

/** Every night in [start, end) as YYYY-MM-DD, matching the server convention. */
function nightsIn(start, end) {
  const out = [];
  let cursor = new Date(start);
  const last = new Date(end);
  while (cursor < last) {
    out.push(toDateKey(cursor));
    cursor = addDays(cursor, 1);
  }
  return out;
}

function MonthGrid({ anchor, nightMap }) {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const today = todayKey();

  const cells = [];
  for (let i = 0; i < first.getUTCDay(); i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(Date.UTC(year, month, day)));

  const tone = {
    booking: 'bg-moss-600 text-bloom-50',
    manual: 'bg-clay-300 text-ink',
    airbnb: 'bg-clay-500 text-bloom-50',
    vrbo: 'bg-gold-500 text-bloom-50',
    direct: 'bg-moss-400 text-bloom-50',
  };

  return (
    <div>
      <p className="mb-4 text-center font-display text-lg font-light text-moss-800">
        {MONTH_LABEL.format(first)}
      </p>
      <div className="grid grid-cols-7 gap-px bg-bloom-300">
        {WEEKDAYS.map((day, i) => (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            className="bg-bloom-50 py-1.5 text-center font-sans text-[10px] uppercase tracking-label text-ink-faint"
          >
            {day}
          </span>
        ))}
        {cells.map((date, index) => {
          if (!date) {
            // eslint-disable-next-line react/no-array-index-key
            return <span key={`pad-${index}`} className="bg-bloom-50" />;
          }
          const key = toDateKey(date);
          const entry = nightMap.get(key);
          return (
            <span
              key={key}
              title={entry ? `${entry.source} — ${entry.label}` : undefined}
              className={`flex h-10 items-center justify-center font-sans text-[13px] font-light ${
                entry ? tone[entry.source] ?? tone.direct : 'bg-bloom-50 text-ink-soft'
              } ${key === today ? 'ring-1 ring-inset ring-gold-400' : ''}`}
            >
              {date.getUTCDate()}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarBlocks() {
  const properties = useAsync(() => adminProperties(), []);
  const [propertyId, setPropertyId] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [draft, setDraft] = useState({ startDate: '', endDate: '', reason: '' });

  useEffect(() => {
    if (!propertyId && properties.data?.properties?.length) {
      setPropertyId(properties.data.properties[0]._id);
    }
  }, [properties.data, propertyId]);

  const blocks = useAsync(
    () => (propertyId ? adminBlockedDates(`?propertyId=${propertyId}`) : Promise.resolve(null)),
    [propertyId]
  );

  const bookings = useAsync(
    () =>
      propertyId
        ? adminBookings(`?propertyId=${propertyId}&limit=100&from=${todayKey()}`)
        : Promise.resolve(null),
    [propertyId]
  );

  /** One map from night → what occupies it, so the grid is a simple lookup. */
  const nightMap = useMemo(() => {
    const map = new Map();

    for (const booking of bookings.data?.bookings ?? []) {
      if (booking.status === 'cancelled') continue;
      for (const night of nightsIn(booking.checkIn, booking.checkOut)) {
        map.set(night, { source: 'booking', label: booking.guestName });
      }
    }
    for (const block of blocks.data?.blocks ?? []) {
      for (const night of nightsIn(block.startDate, block.endDate)) {
        // A direct booking always wins the label over an imported block.
        if (map.get(night)?.source === 'booking') continue;
        map.set(night, { source: block.source, label: block.reason || block.summary || 'Blocked' });
      }
    }
    return map;
  }, [blocks.data, bookings.data]);

  const createBlock = async (event) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await adminCreateBlock({
        propertyId,
        startDate: draft.startDate,
        endDate: draft.endDate,
        reason: draft.reason,
      });
      setDraft({ startDate: '', endDate: '', reason: '' });
      setNotice({ tone: 'moss', text: 'Those nights are blocked.' });
      blocks.refresh();
    } catch (err) {
      if (err.code === 'BOOKINGS_IN_RANGE') {
        const names = (err.details?.bookings ?? []).map((b) => b.guestName).join(', ');
        setNotice({
          tone: 'clay',
          text: `There are live bookings on those nights (${names}). Cancel them from the booking page first.`,
        });
      } else {
        setNotice({ tone: 'clay', text: err.message });
      }
    } finally {
      setBusy(false);
    }
  };

  const removeBlock = async (id) => {
    setBusy(true);
    setNotice(null);
    try {
      await adminDeleteBlock(id);
      blocks.refresh();
    } catch (err) {
      setNotice({ tone: 'clay', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (properties.loading) return <LoadingState />;
  if (properties.error) return <ErrorState error={properties.error} onRetry={properties.refresh} />;

  const start = new Date(todayKey());
  const anchor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + monthOffset, 1));
  const manualBlocks = (blocks.data?.blocks ?? []).filter((b) => b.source === 'manual');
  const importedBlocks = (blocks.data?.blocks ?? []).filter((b) => b.source !== 'manual');

  return (
    <AdminPage
      title="Calendar & blocks"
      description="Green is a direct booking. Terracotta and gold come in from Airbnb and VRBO."
      actions={
        <Select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="!w-auto !py-2"
        >
          {(properties.data?.properties ?? []).map((property) => (
            <option key={property._id} value={property._id}>
              {property.name}
            </option>
          ))}
        </Select>
      }
    >
      {notice && (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      )}

      <Card>
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setMonthOffset((m) => m - 1)}>
            ← Earlier
          </Button>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {[
              ['bg-moss-600', 'Direct booking'],
              ['bg-clay-300', 'Manual block'],
              ['bg-clay-500', 'Airbnb'],
              ['bg-gold-500', 'VRBO'],
            ].map(([className, label]) => (
              <span
                key={label}
                className="flex items-center gap-2 font-sans text-[12px] font-light text-ink-muted"
              >
                <span className={`block h-3 w-3 ${className}`} />
                {label}
              </span>
            ))}
          </div>
          <Button variant="ghost" onClick={() => setMonthOffset((m) => m + 1)}>
            Later →
          </Button>
        </div>

        {blocks.loading || bookings.loading ? (
          <LoadingState label="Loading the calendar" />
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((offset) => (
              <MonthGrid
                key={offset}
                anchor={new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + offset, 1))}
                nightMap={nightMap}
              />
            ))}
          </div>
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <h2 className="mb-6 font-display text-xl font-light text-moss-800">Block some nights</h2>
          <form onSubmit={createBlock} className="space-y-5">
            <Field label="First night">
              <Input
                type="date"
                required
                value={draft.startDate}
                onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
              />
            </Field>
            <Field label="Free again on" hint="The morning the block ends — same as a check-out date.">
              <Input
                type="date"
                required
                value={draft.endDate}
                onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
              />
            </Field>
            <Field label="Reason">
              <Input
                placeholder="Family visiting, maintenance, a rest…"
                value={draft.reason}
                maxLength={300}
                onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))}
              />
            </Field>
            <Button type="submit" disabled={busy || !draft.startDate || !draft.endDate}>
              {busy ? 'Blocking…' : 'Block these nights'}
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-5 font-display text-xl font-light text-moss-800">Your blocks</h2>
            {manualBlocks.length === 0 ? (
              <p className="font-sans text-[14px] font-light text-ink-muted">
                No manual blocks on this home.
              </p>
            ) : (
              <ul className="divide-y divide-bloom-300">
                {manualBlocks.map((block) => (
                  <li key={block._id} className="flex items-start justify-between gap-5 py-3.5">
                    <div>
                      <p className="font-sans text-[15px] text-ink">
                        {formatDateRange(block.startDate, block.endDate)}
                      </p>
                      <p className="mt-0.5 font-sans text-[13px] font-light text-ink-muted">
                        {block.reason || 'Blocked by the owner'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      className="!text-clay-600"
                      disabled={busy}
                      onClick={() => removeBlock(block._id)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 font-display text-xl font-light text-moss-800">
              Imported from Airbnb & VRBO
            </h2>
            <p className="mb-5 font-sans text-[13px] font-light text-ink-muted">
              These are managed on the platform they came from — remove them there, not here.
            </p>
            {importedBlocks.length === 0 ? (
              <p className="font-sans text-[14px] font-light text-ink-muted">
                Nothing imported yet.{' '}
                <Link to="/admin/properties" className="link-underline">
                  Connect a calendar
                </Link>
                .
              </p>
            ) : (
              <ul className="max-h-72 divide-y divide-bloom-300 overflow-y-auto">
                {importedBlocks.map((block) => (
                  <li key={block._id} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="font-sans text-[15px] text-ink">
                        {formatDateRange(block.startDate, block.endDate)}
                      </p>
                      {block.lastSyncedAt && (
                        <p className="mt-0.5 font-sans text-[12px] font-light text-ink-faint">
                          Synced {formatDate(block.lastSyncedAt, { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <SourcePill source={block.source} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </AdminPage>
  );
}
