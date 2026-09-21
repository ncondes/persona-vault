import { UnsafeTargetError, fetchChallenge } from '../src/infrastructure/http/challenge-fetch';

// The real fetcher, against real name resolution. Marked as an integration test
// because it does DNS, not because it needs the database.
//
// Every case here is a way somebody could try to turn domain verification into
// a request the API makes on their behalf. The API sits on a private network
// beside Postgres, Redis and the platform's metadata service.
const limits = { timeoutMs: 2_000, maxBytes: 1_024 };

async function refusal(url: string): Promise<string> {
  try {
    await fetchChallenge(new URL(url), limits);
    throw new Error(`${url} was not refused`);
  } catch (err) {
    if (!(err instanceof UnsafeTargetError)) throw err;
    return err.message;
  }
}

describe('fetchChallenge', () => {
  it('refuses plain http', async () => {
    expect(await refusal('http://example.com/.well-known/persona-challenge.txt')).toMatch(/https/);
  });

  // Otherwise the verification endpoint is a port scanner for the private
  // network it sits on.
  it('refuses a non-default port', async () => {
    expect(await refusal('https://example.com:8443/x')).toMatch(/default https port/);
  });

  it.each([
    ['https://localhost/x'],
    ['https://127.0.0.1/x'],
    ['https://[::1]/x'],
    ['https://10.0.0.1/x'],
    ['https://192.168.1.1/x'],
    ['https://169.254.169.254/x'],
  ])('refuses %s', async (url) => {
    expect(await refusal(url)).toMatch(/address|resolve/);
  });

  it('refuses a name that does not resolve', async () => {
    expect(
      await refusal('https://this-name-does-not-exist.invalid/.well-known/persona-challenge.txt'),
    ).toMatch(/does not resolve/);
  });

  // The library's own resolver is used, so a hosts-file entry pointing a real
  // name at 127.0.0.1 is caught by the address check rather than the name.
  it('names the reason, so a developer can fix their domain', async () => {
    expect(await refusal('https://127.0.0.1/x')).toBe(
      '127.0.0.1 resolves to a loopback address',
    );
  });
});
