import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestMetadata } from './middleware/request-metadata.js';
import { scopeTracking } from './middleware/scope-tracking.js';
import { apiRouter } from './routes/index.js';

export function createApp(): Express {
  const app = express();

  /**
   * How many reverse proxies sit in front of us.
   *
   * Express reads the client IP from the X-Forwarded-For header, but only
   * trusts as many hops as this number allows. Set it too high and a client
   * can forge their own IP by sending the header themselves; too low and
   * every request looks like it came from Caddy, which silently merges every
   * client into one rate-limit bucket and fills the audit log with the
   * proxy's address.
   */
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  // Security response headers: clickjacking, MIME sniffing, referrer leakage.
  app.use(helmet());

  /**
   * The browser will only let the web app call this API from the origin named
   * here, and `credentials` is what allows the refresh cookie to travel at
   * all. Both sides must agree or the cookie is silently dropped.
   */
  app.use(
    cors({
      origin: env.WEB_APP_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );

  // 100kb is far more than any Phase 0 endpoint needs, and small enough that
  // a giant body cannot occupy a worker.
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  if (!env.isTest) {
    app.use(
      pinoHttp({
        logger,
        // Health checks would otherwise dominate the log.
        autoLogging: { ignore: (req) => req.url === '/health' },
      }),
    );
  }

  app.use(requestMetadata);
  app.use(scopeTracking);

  app.use(apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
