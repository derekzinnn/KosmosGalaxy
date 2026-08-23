import { pino } from 'pino';
import { env } from '../config/env.js';

/**
 * Structured application logger.
 *
 * `redact` is a safety net, not a substitute for care: if a token, password
 * or cookie ever reaches a log call by accident, it is replaced with
 * [REDACTED] instead of being written to disk where it lives forever.
 */
export const logger = pino({
  level: env.isTest ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'password',
      'newPassword',
      'passwordHash',
      'token',
      'tokenHash',
      'accessToken',
      'refreshToken',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
  transport: env.isDevelopment
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
});

export type Logger = typeof logger;
