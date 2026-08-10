import { RequestHandler } from 'express';
import { $ZodIssue } from 'zod/v4/core';
import { ZodType } from 'zod';
import { FIELD_ERRORS, FieldError } from '../constants/field-errors';
import { ValidationError } from '../domain/errors';

// A schema can name its own code by passing `{ error: 'SOME_CODE' }` to a check;
// zod keeps its own issue code and swaps only the text, so this recognises the
// override and leaves the rest to the table below.
const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

function valueAt(body: unknown, path: PropertyKey[]): unknown {
  return path.reduce<unknown>(
    (node, key) => (node == null ? undefined : (node as Record<PropertyKey, unknown>)[key]),
    body,
  );
}

// Zod says what went wrong in its own words; this says it in ours. `origin`
// separates a short string from an empty list, which read the same in zod's
// message but are different problems to a person.
export function fieldCode(issue: $ZodIssue, body: unknown): FieldError | string {
  if (CODE_PATTERN.test(issue.message)) return issue.message;

  switch (issue.code) {
    case 'too_small':
      if (issue.origin === 'array') return FIELD_ERRORS.EMPTY_LIST;
      return Number(issue.minimum) > 1 ? FIELD_ERRORS.TOO_SHORT : FIELD_ERRORS.REQUIRED;
    case 'too_big':
      return issue.origin === 'array' ? FIELD_ERRORS.TOO_MANY : FIELD_ERRORS.TOO_LONG;
    case 'invalid_format':
      if (issue.format === 'email') return FIELD_ERRORS.INVALID_EMAIL;
      if (issue.format === 'url') return FIELD_ERRORS.INVALID_URL;
      return FIELD_ERRORS.INVALID_FORMAT;
    case 'invalid_value':
      return FIELD_ERRORS.NOT_ALLOWED;
    case 'invalid_type':
      // Zod does not carry the offending value, and "expected string, received
      // undefined" is a missing field rather than a wrong one — worth telling
      // apart, since the two deserve different sentences.
      return valueAt(body, issue.path) === undefined
        ? FIELD_ERRORS.REQUIRED
        : FIELD_ERRORS.INVALID_TYPE;
    case 'unrecognized_keys':
      return FIELD_ERRORS.UNEXPECTED_FIELD;
    default:
      return FIELD_ERRORS.INVALID_VALUE;
  }
}

// Validates the request body against a schema and replaces it with the parsed
// result. On failure it throws a ValidationError listing the offending fields.
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fields[issue.path.join('.') || '_'] = fieldCode(issue, req.body);
      }
      throw new ValidationError('Validation failed', fields);
    }
    req.body = result.data;
    next();
  };
}
