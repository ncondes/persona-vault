# Persona

A consent-based identity provider. A person stores their data once — names,
contact details, identity document, health basics — and apps connect over
OAuth/OpenID Connect to receive **only the fields they approved**, with the
right value suggested for the context they are being asked in.

A clinic is offered the legal name. A forum is offered the public one. The
person can override either, and withdraw both.

CM3070 Final Project — Nicolas Conde Salazar, 220137157, Project Idea 7.1
(Identity and profile management API).

## Try it without installing anything

| | Address |
|---|---|
| **Persona** | https://persona-id.up.railway.app |
| City Health Clinic | https://city-health-clinic.up.railway.app |
| Hobbyist Forum | https://hobbyist-forum.up.railway.app |
| Tiger Store | https://tiger-store.up.railway.app |
| Probe | https://persona-probe.up.railway.app |

Sign in with the **Demo sign-in** button — one click, no password and no emailed
code — as `camila@example.com`, whose vault is already filled in. Then connect
the three products in turn and watch the same person disclose nine fields and a
legal name to the clinic, two fields and a public name to the forum, and five
fields and a preferred name to the store.

The three products have addresses of their own on purpose: they are meant to
read as unrelated companies, because that is the situation the project is about.
They sleep when nobody is using them, so the first request to one takes a few
seconds.

## Run everything

```bash
docker compose up
```

That is the whole setup. The API migrates and seeds the database on boot, which
is what registers the four demo apps as OAuth clients.

| | Address | What it is |
|---|---|---|
| **Persona** | http://localhost:4420 | The vault, consent screen, connections and developer console |
| Persona API | http://localhost:4400 | REST API + OIDC provider (`/oidc/*`) |
| City Health Clinic | http://localhost:4411 | Demo relying party — `healthcare` |
| Hobbyist Forum | http://localhost:4412 | Demo relying party — `social` |
| Tiger Store | http://localhost:4413 | Demo relying party — `retail` |
| Probe | http://localhost:4414 | A relying party that attacks Persona on purpose |
| PostgreSQL | localhost:55432 | user/password/db all `persona` |

Two seeded logins, both `password123`:

- **`camila@example.com`** — a filled vault. Use this to connect the demo apps.
- **`dev@example.com`** — owns the four demo apps in the developer console.

## The thing worth seeing

Sign in as Camila, then connect all three demo apps in turn. Same person, same
vault, three different disclosures:

| | Fields released | Name variant |
|---|---|---|
| City Health Clinic | 9 | **Legal** — Camila Andrea Rodríguez García |
| Hobbyist Forum | 2 | **Public** — Camila R. |
| Tiger Store | 5 | **Preferred** — Cami Rodríguez |

Nobody chose those name variants by hand. Each app declared a *purpose* when it
was registered, and Persona resolved the purpose to a variant. The person can
override the suggestion on the consent screen, and Persona records every
release in an audit log they can read at `/connections`.

## Layout

| Path | What it is |
|---|---|
| [`persona/`](./persona) | The provider: Express + TypeScript, Prisma + PostgreSQL, `oidc-provider` |
| [`persona/web/`](./persona/web) | The user interface and developer console: Next.js, Tailwind, shadcn/ui |
| [`demos/`](./demos) | Four independent relying parties, one folder each |
| [`references/`](./references) | Generated engineering notes: the acceptance table, the performance runs and the build log |

## Developing without Docker

```bash
cd persona
npm install
cp .env.example .env
npm run db:up              # just PostgreSQL
npx prisma migrate dev
npm run db:seed
npm run dev                # API on :4400

cd web && npm install && npm run dev    # :4420
cd demos/clinic && npm install && npm run dev   # and forum, store
```

`WEB_URL` in `persona/.env` sends the OIDC login and consent pages to the web
app. It is deliberately unset in tests so the built-in HTML fallback stays
covered — don't "clean that up".

**`AUTH_SECRET` must be the same in `persona/.env` and in the environment
Compose sees** (the root `.env`). Registered apps' client secrets are encrypted
with a key derived from it, so running the API under one secret and then
another makes every app unreadable — the provider logs a clear error and treats
them as unknown. Changing it means re-running `npm run db:seed`.

