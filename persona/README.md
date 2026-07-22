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
| Auth | `POST /api/auth/register` (fullName, email, password), `login`, `logout`, `GET /api/auth/me` |
| Vault | `GET /api/vault`, `POST /api/vault/items`, `PUT/DELETE /api/vault/items/:id` |
| Catalog | `GET /api/catalog` — document types, blood types, EPS codes, kind metadata |
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

Demo relying parties (clinic, forum, store):

```bash
npm run demo            # http://localhost:4410
```

Seeded demo login: `camila@example.com` / `password123`.

Run the tests:

```bash
npm test        # unit
npm run test:int  # integration (needs the Docker database)
```

## Ports

| Service | Port |
|---------|------|
| Persona API | 4400 |
| PostgreSQL (host) | 55432 (container 5432) |
| Demo relying parties | 4410 |
| Persona web app | 4420 |
