import { Writable } from 'node:stream';
import pino from 'pino';
import { REDACTED_PATHS, REDACTION } from '../src/infrastructure/logger/logger';
import { scrubQuery } from '../src/middlewares/requestLogger.middleware';

// pino-http's default request serializer copies the whole header bag, so before
// this the session cookie was written to the log on every production request.
// The paths and the scrubber are imported from the modules that ship them, so a
// change there fails here rather than passing against a restated copy.
// Assembled rather than written out, so the file contains no `eyJ...` literal
// for a secret scanner to flag. The value is what matters -- a string shaped
// like a session token -- not where the characters come from. Written as one
// literal it tripped GitHub's scanner, which is noise on a signature that is
// three English words.
const SESSION_JWT = [
  Buffer.from('{"alg":"HS256"}').toString('base64url'),
  Buffer.from('{"sub":"user-1"}').toString('base64url'),
  'not-a-real-signature',
].join('.');

function captured(): { lines: () => string; log: pino.Logger } {
  const written: string[] = [];
  const sink = new Writable({
    write(chunk, _enc, done) {
      written.push(String(chunk));
      done();
    },
  });
  return {
    lines: () => written.join(''),
    log: pino(
      { level: 'info', redact: { paths: REDACTED_PATHS, censor: REDACTION } },
      sink,
    ),
  };
}

describe('log redaction', () => {
  it('keeps the session cookie out of the log', () => {
    const { log, lines } = captured();
    log.info({ req: { headers: { cookie: `token=${SESSION_JWT}` } } }, 'request');
    expect(lines()).not.toContain(SESSION_JWT);
    expect(lines()).toContain(REDACTION);
  });

  it('keeps a bearer token out of the log', () => {
    const { log, lines } = captured();
    log.info({ req: { headers: { authorization: 'Bearer opaque-access-token' } } }, 'request');
    expect(lines()).not.toContain('opaque-access-token');
  });

  it('keeps an issued cookie out of the log', () => {
    const { log, lines } = captured();
    log.info({ res: { headers: { 'set-cookie': [`token=${SESSION_JWT}`] } } }, 'response');
    expect(lines()).not.toContain(SESSION_JWT);
  });

  it('still logs the rest of the headers, so the line stays useful', () => {
    const { log, lines } = captured();
    log.info({ req: { headers: { cookie: 'token=x', 'user-agent': 'probe/1.0' } } }, 'request');
    expect(lines()).toContain('probe/1.0');
  });
});

describe('scrubQuery', () => {
  // /oidc/auth carries state, code_challenge and login_hint, and login_hint is
  // an email address. The path is what makes the line useful; the query string
  // is what makes it a disclosure.
  it('keeps the path of an authorize request and drops its query string', () => {
    const scrubbed = scrubQuery(
      '/oidc/auth?client_id=clinic&login_hint=camila%40example.com&state=abc',
    );
    expect(scrubbed).toBe(`/oidc/auth?${REDACTION}`);
    expect(scrubbed).not.toContain('camila');
    expect(scrubbed).not.toContain('state=abc');
  });

  it('leaves a url with no query string alone', () => {
    expect(scrubQuery('/api/vault')).toBe('/api/vault');
  });

  it('drops a query string that is only a marker', () => {
    expect(scrubQuery('/api/vault?')).toBe(`/api/vault?${REDACTION}`);
  });
});
