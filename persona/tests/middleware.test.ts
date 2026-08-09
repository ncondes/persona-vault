import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError, ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../src/domain/errors';
import { requireAuth } from '../src/middlewares/auth.middleware';
import { errorHandler } from '../src/middlewares/error.middleware';
import { validateBody } from '../src/middlewares/validate.middleware';
import { signAuthToken } from '../src/infrastructure/auth/token';

// Minimal Express doubles. The HTTP suites prove these are wired up; this file
// is about the branches a passing request never takes.
function fakeResponse() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
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
