# Persona

A context-aware identity and profile management API. A person stores their
profile once; services connect via OAuth/OpenID Connect and receive only the
fields the user consents to, with the right name variant for the context, and
every release is audited.

Built on the **Project Idea 7.1** template (CM3035). This folder is the working
application; the academic write-ups live under `../tasks/`.

## Stack

- Node.js + Express + TypeScript
- PostgreSQL via Prisma (runs in Docker)
- node-oidc-provider for OAuth 2.0 / OpenID Connect
- Jest + Supertest for tests
- React (Vite) front end (added in a later stage)

## Architecture

Clean, layered, interface-driven:

```
routes -> controllers -> services -> repositories -> database
```

- `src/controllers` — HTTP layer only (parse request, call service, format response)
- `src/services` — business logic
- `src/repositories` — data access (wrap Prisma); depend on interfaces in `src/domain/interfaces`
- `src/container.ts` — wires dependencies together (constructor injection)
- `src/middlewares` — auth, request logging, centralized error handling, validation
- `src/domain` — models, interfaces, and error types
- `src/config` — typed configuration from environment variables

## Running (development)

```bash
npm install
cp .env.example .env   # then adjust if needed
npm run dev            # starts the API on http://localhost:4400
```

Check it is alive:

```bash
curl http://localhost:4400/api/health   # -> {"status":"ok"}
```

Run the tests:

```bash
npm test
```

## Ports

| Service | Port |
|---------|------|
| Persona API | 4400 |
| PostgreSQL (host) | 55432 (container 5432) |
| React dev server | 4410 |
