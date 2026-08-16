import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { hashPassword } from '../src/infrastructure/auth/password';

// autocannon ships no type declarations.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const autocannon = createRequire(import.meta.url)('autocannon') as any;

// Measures the pre-registered threshold from the evaluation chapter: userinfo
// p95 latency against a vault large enough to matter. Every /oidc/me call reads
// the whole vault and writes an audit row, so the vault size is the variable
// under test.
const API = process.env.PERF_API_URL ?? 'http://localhost:4400';
const EMAIL = process.env.PERF_EMAIL ?? 'perf@example.com';
const ITEMS = Number(process.env.PERF_ITEMS ?? 1000);
const DURATION = Number(process.env.PERF_DURATION ?? 30);
const CONNECTIONS = Number(process.env.PERF_CONNECTIONS ?? 10);

const CLIENT_ID = 'clinic';
const CLIENT_SECRET = 'clinic-dev-secret';
const REDIRECT_URI = 'http://localhost:4411/callback';
const SCOPE = 'openid name email phone address birth_date document blood_type eps allergies';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type VaultSeed = {
  kind: string;
  label: string;
  value: string;
  isDefault: boolean;
  nameContext?: string;
  detail?: Record<string, string>;
};

// A vault of ITEMS rows that still obeys the model: only the six multi-value
// kinds are repeated, and every kind has exactly one default.
function vaultItems(): VaultSeed[] {
  const items: VaultSeed[] = [
    {
      kind: 'name',
      label: 'Legal',
      value: 'Perf Test Legal Name',
      isDefault: true,
      nameContext: 'legal',
      detail: { firstName: 'Perf Test', lastName: 'Legal Name' },
    },
    {
      kind: 'name',
      label: 'Preferred',
      value: 'Perf Tester',
      isDefault: false,
      nameContext: 'preferred',
      detail: { firstName: 'Perf', lastName: 'Tester' },
    },
    { kind: 'username', label: 'Handle', value: 'perftester', isDefault: true },
    { kind: 'birth_date', label: 'Birth date', value: '1990-01-01', isDefault: true },
    { kind: 'blood_type', label: 'Blood type', value: 'O+', isDefault: true },
    { kind: 'eps', label: 'EPS', value: 'Sura', isDefault: true },
  ];

  // Everything after this point is filler in the multi-value kinds, which is
  // what a large real vault would mostly be.
  const fillers = [
    (i: number) => ({ kind: 'email', label: `Email ${i}`, value: `perf+${i}@example.com` }),
    (i: number) => ({ kind: 'phone', label: `Phone ${i}`, value: `+57 300 000 ${1000 + i}` }),
    (i: number) => ({
      kind: 'address',
      label: `Address ${i}`,
      value: `Calle ${i} # 10-20, Bogotá`,
      detail: { street: `Calle ${i} # 10-20`, city: 'Bogotá', country: 'CO' },
    }),
    (i: number) => ({ kind: 'allergy', label: `Allergy ${i}`, value: `Substance ${i}` }),
    (i: number) => ({
      kind: 'document',
      label: `Document ${i}`,
      value: String(1000000000 + i),
      detail: { type: 'CC', issueDate: '2012-09-01', issuePlace: 'Bogotá D.C.' },
    }),
  ];

  const seen = new Set<string>();
  for (let i = 0; items.length < ITEMS; i += 1) {
    const built = fillers[i % fillers.length](i);
    // The first of each filler kind carries the default flag.
    const isDefault = !seen.has(built.kind);
    seen.add(built.kind);
    items.push({ ...built, isDefault });
  }
  return items.slice(0, ITEMS);
}

async function seedPerfUser(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    create: { email: EMAIL, passwordHash: await hashPassword('password123') },
    update: {},
  });

  const count = await prisma.vaultItem.count({ where: { userId: user.id } });
  if (count === ITEMS) {
    console.log(`vault already holds ${ITEMS} items for ${EMAIL}`);
    return;
  }

  // Rebuild rather than top up, so the row count is exactly what is reported.
  await prisma.consent.deleteMany({ where: { userId: user.id } });
  await prisma.vaultItem.deleteMany({ where: { userId: user.id } });
  await prisma.vaultItem.createMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: vaultItems().map((item) => ({ ...item, userId: user.id })) as any,
  });
  console.log(`seeded ${ITEMS} vault items for ${EMAIL}`);
}

// Minimal cookie jar. The session cookie and oidc-provider's interaction
// cookies all live on the same origin, so one jar covers the whole flow.
const jar = new Map<string, string>();

