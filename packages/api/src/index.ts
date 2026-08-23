import { createApp } from './app.js';
import { env } from './config/env.js';
import { disconnectDatabase } from './db/prisma.js';
import { logger } from './lib/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, environment: env.NODE_ENV, webAppUrl: env.WEB_APP_URL },
    'Kosmos Galaxy API is listening',
  );
});

/**
 * Stop accepting new connections, let in-flight requests finish, then close
 * the database pool. Without this a deploy can cut a transaction in half.
 */
function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down');

  server.close(() => {
    void disconnectDatabase().then(() => process.exit(0));
  });

  // If something refuses to let go, do not hang the deploy forever.
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
