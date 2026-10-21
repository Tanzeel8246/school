import type { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { unprocessable } from '../utils/http-error.js';

type Part = 'body' | 'query' | 'params';

/** Validates and coerces a request part against a Zod schema, replacing it with the parsed value. */
export function validate(schema: ZodSchema, part: Part = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      return next(unprocessable('Validation failed', result.error.flatten().fieldErrors));
    }
    req[part] = result.data;
    next();
  };
}
