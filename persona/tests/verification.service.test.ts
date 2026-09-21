import { CHALLENGE_PATH, CHALLENGE_TTL_MS } from '../src/constants/verification';
import { UnsafeTargetError } from '../src/infrastructure/http/challenge-fetch';
import { VerificationService, redirectHost } from '../src/services/verification.service';
import { FakeClients, client, errorFrom } from './support/fakes';

// The fetcher is swapped for one that answers from a script, so these tests are
// about the verification rules. Whether the real fetcher can be talked into
// reaching a private address is tested separately, in private-addresses.test.ts
// and challenge-fetch.int.test.ts.
function build() {
  const clients = new FakeClients();
  const calls: string[] = [];
  const answers = new Map<string, { status: number; body: string }>();
  let now = Date.UTC(2026, 0, 1);

  const fetcher = async (url: URL) => {
    calls.push(url.toString());
    const answer = answers.get(url.toString());
    if (!answer) throw new UnsafeTargetError('nothing is listening');
    return answer;
  };

  return {
    clients,
    calls,
    // What the domain serves. Set after issuing, the way a developer would put
    // the file in place after being given the token.
    serve: (url: string, status: number, body: string) => answers.set(url, { status, body }),
    advance: (ms: number) => { now += ms; },
    service: new VerificationService(clients, fetcher, () => now),
  };
}

describe('redirectHost', () => {
  it('is the host every redirect URI shares', () => {
    expect(
      redirectHost(
        client({
          redirectUris: ['https://clinic.example/callback', 'https://clinic.example/other'],
        }),
      ),
    ).toBe('clinic.example');
  });

  // Verification answers "where is this app served from". Two answers is no
  // answer, and the consent screen has one line to say it on.
  it('refuses when the redirect URIs are on different hosts', () => {
    expect(() =>
      redirectHost(
        client({ redirectUris: ['https://a.example/cb', 'https://b.example/cb'] }),
      ),
    ).toThrow(/same domain/);
  });

  it('refuses when there are no redirect URIs at all', () => {
    expect(() => redirectHost(client({ redirectUris: [] }))).toThrow(/Register a redirect URI/);
  });

  it('ignores the case of the host', () => {
    expect(redirectHost(client({ redirectUris: ['https://Clinic.EXAMPLE/cb'] }))).toBe(
      'clinic.example',
    );
  });
});

describe('VerificationService', () => {
  const app = client({ redirectUris: ['https://clinic.example/callback'] });

  describe('issue', () => {
    it('hands back the domain, the path to serve and a token', async () => {
      const { service, clients } = build();
      clients.rows.push(app);

      const challenge = await service.issue(app);

      expect(challenge.domain).toBe('clinic.example');
      expect(challenge.url).toBe(`https://clinic.example${CHALLENGE_PATH}`);
      expect(challenge.token).toHaveLength(43);
      expect(clients.rows[0].verificationToken).toBe(challenge.token);
    });

    it('gives a different token every time', async () => {
      const { service, clients } = build();
      clients.rows.push(app);
      const first = await service.issue(app);
      const second = await service.issue({ ...app, verificationToken: first.token });
      expect(second.token).not.toBe(first.token);
    });
  });

  describe('check', () => {
    it('records the domain when the token comes back', async () => {
      const { service, clients, serve } = build();
      clients.rows.push(app);
      const challenge = await service.issue(app);
      serve(challenge.url, 200, challenge.token);

      const result = await service.check(clients.rows[0]);

      expect(result).toEqual({ verified: true, domain: 'clinic.example' });
      expect(clients.rows[0].verifiedDomain).toBe('clinic.example');
      expect(clients.rows[0].verifiedAt).not.toBeNull();
      // The token is spent, so the same file cannot go on verifying.
      expect(clients.rows[0].verificationToken).toBeNull();
    });

    it('tolerates trailing whitespace in the served file', async () => {
      const { service, clients, serve } = build();
      clients.rows.push(app);
      const challenge = await service.issue(app);
      serve(challenge.url, 200, `${challenge.token}\n`);

      expect(await service.check(clients.rows[0])).toEqual({
        verified: true,
        domain: 'clinic.example',
      });
    });

    it('refuses a different token', async () => {
      const { service, clients, serve } = build();
      clients.rows.push(app);
      const challenge = await service.issue(app);
      serve(challenge.url, 200, 'some-other-token');

      const result = await service.check(clients.rows[0]);
      expect(result.verified).toBe(false);
      expect(result.reason).toMatch(/different token/);
      expect(clients.rows[0].verifiedDomain).toBeNull();
    });

    it('refuses a token that is merely a prefix of the real one', async () => {
      const { service, clients, serve } = build();
      clients.rows.push(app);
      const challenge = await service.issue(app);
      serve(challenge.url, 200, challenge.token.slice(0, -1));

      expect((await service.check(clients.rows[0])).verified).toBe(false);
    });

    it('refuses when the file is not there', async () => {
      const { service, clients, serve } = build();
      clients.rows.push(app);
      const challenge = await service.issue(app);
      serve(challenge.url, 404, 'Not Found');

      const result = await service.check(clients.rows[0]);
      expect(result.verified).toBe(false);
      expect(result.reason).toMatch(/answered 404/);
    });

    // An unreachable or unsafe target is a failed verification, not a 500: the
    // developer needs to be told what is wrong with their domain.
    it('reports an unsafe target as a failure rather than throwing', async () => {
      const { service, clients } = build();
      clients.rows.push(app);
      await service.issue(app);

      const result = await service.check(clients.rows[0]);
      expect(result.verified).toBe(false);
      expect(result.reason).toBe('nothing is listening');
    });

    it('refuses to check before a challenge was issued', async () => {
      const { service } = build();
      const err = await errorFrom(service.check(app));
      expect(err.code).toBe('NO_CHALLENGE');
    });

    it('refuses a challenge that has gone stale', async () => {
      const { service, clients, advance } = build();
      clients.rows.push(app);
      await service.issue(app);
      advance(CHALLENGE_TTL_MS + 1000);

      const err = await errorFrom(service.check(clients.rows[0]));
      expect(err.code).toBe('CHALLENGE_EXPIRED');
    });

    it('asks the domain in the redirect URIs, not one the caller supplies', async () => {
      const { service, clients, calls } = build();
      clients.rows.push(app);
      await service.issue(app);
      await service.check(clients.rows[0]);

      expect(calls).toEqual([`https://clinic.example${CHALLENGE_PATH}`]);
    });
  });

  describe('clear', () => {
    it('takes the proof down', async () => {
      const { service, clients } = build();
      clients.rows.push({
        ...app,
        verifiedDomain: 'clinic.example',
        verifiedAt: new Date(),
      });

      await service.clear(app.id);

      expect(clients.rows[0].verifiedDomain).toBeNull();
      expect(clients.rows[0].verifiedAt).toBeNull();
    });
  });
});
