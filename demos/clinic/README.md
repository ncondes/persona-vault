# City Health Clinic

A new-patient intake form that fills itself. The record card on the landing page is blank; after connecting it is the same card, filled — nothing was typed in between.

Runs on **:4411**. Declares the **`healthcare`** purpose to Persona.

## Scopes requested

`openid name email phone birth_date document blood_type eps allergies address`

Persona suggests the **legal** name, because the app declared the `healthcare` purpose. Blood type, EPS and allergies are rendered in the red alert channel a real chart uses. Declined fields show as *not shared* rather than disappearing.

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
