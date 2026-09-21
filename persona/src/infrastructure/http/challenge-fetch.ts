import { lookup as dnsLookup } from 'node:dns/promises';
import { request } from 'node:https';
import { privateAddressReason } from './private-addresses';

export class UnsafeTargetError extends Error {}

// The part of an incoming response this module uses. Narrower than
// IncomingMessage so a test can stand one up without a socket.
export interface ChallengeResponse {
  statusCode?: number;
  setEncoding(encoding: string): void;
  on(event: 'data', listener: (chunk: string) => void): void;
  on(event: 'end', listener: () => void): void;
  destroy(): void;
}

export interface FetchLimits {
  timeoutMs: number;
  maxBytes: number;
}

// Fetches a domain-verification challenge, and nothing else.
//
// Everything about it is narrow on purpose, because this is the only place the
// API makes an outbound request to an address someone else chose:
//
//   * https only, on the default port — no http, no arbitrary port to sweep
//   * the hostname is resolved first and refused if it points anywhere private
//   * the connection is pinned to the address that was checked, so the name
//     cannot resolve to something else between the check and the connection
//   * no redirects are followed at all, because a redirect is a second target
//     that was never checked
//   * a short timeout and a hard byte cap, so neither a slow nor an endless
//     response ties anything up
//
// Certificate validation still happens against the hostname: pinning the
// address changes where the socket goes, not who it trusts.
export async function fetchChallenge(
  url: URL,
  limits: FetchLimits,
): Promise<{ status: number; body: string }> {
  if (url.protocol !== 'https:') {
    throw new UnsafeTargetError('the challenge must be served over https');
  }
  if (url.port !== '') {
    throw new UnsafeTargetError('the challenge must be served on the default https port');
  }

  const resolved = await dnsLookup(url.hostname, { all: true }).catch(() => {
    throw new UnsafeTargetError(`${url.hostname} does not resolve`);
  });
  if (resolved.length === 0) {
    throw new UnsafeTargetError(`${url.hostname} does not resolve`);
  }

  // Every address it resolves to has to be public, not just the first: a name
  // answering with one public and one private address would otherwise be a way
  // in on a retry.
  for (const { address } of resolved) {
    const reason = privateAddressReason(address);
    if (reason) {
      throw new UnsafeTargetError(`${url.hostname} resolves to a ${reason} address`);
    }
  }

  const pinned = resolved[0];

  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        // Node calls this instead of resolving the name again, so the socket
        // goes to the address that was just checked.
        lookup: (_hostname, _options, callback) =>
          callback(null, pinned.address as never, pinned.family as never),
        headers: { accept: 'text/plain', 'user-agent': 'Persona domain verification' },
        timeout: limits.timeoutMs,
      },
      (res) => readChallengeResponse(res, limits.maxBytes).then(resolve, reject),
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new UnsafeTargetError('the challenge URL timed out'));
    });
    req.on('error', (err) => reject(new UnsafeTargetError(err.message)));
    req.end();
  });
}

// What to do with whatever comes back. Separated from the request itself so the
// rules — no redirects, a hard byte cap — can be tested without either a bypass
// in the address check above or a live server to point at. Making the guard
// configurable enough to test end to end would mean a way to turn it off, which
// is a worse thing to have than an untested call to https.request.
export function readChallengeResponse(
  res: ChallengeResponse,
  maxBytes: number,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    // A redirect is a target nobody checked. Read nothing and stop.
    if (res.statusCode !== undefined && res.statusCode >= 300 && res.statusCode < 400) {
      res.destroy();
      reject(new UnsafeTargetError('the challenge URL redirects, which is not followed'));
      return;
    }

    let body = '';
    let stopped = false;
    res.setEncoding('utf8');
    res.on('data', (chunk: string) => {
      if (stopped) return;
      body += chunk;
      if (body.length > maxBytes) {
        stopped = true;
        res.destroy();
        reject(new UnsafeTargetError('the challenge response is too large'));
      }
    });
    res.on('end', () => {
      if (!stopped) resolve({ status: res.statusCode ?? 0, body });
    });
  });
}
