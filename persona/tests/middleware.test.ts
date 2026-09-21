import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
  AppError,
  ConflictError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from '../src/domain/errors';
import { requireAuth } from '../src/middlewares/auth.middleware';
import { errorHandler } from '../src/middlewares/error.middleware';
import { validateBody } from '../src/middlewares/validate.middleware';
import { signAuthToken } from '../src/infrastructure/auth/token';

// Minimal Express doubles. The HTTP suites prove these are wired up; this file
// is about the branches a passing request never takes.
function fakeResponse() {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    headers,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    setHeader(name: string, value: string) {
      headers[name] = value;
      return res;
    },
  };
  return res as unknown as Response & {
    statusCode: number;
    body: unknown;
    headers: Record<string, string>;
  };
}

function run(handler: ReturnType<typeof validateBody>, req: Partial<Request>) {
  const next = jest.fn();
  handler(req as Request, fakeResponse(), next as unknown as NextFunction);
  return next;
}

describe('errorHandler', () => {
  it('renders an AppError with its status, code and fields', () => {
    const res = fakeResponse();
    errorHandler(
      new ValidationError('Validation failed', { email: 'must be an email address' }),
      {} as Request,
      res,
      jest.fn(),
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        fields: { email: 'must be an email address' },
      },
    });
  });

  // The important one. An unexpected throw must not put a stack trace, a file
  // path or a database message on the wire.
  it('turns an unexpected error into a generic 500 that leaks nothing', () => {
    const res = fakeResponse();
    const leaky = new Error('connect ECONNREFUSED 127.0.0.1:5432 — password=hunter2');

    errorHandler(leaky, {} as Request, res, jest.fn());

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' },
    });

    const wire = JSON.stringify(res.body);
    expect(wire).not.toContain('hunter2');
    expect(wire).not.toContain('ECONNREFUSED');
    expect(wire).not.toContain('stack');
  });

  it('turns a rate-limit refusal into a Retry-After header', () => {
    const res = fakeResponse();
    errorHandler(
      new TooManyRequestsError('Too many requests. Try again shortly.', 'RATE_LIMITED', 42),
      {} as Request,
      res,
      jest.fn(),
    );
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBe('42');
  });

  // Retry-After is in whole seconds, so a sub-second wait still has to say 1 —
  // zero reads as "go ahead now", which is how a client ends up in a loop.
  it('never tells a client to retry after zero seconds', () => {
    const res = fakeResponse();
    errorHandler(new TooManyRequestsError('slow down', 'RATE_LIMITED', 0), {} as Request, res, jest.fn());
    expect(res.headers['Retry-After']).toBe('1');
  });

  it('sets no Retry-After when the error does not carry one', () => {
    const res = fakeResponse();
    errorHandler(new TooManyRequestsError(), {} as Request, res, jest.fn());
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBeUndefined();
  });

  it('does not treat a plain object shaped like an AppError as one', () => {
    const res = fakeResponse();
    errorHandler({ statusCode: 418, code: 'IM_A_TEAPOT' }, {} as Request, res, jest.fn());
    expect(res.statusCode).toBe(500);
  });

  it.each([
    [new NotFoundError(), 404, 'NOT_FOUND'],
    [new ConflictError(), 409, 'CONFLICT'],
    [new UnauthorizedError(), 401, 'UNAUTHORIZED'],
    [new AppError(410, 'INTERACTION_EXPIRED', 'This request has expired'), 410, 'INTERACTION_EXPIRED'],
  ])('maps %s to its status and code', (err, status, code) => {
    const res = fakeResponse();
    errorHandler(err, {} as Request, res, jest.fn());
    expect(res.statusCode).toBe(status);
    expect((res.body as { error: { code: string } }).error.code).toBe(code);
  });
});

