import { RequestHandler } from 'express';
import { ZodType } from 'zod';
import { ValidationError } from '../domain/errors';

// Validates the request body against a schema and replaces it with the parsed
// result. On failure it throws a ValidationError listing the offending fields.
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fields[issue.path.join('.') || '_'] = issue.message;
      }
      throw new ValidationError('Validation failed', fields);
    }
    req.body = result.data;
    next();
  };
}
