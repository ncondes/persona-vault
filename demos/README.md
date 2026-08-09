# Demo relying parties

Three unrelated products that connect to Persona. The same person, with the same
vault, ends up sharing very different things with each — which is the whole
argument the project is making.

| App | Port | Purpose | Asks for | Gets the name variant |
|-----|------|---------|----------|----------------------|
| [`clinic`](./clinic) — City Health Clinic | 4411 | `healthcare` | name, email, phone, date of birth, document, blood type, EPS, allergies, address | **Legal** |
| [`forum`](./forum) — Hobbyist Forum | 4412 | `social` | name, username | **Public** |
| [`store`](./store) — Tiger Store | 4413 | `retail` | username, name, email, phone, address | **Preferred** (no rule for `retail`, so the default) |

The name variant is not chosen by the app. Persona picks it from the purpose the
app declared when it was registered, and the person can override it on the
consent screen.

## Why three separate apps

Each one is a standalone Next.js project with its own `package.json`, its own
design, and its own copy of the ~120 lines of OAuth plumbing in
`src/lib/persona.ts`. Nothing is shared.

That duplication is deliberate. These exist to be read as integration examples:
someone wiring Persona into their own product should be able to open one folder
and see the whole thing, rather than chase a shared package. It also keeps them
honestly independent — three unrelated companies would not share a library.

## Running one

```bash
cd clinic
cp .env.example .env
npm install
npm run dev
```

Needs Persona running on :4400 and its web app on :4420. Or bring the whole
system up at once from the repo root with `docker compose up`.

## Registering your own

These three are created by Persona's seed so a clean clone works immediately.
To add a fourth, sign in to Persona as `dev@example.com` and register it in the
developer console — the console hands you a client ID and a secret that go
straight into a `.env` like the ones here.

## What each app does with the token

All three follow the same flow, and all three do it properly:

1. `/connect` builds an authorization URL with a random `state` and a PKCE
   `code_challenge`, parking both in short-lived httpOnly cookies.
2. `/callback` verifies the `state` in constant time, then exchanges the code
   for an access token server-side using `client_secret_basic`.
3. The access token goes in an httpOnly session cookie. Nothing else is stored.
4. Every page load calls `GET /oidc/me` again rather than caching the claims.

Step 4 matters twice over: the userinfo call is what Persona records in the
person's audit log, and reading live means an edit in their vault shows up here
on the next refresh — no profile to keep in sync.

## Tests

Only the clinic has them. Its `src/lib/parity.test.ts` compares all three copies
of the plumbing and fails if any of them drifts, which is what makes testing one
of them enough — and turns the duplication above from something hoped for into
something enforced.

```bash
cd clinic
npm test        # 94 tests
npm run test:cov  # with coverage; the plumbing is at 100% and the floor says so
```

Worth knowing: `persona.test.ts` checks the PKCE challenge against the
**RFC 7636 Appendix B** test vector, so the transform is verified against the
specification rather than merely observed to work. `app/callback/route.test.ts`
walks through every way of failing the state check, since that one line is the
whole CSRF defence.

All three run `npm run lint` and `npm run build` clean.
