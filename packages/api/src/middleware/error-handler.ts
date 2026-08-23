import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, NotFoundError, ValidationError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`No route matches ${req.method} ${req.path}`, 'ROUTE_NOT_FOUND'));
}

/**
 * The single place an error becomes an HTTP response.
 *
 * Express 5 forwards rejected promises from async handlers here on its own,
 * so handlers can `throw` and be confident it lands here rather than hanging
 * the request — that alone removes a whole category of Express 4 bug.
 *
 * Unrecognised errors never reach the client as-is: an internal message can
 * carry a table name, a file path or a query. Clients get a generic message
 * and a code; the detail goes to the log.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const normalised = normalise(error);

  const logContext = {
    err: normalised,
    method: req.method,
    path: req.path,
    userId: req.context?.userId,
    tenantId: req.context?.tenantId,
    ip: req.metadata?.ip,
  };

  if (normalised.expected) {
    logger.warn(logContext, normalised.message);
  } else {
    logger.error(logContext, normalised.message);
  }

  const body: ErrorBody = {
    error: {
      code: normalised.code,
      message: normalised.expected ? normalised.message : 'Something went wrong on our side',
    },
  };

  if (normalised.details !== undefined) body.error.details = normalised.details;

  res.status(normalised.status).json(body);
}

function normalise(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof ZodError) {
    return new ValidationError(
      error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }

  return new AppError({
    message: error instanceof Error ? error.message : 'Unknown error',
    status: 500,
    code: 'INTERNAL_ERROR',
    expected: false,
  });
}
