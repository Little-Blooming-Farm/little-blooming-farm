import cron from 'node-cron';

import env from '../config/env.js';
import logger from '../lib/logger.js';
import { syncAllCalendars } from '../services/icalService.js';
import { releaseExpiredHolds, sendBalanceReminders } from '../services/bookingService.js';

const tasks = [];

/**
 * A crude but effective single-flight guard. Two overlapping sync runs would
 * fight over the same `lastSyncedAt` watermark and could prune each other's
 * rows, so a slow run simply causes the next tick to be skipped.
 */
function singleFlight(name, fn) {
  let running = false;
  return async () => {
    if (running) {
      logger.warn(`Skipping ${name} — previous run still in progress`);
      return;
    }
    running = true;
    const startedAt = Date.now();
    try {
      await fn();
      logger.debug(`${name} finished`, { ms: Date.now() - startedAt });
    } catch (err) {
      logger.error(`${name} failed`, { error: err.message, stack: err.stack });
    } finally {
      running = false;
    }
  };
}

export function startScheduledJobs() {
  if (!env.ICAL_SYNC_ENABLED) {
    logger.warn('iCal sync is disabled (ICAL_SYNC_ENABLED=false)');
  } else {
    if (!cron.validate(env.ICAL_SYNC_CRON)) {
      logger.error('ICAL_SYNC_CRON is not a valid cron expression — sync not scheduled', {
        expression: env.ICAL_SYNC_CRON,
      });
    } else {
      tasks.push(
        cron.schedule(env.ICAL_SYNC_CRON, singleFlight('iCal sync', syncAllCalendars), {
          timezone: 'America/Los_Angeles',
        })
      );
      logger.info('Scheduled iCal sync', { cron: env.ICAL_SYNC_CRON });

      // Prime the calendar shortly after boot rather than waiting for the tick.
      setTimeout(() => {
        singleFlight('iCal sync (startup)', syncAllCalendars)();
      }, 20_000).unref();
    }
  }

  // Housekeeping for abandoned checkouts. Availability already ignores lapsed
  // holds, so this only keeps the collection and admin views tidy.
  tasks.push(
    cron.schedule('*/10 * * * *', singleFlight('hold release', releaseExpiredHolds), {
      timezone: 'America/Los_Angeles',
    })
  );
  logger.info('Scheduled booking hold release', { cron: '*/10 * * * *' });

  // Balance reminders. Once a day at 9am local — a payment nudge at 3am reads
  // as automated nagging, and `reminderSentAt` makes it at-most-once anyway.
  tasks.push(
    cron.schedule('0 9 * * *', singleFlight('balance reminders', () => sendBalanceReminders()), {
      timezone: 'America/Los_Angeles',
    })
  );
  logger.info('Scheduled balance reminders', { cron: '0 9 * * *' });

  return tasks;
}

export function stopScheduledJobs() {
  for (const task of tasks) task.stop();
  tasks.length = 0;
}
