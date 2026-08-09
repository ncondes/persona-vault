# Persona

A personal data vault with consent-based sharing. A person stores their data
once — names, contact details, Colombian identity document, health basics —
and apps connect through OAuth/OpenID Connect ("Connect with Persona") to
receive only the values the user approves, with the right value suggested for
each context. Every grant, release and revocation is audited.

Built on the **Project Idea 7.1** template (CM3035). This folder is the working
application; the academic write-ups live under `../tasks/`.

## Stack

- Node.js + Express + TypeScript
- PostgreSQL via Prisma (runs in Docker)
- node-oidc-provider for OAuth 2.0 / OpenID Connect
- Jest + Supertest for tests
- Next.js + Tailwind + shadcn/ui front end (in `web/`)

## How sharing works

- The vault holds **items**: each kind (name, email, address, document, …) can
  hold several values with labels ("Personal", "Work") and one default.
- A connecting app redirects to Persona's consent screen. Each requested field
  shows its candidate values with a **context-aware suggestion** (a clinic is
  offered the legal name, a forum the public one); the user can pick another
  value, exclude optional fields, and fill missing required data inline.
- What the user approves is stored per field and is exactly what the app
  receives at the userinfo endpoint — live values, so later edits propagate.
- Sensitive kinds (address, document, birth date, health data) are flagged so
  the consent screen can add friction; required fields cannot be excluded.

## Architecture

Clean, layered, interface-driven:

```
routes -> controllers -> services -> repositories -> database
```

- `src/controllers` — HTTP layer only (parse request, call service, format response)
- `src/services` — business logic (vault rules, context engine, consent decisions)
- `src/repositories` — data access (wrap Prisma); depend on interfaces in `src/domain/interfaces`
- `src/oidc` — provider config, interaction endpoints, grant revocation
- `src/constants` — vault kind metadata, code catalogs, scopes, demo clients
- `src/container.ts` — wires dependencies together (constructor injection)
- `src/middlewares` — auth, request logging, centralized error handling, validation
- `src/domain` — models, interfaces, and error types
- `src/config` — typed configuration from environment variables

## API overview

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/auth/register` (firstName, lastName, email, password), `login`, `logout`, `GET /api/auth/me` |
| Vault | `GET /api/vault`, `POST /api/vault/items`, `PUT/DELETE /api/vault/items/:id` |
| Catalog | `GET /api/catalog` — document types, blood types, EPS codes, purposes, the scope catalog, kind metadata |
| Apps (developer console) | `GET/POST /api/apps`, `GET/PUT/DELETE /api/apps/:id`, `POST /api/apps/:id/secret` (rotate), `POST /api/apps/preview`, `GET /api/apps/:id/activity` |
| Connections | `GET /api/connections` (with shared-value snapshots), `DELETE /api/connections/:clientId` |
| Audit | `GET /api/audit` — grant / release / revoke history |
| Settings | `GET/PUT /api/settings` — privacy toggles |
| Account | `GET /api/export` (JSON download), `DELETE /api/account` |
| OIDC | `/oidc/*` (authorize, token, userinfo) + `/interaction/:uid` (JSON via `Accept: application/json`, HTML fallback), `POST .../login`, `POST .../decision`, `POST .../abort` |

## Running (development)

```bash
npm install
cp .env.example .env    # then adjust if needed
npm run db:up           # Postgres in Docker
npx prisma migrate dev  # apply migrations
npm run db:seed         # demo user + demo clients
npm run dev             # starts the API on http://localhost:4400
```

The web app (onboarding, vault, consent screen, connections, settings):

```bash
cd web && npm install && npm run dev   # http://localhost:4420
```

`WEB_URL` in `.env` sends the OIDC login/consent pages to the web app. It is
deliberately unset in tests (`tests/int.setup.js`) so the built-in HTML
fallback stays covered — don't "clean that up".

Seeded logins, both `password123`:

- `camila@example.com` — a filled vault, for the sharing flows.
- `dev@example.com` — owns the three demo apps in the developer console.

Relying parties are rows in the database, registered through the console (or by
the seed, which calls the same service). The OIDC provider reads them through
the Prisma adapter in `src/oidc/adapter.ts`, which also stores every session,
grant, authorization code and access token — so connections survive a restart.

Run the tests:

```bash
npm test                 # unit — 213 tests, no database
npm run test:int         # integration — 125 tests (needs the Docker database)
npm run test:cov         # both together, with coverage; fails if coverage drops
npm run typecheck:tests  # tsconfig.json excludes tests, so `npm run build` skips them
npm run acceptance       # regenerates ../references/acceptance.md
```

338 tests, 96.6% of statements and 92.4% of branches. Split by filename:
`*.int.test.ts` needs Postgres, everything else does not. The integration tests
create and delete their own rows and never truncate, but they expect the database
to be migrated and seeded first.

Coverage floors live in `jest.all.config.js`, set a few points under what the
suite reaches so it can only go up. What is left uncovered is deliberate:
`src/index.ts` is the process bootstrap, and `src/oidc/keys.ts` only generates a
JWKS the first time a clone runs.

Two test files are worth knowing about:

- **`tests/acceptance.int.test.ts`** — the project's claims as executable
  statements, one person and three apps. Its names are the requirement table in
  `../references/acceptance.md`.
- **`tests/oidc-payload.repository.int.test.ts`** — as well as covering the
  adapter's storage, it runs the same operations through the real repository and
  through the in-memory fake the unit tests use, and compares. Without that, a
  drifting fake would quietly make `tests/oidc-adapter.test.ts` prove nothing.

## Ports

| Service | Port |
|---------|------|
| Persona API | 4400 |
| PostgreSQL (host) | 55432 (container 5432) |
| Persona web app | 4420 |
