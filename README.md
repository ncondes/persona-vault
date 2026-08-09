# Persona

A consent-based identity provider. A person stores their data once — names,
contact details, identity document, health basics — and apps connect over
OAuth/OpenID Connect to receive **only the fields they approved**, with the
right value suggested for the context they are being asked in.

A clinic is offered the legal name. A forum is offered the public one. The
person can override either, and withdraw both.

CM3035 Advanced Web Design final project — Nicolas Conde Salazar, 220137157,
Project Idea 7.1 (Identity and profile management API).

## Run everything

```bash
docker compose up
```

That is the whole setup. The API migrates and seeds the database on boot, which
is what registers the three demo apps as OAuth clients.

| | Address | What it is |
|---|---|---|
| **Persona** | http://localhost:4420 | The vault, consent screen, connections and developer console |
| Persona API | http://localhost:4400 | REST API + OIDC provider (`/oidc/*`) |
| City Health Clinic | http://localhost:4411 | Demo relying party — `healthcare` |
| Hobbyist Forum | http://localhost:4412 | Demo relying party — `social` |
| Tiger Store | http://localhost:4413 | Demo relying party — `retail` |
| PostgreSQL | localhost:55432 | user/password/db all `persona` |

Two seeded logins, both `password123`:

- **`camila@example.com`** — a filled vault. Use this to connect the demo apps.
- **`dev@example.com`** — owns the three demo apps in the developer console.

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
| [`demos/`](./demos) | Three independent relying parties, one folder each |
| `tasks/`, `references/` | Coursework documents and working notes, not part of the system |

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

## Tests

The API needs a running database; nothing else does.

```bash
cd persona
npm run db:up            # Postgres, if it is not already running

npm test                 # unit — 250 tests, no database
npm run test:int         # integration — 151 tests against real Postgres and a real OAuth flow
npm run test:cov         # both, with merged coverage; fails if coverage drops
npm run typecheck:tests  # the test files themselves (the build does not cover them)
npm run acceptance       # regenerates references/acceptance.md

cd web && npm test       # 229 tests over the app's pure logic
cd ../../demos/clinic && npm test   # 94 tests over the relying-party plumbing
```

Integration tests write to the local development database in Docker. They create
and delete their own rows and never truncate, but they do expect it to be
migrated and seeded first — which `docker compose up` does on boot.

| Suite | Tests | Statements | Branches |
|---|---|---|---|
| `persona` (unit + integration) | 401 | 96.8% | 91.6% |
| `persona/web` | 229 | 91.8% | 95.5% |
| `demos/clinic` | 94 | 100% | 100% |

Only the clinic demo is tested. The three demos duplicate their OAuth plumbing on
purpose, and `demos/clinic/src/lib/parity.test.ts` fails if the forum's or the
store's copy drifts from it — which is what makes testing one of them enough.

[`references/acceptance.md`](references/acceptance.md) is generated from
`persona/tests/acceptance.int.test.ts`, whose test names are the project's own
claims. Don't edit it by hand.
