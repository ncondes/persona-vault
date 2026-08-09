# Hobbyist Forum

A message board. Its argument is how little it needs: a name to post under and a handle, and it says so out loud.

Runs on **:4412**. Declares the **`social`** purpose to Persona.

## Scopes requested

`openid name username`

Persona suggests the **public** name, because the app declared the `social` purpose. The home screen lists everything Persona could have released and this board never asked for — struck through.

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
