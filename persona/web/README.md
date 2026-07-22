# Persona web

The user-facing app for Persona: onboarding, the data vault, the OAuth consent
screen, connections and settings. Next.js (App Router) + Tailwind + shadcn/ui.

## Running

Needs the backend on :4400 (see `../README.md`) with `WEB_URL=http://localhost:4420`
set in `../.env` so OIDC consent pages open here.

```bash
npm install
npm run dev     # http://localhost:4420
```

The dev server proxies `/api`, `/interaction` and `/oidc` to the backend
(`next.config.ts`), so cookies stay first-party. Those paths must not be
renamed — oidc-provider sets path-scoped cookies on `/interaction/:uid`.

## Layout

- `src/app` — routes: landing, `/login`, `/signup` (onboarding wizard),
  `/authorize/[uid]` (consent app), and the authenticated `(app)` group
  (vault, connections, contexts, settings).
- `src/components/ui` — shadcn components (managed by the CLI).
- `src/components/common|shell|vault|consent|connections|onboarding` — the
  app's own components.
- `src/lib` — API client, types, strings (all UI text, i18n-ready),
  vault section map, and a tiny data-loading hook.
