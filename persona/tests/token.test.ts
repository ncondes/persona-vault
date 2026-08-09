import jwt from 'jsonwebtoken';
import { config } from '../src/config/config';
import { signAuthToken, verifyAuthToken } from '../src/infrastructure/auth/token';

// `verifyAuthToken` returning null is the whole of the session gate: every route
// behind `requireAuth` depends on it saying no to anything it did not sign.
describe('auth tokens', () => {
  it('round-trips the user id', () => {
    expect(verifyAuthToken(signAuthToken('user-1'))).toBe('user-1');
  });

  it('rejects a token signed with a different secret', () => {
    const forged = jwt.sign({ sub: 'user-1' }, 'some-other-secret', { expiresIn: 3600 });
    expect(verifyAuthToken(forged)).toBeNull();
  });

  it('rejects a token whose payload was edited after signing', () => {
    const [header, , signature] = signAuthToken('user-1').split('.');
    const swapped = Buffer.from(JSON.stringify({ sub: 'user-2' })).toString('base64url');
    expect(verifyAuthToken(`${header}.${swapped}.${signature}`)).toBeNull();
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ sub: 'user-1' }, config.authSecret, { expiresIn: -1 });
    expect(verifyAuthToken(expired)).toBeNull();
  });

  it.each([
    ['empty', ''],
    ['not a JWT', 'hello'],
    ['the right shape but nonsense', 'aaa.bbb.ccc'],
  ])('rejects a %s token', (_label, token) => {
    expect(verifyAuthToken(token)).toBeNull();
  });

  // A correctly signed token is not automatically a session: the payload still
  // has to carry a user id of the right type.
  it('rejects a valid signature with no usable subject', () => {
    expect(verifyAuthToken(jwt.sign({ role: 'admin' }, config.authSecret))).toBeNull();
    expect(verifyAuthToken(jwt.sign({ sub: 42 } as object, config.authSecret))).toBeNull();
  });

  it('signs a token that expires, rather than one that lasts forever', () => {
    const payload = jwt.decode(signAuthToken('user-1')) as { exp?: number; iat?: number };
    expect(payload.exp).toBeDefined();
    expect(payload.exp! - payload.iat!).toBe(60 * 60 * 24 * 7);
  });
});
