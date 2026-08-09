# Tiger Store

A checkout. The received data is rendered as the shipping label it becomes.

Runs on **:4413**. Declares the **`retail`** purpose to Persona.

## Scopes requested

`openid username name email phone address`

Persona suggests the **preferred** name: `retail` has no rule in `PURPOSE_VARIANT`, so it falls back to the default. Address is required, so it cannot be declined at consent.

## Running

```bash
cp .env.example .env
npm install
npm run dev
```

Needs Persona on :4400 and its web app on :4420. From the repo root,
`docker compose up` starts everything at once.

## Layout

| Path | What it does |
|------|--------------|
| `src/lib/persona.ts` | The entire OAuth client: PKCE, state, token exchange, userinfo. Self-contained on purpose — see [`../README.md`](../README.md). |
| `src/app/connect/route.ts` | Starts the flow; parks `state` and the PKCE verifier in short-lived cookies. |
| `src/app/callback/route.ts` | Verifies `state`, exchanges the code, sets the session cookie. |
| `src/app/page.tsx` | Landing, before connecting. |
| `src/app/home/page.tsx` | What this app received, re-read from `/oidc/me` on every load. |
