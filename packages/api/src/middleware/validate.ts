import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { ValidationError } from '../lib/errors.js';

/**
 * Validates and replaces the request body.
 *
 * Replacing it matters as much as checking it: after this runs, `req.body`
 * holds only fields the schema declared. A caller cannot smuggle an extra
 * property through into a repository by adding it to their JSON.
 */
export function validateBody<Schema extends ZodType>(schema: Schema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(
        new ValidationError(
          result.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        ),
      );
      return;
    }

    req.body = result.data;
    next();
  };
}
