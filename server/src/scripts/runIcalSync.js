/**
 * Run the OTA calendar sync once and exit.
 *
 *   npm run sync:ical
 *
 * Useful for verifying feed URLs during setup, and as the command to point a
 * platform-level cron job at if you would rather not rely on the in-process
 * scheduler (e.g. when the API sleeps on a free tier).
 */
import logger from '../lib/logger.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { syncAllCalendars } from '../services/icalService.js';

async function main() {
  await connectDatabase();
  const results = await syncAllCalendars();

  console.log('\n' + JSON.stringify(results, null, 2) + '\n');

  await disconnectDatabase();
  process.exit(0);
}

main().catch(async (err) => {
  logger.error('iCal sync failed', { error: err.message, stack: err.stack });
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