function cookieHeader(): string {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API}${path}`;
  const res = await fetch(url, {
    ...init,
    redirect: 'manual',
    headers: { accept: 'application/json', cookie: cookieHeader(), ...(init.headers ?? {}) },
  });
  for (const raw of res.headers.getSetCookie()) {
    const [pair] = raw.split(';');
    const index = pair.indexOf('=');
    jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
  return res;
}

const uidFrom = (location: string): string => location.split('/interaction/')[1].split('?')[0];

// Drives a real authorization-code flow and returns the access token. Uses the
// development-only login endpoint, so no password is handled anywhere here.
async function mintAccessToken(): Promise<string> {
  const challenge = await call('/api/auth/dev/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL }),
  }).then((res) => res.json());

  const verified = await call('/api/auth/login/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      challengeId: challenge.data.challengeId,
      code: challenge.data.code,
    }),
  });
  if (!verified.ok) throw new Error(`login failed: ${verified.status}`);

  const query = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    scope: SCOPE,
    redirect_uri: REDIRECT_URI,
    state: 'perf',
  });
  let res = await call(`/oidc/auth?${query}`);

  // Signed in already, so the login prompt resolves silently.
  res = await call(`/interaction/${uidFrom(res.headers.get('location')!)}`);
  res = await call((await res.json()).redirectTo);

  const consentUid = uidFrom(res.headers.get('location')!);
  await call(`/interaction/${consentUid}`);
  res = await call(`/interaction/${consentUid}/decision`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  res = await call((await res.json()).redirectTo);

  const code = new URL(res.headers.get('location')!).searchParams.get('code');
  if (!code) throw new Error(`no authorization code: ${res.headers.get('location')}`);

  const token = await call('/oidc/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }).toString(),
  }).then((res) => res.json());

  if (!token.access_token) throw new Error(`no access token: ${JSON.stringify(token)}`);
  return token.access_token;
}

// autocannon reports p90 and p97.5 but not p95, and p95 is the pre-registered
// threshold, so it is computed from the recorded samples instead.
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(rank, 0), sorted.length - 1)];
}

type Run = {
  connections: number;
  requests: number;
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  max: number;
  throughput: number;
  p90: number;
  p97_5: number;
  nonOk: [number, number][];
};

async function benchmark(accessToken: string, connections: number): Promise<Run> {
  const samples: number[] = [];
  const statuses = new Map<number, number>();

  const instance = autocannon({
    url: `${API}/oidc/me`,
    connections,
    duration: DURATION,
    headers: { authorization: `Bearer ${accessToken}` },
  });
  instance.on('response', (_client: unknown, statusCode: number, _bytes: number, rtt: number) => {
    samples.push(rtt);
    statuses.set(statusCode, (statuses.get(statusCode) ?? 0) + 1);
  });

  const result = await new Promise<Record<string, never>>((resolvePromise, reject) => {
    instance.on('done', resolvePromise);
    instance.on('error', reject);
  });

  const sorted = [...samples].sort((a, b) => a - b);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latency = (result as any).latency;

  return {
    connections,
    requests: samples.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    mean: latency.average,
    max: latency.max,
    throughput: samples.length / DURATION,
    p90: latency.p90,
    p97_5: latency.p97_5,
    nonOk: [...statuses.entries()].filter(([status]) => status !== 200),
  };
}

function report(runs: Run[]): string {
  const loaded = runs[runs.length - 1];
  const bad = runs.flatMap((run) => run.nonOk);
  const row = (run: Run): string =>
    `| ${run.connections} | ${run.requests} | ${run.p50.toFixed(1)} | ` +
    `**${run.p95.toFixed(1)}** | ${run.p99.toFixed(1)} | ${run.mean.toFixed(1)} | ` +
    `${run.max.toFixed(1)} | ${Math.round(run.throughput)} |`;

  return [
    '# Performance — measured',
    '',
    '<!-- Generated by persona/scripts/perf-userinfo.ts. Do not edit by hand. -->',
    '',
    `\`GET /oidc/me\` against a vault of **${ITEMS} items**, ${DURATION}s per run,`,
    'driven by autocannon against the API running in Docker on the development',
    'machine. Each call reads the whole vault and writes one audit row, so vault',
    'size is the variable under test.',
    '',
    `**${bad.length === 0 ? 'Every request returned 200.' : `NOT ALL OK: ${JSON.stringify(bad)}`}**`,
    '',
    '| Connections | Requests | p50 | **p95** | p99 | mean | max | req/s |',
    '|---|---|---|---|---|---|---|---|',
    ...runs.map(row),
    '',
    'All figures in milliseconds. p95 is computed from the recorded per-response',
    'latencies because autocannon reports p90 and p97.5 but not p95; at',
    `${loaded.connections} connections those were ${loaded.p90} ms and ${loaded.p97_5} ms,`,
    'which bracket the p95 above.',
    '',
    `Threshold was pre-registered at **p95 < 200 ms**. Under load: ` +
      `**${loaded.p95 < 200 ? 'met' : 'NOT met'}** (${loaded.p95.toFixed(1)} ms).`,
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  await seedPerfUser();
  const accessToken = await mintAccessToken();
  console.log('access token minted; starting benchmark');

  const runs: Run[] = [];
  // One connection gives the latency floor; the second run is the loaded case.
  for (const connections of [1, CONNECTIONS]) {
    console.log(`running ${DURATION}s at ${connections} connection(s)`);
    runs.push(await benchmark(accessToken, connections));
  }

  const out = resolve(import.meta.dirname, '../../references/performance.md');
  const text = report(runs);
  writeFileSync(out, text);
  console.log(`\n${text}\nwritten to ${out}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