describe('validateBody', () => {
  const schema = z.object({
    email: z.email(),
    detail: z.object({ city: z.string().min(1) }),
  });

  // The handler assigns `req.body = result.data`, so anything the schema does not
  // declare is gone before a controller ever sees it.
  it('replaces the body with the parsed result and continues', () => {
    const req = { body: { email: 'a@example.com', detail: { city: 'Bogotá' }, extra: 'dropped' } };
    const next = run(validateBody(schema), req as Partial<Request>);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ email: 'a@example.com', detail: { city: 'Bogotá' } });
  });

  it('reports nested failures under a dotted path', () => {
    const req = { body: { email: 'not-an-email', detail: { city: '' } } };

    let thrown: ValidationError | undefined;
    try {
      run(validateBody(schema), req as Partial<Request>);
    } catch (err) {
      thrown = err as ValidationError;
    }

    expect(thrown?.statusCode).toBe(400);
    expect(Object.keys(thrown?.fields ?? {}).sort()).toEqual(['detail.city', 'email']);
  });

  // A failure with no path — a whole-body type error — still needs a key, or the
  // client gets an error object with nothing in it.
  it('files a root-level failure under "_"', () => {
    let thrown: ValidationError | undefined;
    try {
      run(validateBody(z.object({}).strict()), { body: 'not an object' } as Partial<Request>);
    } catch (err) {
      thrown = err as ValidationError;
    }

    expect(Object.keys(thrown?.fields ?? {})).toEqual(['_']);
  });

  // Zod's own wording is not a contract — it has changed between releases and
  // reads like a stack trace. Each case runs a real safeParse, so a change in
  // what zod reports fails here instead of reaching someone's screen.
  it.each([
    ['a missing field', z.object({ a: z.string() }), {}, 'REQUIRED'],
    ['an empty string', z.object({ a: z.string().min(1) }), { a: '' }, 'REQUIRED'],
    ['a short string', z.object({ a: z.string().min(8) }), { a: 'abc' }, 'TOO_SHORT'],
    ['a long string', z.object({ a: z.string().max(3) }), { a: 'abcd' }, 'TOO_LONG'],
    ['an empty list', z.object({ a: z.array(z.string()).min(1) }), { a: [] }, 'EMPTY_LIST'],
    ['a full list', z.object({ a: z.array(z.string()).max(1) }), { a: ['x', 'y'] }, 'TOO_MANY'],
    ['a bad email', z.object({ a: z.email() }), { a: 'nope' }, 'INVALID_EMAIL'],
    ['a bad url', z.object({ a: z.url() }), { a: 'nope' }, 'INVALID_URL'],
    ['a bad pattern', z.object({ a: z.string().regex(/^\d+$/) }), { a: 'x' }, 'INVALID_FORMAT'],
    ['a value outside an enum', z.object({ a: z.enum(['x']) }), { a: 'y' }, 'NOT_ALLOWED'],
    ['a value of the wrong type', z.object({ a: z.boolean() }), { a: 'yes' }, 'INVALID_TYPE'],
    ['a custom rule', z.object({ a: z.string().refine(() => false, { error: 'URL_HAS_FRAGMENT' }) }), { a: 'x' }, 'URL_HAS_FRAGMENT'],
  ])('reports %s as %s', (_label, schema, body, code) => {
    let thrown: ValidationError | undefined;
    try {
      run(validateBody(schema), { body } as Partial<Request>);
    } catch (err) {
      thrown = err as ValidationError;
    }

    expect(thrown?.fields?.a).toBe(code);
  });

  // A schema can name its own code, and zod keeps its own issue code while
  // swapping the text — so the override has to win over the generic mapping.
  it('lets a schema name its own code', () => {
    let thrown: ValidationError | undefined;
    try {
      run(
        validateBody(z.object({ password: z.string().min(8, { error: 'PASSWORD_TOO_SHORT' }) })),
        { body: { password: 'abc' } } as Partial<Request>,
      );
    } catch (err) {
      thrown = err as ValidationError;
    }

    expect(thrown?.fields?.password).toBe('PASSWORD_TOO_SHORT');
  });

  it('reports a key the schema never declared', () => {
    let thrown: ValidationError | undefined;
    try {
      run(
        validateBody(z.object({ a: z.string() }).strict()),
        { body: { a: 'x', b: 1 } } as Partial<Request>,
      );
    } catch (err) {
      thrown = err as ValidationError;
    }

    expect(thrown?.fields?._).toBe('UNEXPECTED_FIELD');
  });
});

describe('requireAuth', () => {
  it('accepts a valid token and exposes the user id', () => {
    const req = { cookies: { token: signAuthToken('user-42') } } as unknown as Request;
    const next = jest.fn();

    requireAuth(req, fakeResponse(), next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(req.userId).toBe('user-42');
  });

  it.each([
    ['no cookies at all', {}],
    ['no token cookie', { cookies: {} }],
    ['an empty token', { cookies: { token: '' } }],
    ['a garbage token', { cookies: { token: 'not.a.jwt' } }],
  ])('rejects a request with %s', (_label, req) => {
    expect(() =>
      requireAuth(req as Request, fakeResponse(), jest.fn() as unknown as NextFunction),
    ).toThrow(UnauthorizedError);
  });
});