**`RESEND_API_KEY` is required.** Signing up and signing in both send a 6-digit
code by email, and there is no fallback transport to fall back to, so the API
refuses to start without one — get a key at [resend.com](https://resend.com).
`EMAIL_FROM` must be a domain verified in Resend; the default
(`onboarding@resend.dev`) only delivers to the address that owns the Resend
account, which is enough to try the flow out. Tests never need a working key:
they hand the container a stub mailer.

## Deploying it

The hosted copy runs on Railway: six services from this repo plus PostgreSQL and
Redis, each one redeploying when the directory it lives in changes. Every service
has a `railway.json` next to its `package.json`.

Four things are worth knowing before touching it.

**Persona answers on one public origin.** The web app proxies `/api`,
`/interaction` and `/oidc` to the API (`persona/web/next.config.ts`), and the API
has no public domain at all. That is not tidiness — the API sets host-only
cookies and has no CORS handling, and it only works locally because
`localhost:4400` and `localhost:4420` share cookies across ports. Two real
subdomains would not, and the consent flow would dead-end. So the demo apps'
`PERSONA_PUBLIC_URL` points at the **web** app, not the API.

**`API_URL` is read when the web app is built, not when it starts.** Next writes
the rewrite destinations into `.next/routes-manifest.json`. Change it and you
must rebuild; restarting keeps the old value.

**The seed owns the demo apps' redirect URIs.** It runs on every deploy from
`preDeployCommand` and upserts, so setting `CLINIC_URL` and friends and
redeploying the API is how those URIs are corrected — never by hand in the
database.

**The API will not start in production without `REDIS_URL`.** Rate-limit
counters live in Redis so they survive a restart; the in-process fallback is
per-process and empties on every deploy, which would make the limits a control
in name only. So the Redis service has to exist and the variable has to be set
*before* deploying a version that includes them, or the API comes up refusing to
boot. It is set as a reference, `${{Redis.REDIS_URL}}`, so a password rotation
does not break it.

**`TRUST_PROXY_HOPS` is deliberately 0.** The API answers behind the web app's
rewrites, so `req.ip` is the proxy and every caller shares the one IP-keyed
bound. Raising it would only help if the forwarded header survived the chain —
and if it does, a caller can set it themselves and give themselves a private
bucket per spoofed address, which is worse than a shared one. Nothing that
checks a credential keys on it either way.

The variables a hosted copy needs are listed at the bottom of
[`persona/.env.example`](./persona/.env.example). `AUTH_SECRET` must be set once
and never changed: it derives the key that encrypts every registered app's
secret.

Signing in needs a code sent by email, and the seeded accounts live at
`example.com`, which no mail provider will deliver to. So the hosted copy runs
with `DEMO_LOGIN=true`, which offers one-click sign-in as those two accounts on
both sign-in screens and says on the page that it is a demo. It is a way past
the password, so it is refused for any other address.

## Tests

The API needs a running database and a Redis; nothing else does. `npm run db:up`
starts both.

```bash
cd persona
npm run db:up            # Postgres and Redis, if they are not already running

npm test                 # unit — 341 tests, no database
npm run test:int         # integration — 186 tests against real Postgres, Redis and a real OAuth flow
npm run test:cov         # both, with merged coverage; fails if coverage drops
npm run typecheck:tests  # the test files themselves (the build does not cover them)
npm run acceptance       # regenerates references/acceptance.md
npm run perf:ratelimit   # what the limiter costs; regenerates references/performance-ratelimit.md
npm run keys             # which signing keys are published, and what each is doing

cd web && npm test       # 244 tests over the app's pure logic
cd ../../demos/clinic && npm test   # 94 tests over the relying-party plumbing
```

Integration tests write to the local development database in Docker. They create
and delete their own rows and never truncate, but they do expect it to be
migrated and seeded first — which `docker compose up` does on boot.

Counts come from the suites themselves; run them to reproduce the table.

| Suite | Tests | Statements | Branches |
|---|---|---|---|
| `persona` (unit + integration) | 610 | 96.4% | 89.1% |
| `persona/web` | 246 | 92.9% | 95.7% |
| `demos/clinic` | 101 | 100% | 100% |
| `demos/probe` | 9 | — | — |

Only the clinic demo is tested in full. The demos duplicate their OAuth plumbing
on purpose, and `demos/clinic/src/lib/parity.test.ts` fails if the forum's or the
store's copy drifts from it — which is what makes testing one of them enough.
The probe carries its own parity test, since it is allowed one deviation and the
test is what holds it to exactly one.

[`references/acceptance.md`](references/acceptance.md) is generated from
`persona/tests/acceptance.int.test.ts`, whose test names are the project's own
claims. Don't edit it by hand.
