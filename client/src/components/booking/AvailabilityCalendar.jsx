import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { EASE } from '../../lib/motion.js';
import { addDays, parseDateOnly, toDateKey, todayKey } from '../../lib/format.js';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABEL = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
});

function buildMonth(anchor) {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells = [];
  for (let i = 0; i < first.getUTCDay(); i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(Date.UTC(year, month, day)));
  }
  return { first, cells, label: MONTH_LABEL.format(first) };
}

/**
 * Two-month availability calendar with range selection.
 *
 * The important subtlety: a *night* can be unavailable while the same calendar
 * *day* is still a perfectly valid check-out — the departing guest is gone by
 * morning. So availability is stored per night, and a day's selectability
 * depends on whether we are currently picking an arrival or a departure.
 */
export default function AvailabilityCalendar({
  unavailableNights,
  value,
  onChange,
  minNights = 2,
  maxNights = 30,
  bookableUntil,
  months = 2,
}) {
  const today = todayKey();
  const [anchor, setAnchor] = useState(() => {
    const start = value?.checkIn ? parseDateOnly(value.checkIn) : parseDateOnly(today);
    return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  });
  const [direction, setDirection] = useState(1);
  const [hovered, setHovered] = useState(null);

  const blocked = useMemo(
    () => (unavailableNights instanceof Set ? unavailableNights : new Set(unavailableNights ?? [])),
    [unavailableNights]
  );

  const selectingCheckOut = Boolean(value?.checkIn && !value?.checkOut);

  const withinWindow = (key) => key >= today && (!bookableUntil || key <= bookableUntil);

  /** Every night in [start, end) is free. */
  const rangeIsClear = (startKey, endKey) => {
    let cursor = parseDateOnly(startKey);
    const end = parseDateOnly(endKey);
    while (cursor < end) {
      if (blocked.has(toDateKey(cursor))) return false;
      cursor = addDays(cursor, 1);
    }
    return true;
  };

  const nightsBetweenKeys = (a, b) =>
    Math.round((parseDateOnly(b).getTime() - parseDateOnly(a).getTime()) / 86_400_000);

  const canStartOn = (key) => withinWindow(key) && !blocked.has(key);

  const canEndOn = (key) => {
    if (!value?.checkIn) return false;
    if (key <= value.checkIn) return false;
    if (!withinWindow(key)) return false;
    const nights = nightsBetweenKeys(value.checkIn, key);
    if (nights < minNights || nights > maxNights) return false;
    return rangeIsClear(value.checkIn, key);
  };

  /**
   * Is this day clickable at all?
   *
   * While picking a departure, a day is clickable if it can *end* the stay —
   * but also if it could *start* a new one, because `handleSelect` treats a
   * click on an earlier day as "actually, start again from here". Without the
   * second clause those days render disabled and that fallback is unreachable:
   * choose an arrival, then decide you want an earlier one, and the entire
   * calendar greys out with no way forward except Clear dates.
   */
  const isSelectable = (key) =>
    selectingCheckOut ? canEndOn(key) || canStartOn(key) : canStartOn(key);

  /** Narrower: only days that genuinely complete the current stay. */
  const isValidCheckOut = (key) => selectingCheckOut && canEndOn(key);

  const handleSelect = (key) => {
    if (selectingCheckOut) {
      if (canEndOn(key)) {
        onChange({ checkIn: value.checkIn, checkOut: key });
        return;
      }
      // Clicking an unreachable day restarts the selection from there, which is
      // what people actually mean when they click a second, earlier date.
      if (canStartOn(key)) onChange({ checkIn: key, checkOut: null });
      return;
    }
    if (canStartOn(key)) onChange({ checkIn: key, checkOut: null });
  };

  const previewEnd = selectingCheckOut && hovered && canEndOn(hovered) ? hovered : value?.checkOut;

  const inRange = (key) => {
    if (!value?.checkIn || !previewEnd) return false;
    return key > value.checkIn && key < previewEnd;
  };

  const goto = (delta) => {
    setDirection(delta);
    setAnchor((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + delta, 1)));
  };

  const canGoBack = toDateKey(anchor) > today.slice(0, 8) + '01';

  const visibleMonths = Array.from({ length: months }, (_, i) =>
    buildMonth(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + i, 1)))
  );

  return (
    <div className="select-none">
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => goto(-1)}
          disabled={!canGoBack}
          aria-label="Previous month"
          className="flex h-9 w-9 items-center justify-center border border-bloom-300 text-ink-soft transition-colors duration-500 ease-gentle hover:border-moss-400 hover:text-moss-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-bloom-300"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M15 5 8 12l7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <p className="font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted">
          {selectingCheckOut ? 'Choose your departure' : 'Choose your arrival'}
        </p>

        <button
          type="button"
          onClick={() => goto(1)}
          aria-label="Next month"
          className="flex h-9 w-9 items-center justify-center border border-bloom-300 text-ink-soft transition-colors duration-500 ease-gentle hover:border-moss-400 hover:text-moss-700"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          <motion.div
            key={toDateKey(anchor)}
            custom={direction}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -24 }}
            transition={{ duration: 0.55, ease: EASE }}
            className="grid gap-10 sm:grid-cols-2"
          >
            {visibleMonths.map((month) => (
              <div key={month.label}>
                <p className="mb-5 text-center font-display text-xl font-light text-moss-800">
                  {month.label}
                </p>

                <div className="grid grid-cols-7 gap-y-1">
                  {WEEKDAYS.map((day, i) => (
                    <span
                      // eslint-disable-next-line react/no-array-index-key
                      key={i}
                      className="pb-2 text-center font-sans text-[10px] uppercase tracking-label text-ink-faint"
                    >
                      {day}
                    </span>
                  ))}

                  {month.cells.map((date, index) => {
                    if (!date) {
                      // eslint-disable-next-line react/no-array-index-key
                      return <span key={`pad-${index}`} />;
                    }

                    const key = toDateKey(date);
                    const selectable = isSelectable(key);
                    const isCheckIn = key === value?.checkIn;
                    const isCheckOut = key === value?.checkOut;
                    const isEdge = isCheckIn || isCheckOut;
                    const between = inRange(key);
                    const isBlockedNight = blocked.has(key);
                    // While picking a departure, days that would restart the
                    // selection are clickable but shouldn't look like valid
                    // departures — they get a quieter treatment.
                    const dimmed = selectingCheckOut && !isValidCheckOut(key) && !isEdge;

                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={!selectable && !isEdge}
                        onClick={() => handleSelect(key)}
                        onMouseEnter={() => setHovered(key)}
                        onMouseLeave={() => setHovered(null)}
                        aria-label={`${key}${isBlockedNight ? ' — unavailable' : ''}`}
                        aria-pressed={isEdge}
                        className={[
                          'relative flex h-11 items-center justify-center font-sans text-[14px] font-light transition-colors duration-300',
                          between ? 'bg-moss-100' : '',
                          isEdge ? 'bg-moss-700 text-bloom-50' : '',
                          !isEdge && selectable && !dimmed ? 'text-ink hover:bg-moss-100' : '',
                          !isEdge && selectable && dimmed ? 'text-ink-muted hover:bg-bloom-200' : '',
                          !isEdge && !selectable ? 'cursor-not-allowed text-ink-faint' : '',
                        ].join(' ')}
                      >
                        <span className={isBlockedNight && !isEdge ? 'line-through decoration-ink-faint' : ''}>
                          {date.getUTCDate()}
                        </span>

                        {/* A small mark under today, so the calendar has an origin. */}
                        {key === today && !isEdge && (
                          <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-gold-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-bloom-300 pt-5">
        <span className="flex items-center gap-2 font-sans text-[12px] font-light text-ink-muted">
          <span className="block h-3 w-3 bg-moss-700" /> Your stay
        </span>
        <span className="flex items-center gap-2 font-sans text-[12px] font-light text-ink-muted">
          <span className="block h-3 w-3 bg-moss-100" /> Nights between
        </span>
        <span className="flex items-center gap-2 font-sans text-[12px] font-light text-ink-muted">
          <span className="block h-3 w-3 border border-bloom-300" />
          <span className="line-through decoration-ink-faint">Taken</span>
        </span>
        {value?.checkIn && (
          <button
            type="button"
            onClick={() => onChange({ checkIn: null, checkOut: null })}
            className="link-underline ml-auto font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted"
          >
            Clear dates
          </button>
        )}
      </div>
    </div>
  );
}
