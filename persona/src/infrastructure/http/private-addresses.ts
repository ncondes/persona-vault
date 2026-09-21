import { isIP } from 'node:net';

// Address ranges the server must never be talked into fetching from. Domain
// verification makes the API fetch a URL the developer chose, which is a
// server-side request forgery surface that did not exist before — and the API
// sits on a private network next to Postgres, Redis and Railway's metadata.
//
// Written out rather than pulled from a package so each range can say what it
// is: a reviewer should be able to check the list, not trust it.
type Range = { label: string; test: (parts: number[]) => boolean };

const IPV4_RANGES: Range[] = [
  { label: 'unspecified', test: ([a]) => a === 0 },
  { label: 'loopback', test: ([a]) => a === 127 },
  { label: 'private (10/8)', test: ([a]) => a === 10 },
  { label: 'private (172.16/12)', test: ([a, b]) => a === 172 && b >= 16 && b <= 31 },
  { label: 'private (192.168/16)', test: ([a, b]) => a === 192 && b === 168 },
  { label: 'carrier NAT', test: ([a, b]) => a === 100 && b >= 64 && b <= 127 },
  { label: 'link local', test: ([a, b]) => a === 169 && b === 254 },
  { label: 'IETF protocol assignments', test: ([a, b, c]) => a === 192 && b === 0 && c === 0 },
  { label: 'documentation', test: ([a, b, c]) => a === 192 && b === 0 && c === 2 },
  { label: '6to4 relay', test: ([a, b, c]) => a === 192 && b === 88 && c === 99 },
  { label: 'benchmarking', test: ([a, b]) => a === 198 && (b === 18 || b === 19) },
  { label: 'documentation', test: ([a, b, c]) => a === 198 && b === 51 && c === 100 },
  { label: 'documentation', test: ([a, b, c]) => a === 203 && b === 0 && c === 113 },
  { label: 'multicast', test: ([a]) => a >= 224 && a <= 239 },
  { label: 'reserved', test: ([a]) => a >= 240 },
];

function classifyIpv4(address: string): string | null {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return 'unparseable';
  return IPV4_RANGES.find((range) => range.test(parts))?.label ?? null;
}

function classifyIpv6(address: string): string | null {
  const lower = address.toLowerCase().split('%')[0];

  // An IPv4-mapped address is an IPv4 address wearing a hat; 127.0.0.1 written
  // as ::ffff:127.0.0.1 has to be refused for the same reason.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) return classifyIpv4(mapped[1]);

  if (lower === '::') return 'unspecified';
  if (lower === '::1') return 'loopback';

  const head = parseInt(lower.split(':')[0] || '0', 16);
  if ((head & 0xfe00) === 0xfc00) return 'unique local';
  if ((head & 0xffc0) === 0xfe80) return 'link local';
  if ((head & 0xff00) === 0xff00) return 'multicast';
  return null;
}

// Returns what is wrong with the address, or null when it is a public one.
export function privateAddressReason(address: string): string | null {
  const family = isIP(address);
  if (family === 4) return classifyIpv4(address);
  if (family === 6) return classifyIpv6(address);
  return 'unparseable';
}
