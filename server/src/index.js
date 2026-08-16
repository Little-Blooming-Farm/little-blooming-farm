import env from './config/env.js';
import logger from './lib/logger.js';
import { connectDatabase, disconnectDatabase, ensureIndexes } from './config/db.js';
import { verifyMailTransport } from './lib/email.js';
import { startScheduledJobs, stopScheduledJobs } from './jobs/scheduler.js';
import { createApp } from './app.js';

// A crash that leaves the process in an unknown state is worse than a restart.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception — shutting down', { error: err.message, stack: err.stack });
  process.exit(1);
});

async function main() {
  // The database is the one hard prerequisite — the API cannot answer anything
  // useful without it, so this is the only thing awaited before listening.
  await connectDatabase();

  const app = createApp();

  /**
   * Bind the port immediately.
   *
   * Everything else — index building, SMTP verification — used to be awaited
   * here, which meant a cold index build or an unreachable SMTP host delayed
   * the port from ever opening. A platform health check reads that as a dead
   * service ("No open ports detected") and kills the deploy, even though the
   * app is fine. None of that work is needed to serve a request, so it runs
   * after the socket is up and reports itself through the logs.
   */
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info('The Little Blooming Farm API is listening', {
      port: env.PORT,
      env: env.NODE_ENV,
      client: env.CLIENT_URL,
    });
  });

  // Slightly above the 60s typical proxy idle timeout, to avoid 502s on
  // connections the platform is still holding open.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;

  // --- Background startup work; never blocks the port ------------------------
  if (env.isProduction) {
    ensureIndexes();
  }
  verifyMailTransport().catch((err) =>
    logger.error('SMTP verification threw', { error: err.message })
  );

  startScheduledJobs();

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received — shutting down gracefully`);

    stopScheduledJobs();

    const forceExit = setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 15_000);
    forceExit.unref();

    server.close(async () => {
      await disconnectDatabase();
      logger.info('Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Failed to start server', { error: err.message, stack: err.stack });
  process.exit(1);
});
