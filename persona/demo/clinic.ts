import express from 'express';

// A tiny relying-party demo: "City Health Clinic". It runs the real OAuth flow
// against Persona and shows what Persona shared. Run with: npm run demo:clinic
// (reuses Persona's dependencies; needs Persona running on :4400).

const PORT = 4410;
const PERSONA = 'http://localhost:4400/oidc';
const CLIENT_ID = 'clinic';
const CLIENT_SECRET = 'clinic-dev-secret';
const REDIRECT_URI = `http://localhost:${PORT}/callback/clinic`;
const SCOPE = 'openid name email phone address';

function esc(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

function page(body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>City Health Clinic</title>
<style>
  body{font-family:system-ui,sans-serif;background:#eef2f7;margin:0;color:#16161a}
  .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem}
  .card{background:#fff;border-radius:16px;padding:2rem;max-width:30rem;width:100%;box-shadow:0 10px 30px rgba(0,0,0,.06)}
  h1{margin:0 0 .25rem}.muted{color:#6b7280}
  a.btn,button{display:inline-block;background:#0ea5e9;color:#fff;border:0;border-radius:9px;padding:.7rem 1.1rem;font-weight:600;text-decoration:none;cursor:pointer}
  pre{background:#f6f7f9;border-radius:10px;padding:1rem;overflow:auto}
  dl{display:grid;grid-template-columns:auto 1fr;gap:.4rem 1rem}dt{color:#6b7280}
</style></head><body><div class="wrap"><div class="card">🏥 ${body}</div></div></body></html>`;
}

const app = express();

app.get('/', (_req, res) => {
  res.send(
    page(`<h1>City Health Clinic</h1>
      <p class="muted">New patient intake — skip the paperwork.</p>
      <a class="btn" href="/connect">Connect with Persona</a>`),
  );
});

app.get('/connect', (_req, res) => {
  const url = new URL(`${PERSONA}/auth`);
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('state', 'demo');
  res.redirect(url.toString());
});

app.get('/callback/clinic', async (req, res, next) => {
  try {
    const code = String(req.query.code ?? '');
    if (!code) {
      res.status(400).send(page('<h1>No code returned</h1>'));
      return;
    }

    const tokenRes = await fetch(`${PERSONA}/token`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }),
    });
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) {
      res.status(400).send(page(`<h1>Token error</h1><pre>${esc(JSON.stringify(token, null, 2))}</pre>`));
      return;
    }

    const userRes = await fetch(`${PERSONA}/me`, {
      headers: { authorization: `Bearer ${token.access_token}` },
    });
    const claims = (await userRes.json()) as Record<string, unknown>;

    const rows = Object.entries(claims)
      .filter(([k]) => k !== 'sub')
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(String(v))}</dd>`)
      .join('');

    res.send(
      page(`<h1>Welcome${claims.name ? ', ' + esc(String(claims.name)) : ''}</h1>
        <p class="muted">Persona shared the following with the clinic:</p>
        <dl>${rows}</dl>
        <p><a href="/">Start over</a></p>`),
    );
  } catch (err) {
    next(err);
  }
});

app.listen(PORT, () => {
  console.log(`Clinic demo client running — open http://localhost:${PORT}`);
});
