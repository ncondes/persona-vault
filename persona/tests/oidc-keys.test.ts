import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadJwks } from '../src/oidc/keys';
import { SigningKeyService } from '../src/services/signing-key.service';
import { FakeSigningKeys } from './support/fakes';

// loadJwks is the one place the old single-key arrangement meets the new one. It
// used to be excluded from coverage as "a first-run key generator"; it now runs
// the adoption path that decides whether every ID token in flight survives the
// deploy, which is not something to leave untested.
function build() {
  const keys = new FakeSigningKeys();
  return { keys, service: new SigningKeyService(keys) };
}

// keys.ts reads both the variable and the working directory when it is called,
// not when it is imported, so one module instance serves every case.
const load = (service: SigningKeyService) => loadJwks(service);

describe('loadJwks', () => {
  const OIDC_JWKS = process.env.OIDC_JWKS;
  let cwd: string;

  beforeEach(() => {
    delete process.env.OIDC_JWKS;
    // Point cwd somewhere empty, so a developer's real .dev-jwks.json cannot
    // wander into the test.
    cwd = mkdtempSync(join(tmpdir(), 'persona-keys-'));
    jest.spyOn(process, 'cwd').mockReturnValue(cwd);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (OIDC_JWKS === undefined) delete process.env.OIDC_JWKS;
    else process.env.OIDC_JWKS = OIDC_JWKS;
  });

  it('mints a key when there is nothing anywhere', async () => {
    const { service, keys } = build();
    const jwks = await load(service);

    expect(jwks.keys).toHaveLength(1);
    expect(keys.rows[0].state).toBe('active');
  });

  // The migration path. A deployed copy already has a key in OIDC_JWKS, and
  // tokens already issued carry its kid in their header — so it is adopted
  // under that kid rather than replaced.
  it('adopts the key in the environment, keeping its kid', async () => {
    process.env.OIDC_JWKS = JSON.stringify({
      keys: [{ kty: 'RSA', n: 'abc', e: 'AQAB', d: 'secret', kid: 'persona-dev-1' }],
    });
    const { service, keys } = build();
    const jwks = await load(service);

    expect(keys.rows).toHaveLength(1);
    expect(keys.rows[0].kid).toBe('persona-dev-1');
    expect(jwks.keys[0].kid).toBe('persona-dev-1');
  });

  it('adopts the key a laptop cached on disk', async () => {
    writeFileSync(
      join(cwd, '.dev-jwks.json'),
      JSON.stringify({ keys: [{ kty: 'RSA', n: 'abc', e: 'AQAB', d: 'secret', kid: 'local-1' }] }),
    );
    const { service, keys } = build();
    await load(service);
    expect(keys.rows[0].kid).toBe('local-1');
  });

  it('prefers the environment over the file', async () => {
    writeFileSync(
      join(cwd, '.dev-jwks.json'),
      JSON.stringify({ keys: [{ kty: 'RSA', n: 'file', e: 'AQAB', d: 's', kid: 'from-file' }] }),
    );
    process.env.OIDC_JWKS = JSON.stringify({
      keys: [{ kty: 'RSA', n: 'env', e: 'AQAB', d: 's', kid: 'from-env' }],
    });
    const { service, keys } = build();
    await load(service);
    expect(keys.rows.map((k) => k.kid)).toEqual(['from-env']);
  });

  // Once a key is in the database the environment is history: re-adopting on
  // every boot would keep resurrecting a key that had been rotated out.
  it('ignores the environment once a key is stored', async () => {
    const { service, keys } = build();
    await service.mint('active');
    const stored = keys.rows[0].kid;

    process.env.OIDC_JWKS = JSON.stringify({
      keys: [{ kty: 'RSA', n: 'abc', e: 'AQAB', d: 'secret', kid: 'persona-dev-1' }],
    });
    await load(service);

    expect(keys.rows.map((k) => k.kid)).toEqual([stored]);
  });

  it('adopts only one key from a set that holds several', async () => {
    process.env.OIDC_JWKS = JSON.stringify({
      keys: [
        { kty: 'RSA', n: 'one', e: 'AQAB', d: 's', kid: 'first' },
        { kty: 'RSA', n: 'two', e: 'AQAB', d: 's', kid: 'second' },
      ],
    });
    const { service, keys } = build();
    await load(service);
    expect(keys.rows.map((k) => k.kid)).toEqual(['first']);
  });

  it('copes with a key set that has no keys in it', async () => {
    process.env.OIDC_JWKS = JSON.stringify({});
    const { service, keys } = build();
    await load(service);
    // Nothing to adopt, so it mints instead of failing.
    expect(keys.rows).toHaveLength(1);
    expect(keys.rows[0].state).toBe('active');
  });
});
