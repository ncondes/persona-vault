import express from 'express';

// Two relying-party demos served from one server (both register redirect URIs on
// this port). They run the real OAuth flow against Persona and show what was
// shared. Run with: npm run demo  (needs Persona running on :4400)

const PORT = 4410;
const PERSONA = 'http://localhost:4400/oidc';

interface DemoClient {
  secret: string;
  scope: string;
  label: string;
  emoji: string;
  tagline: string;
}

const CLIENTS: Record<string, DemoClient> = {
  clinic: {
    secret: 'clinic-dev-secret',
    scope: 'openid name email phone address',
    label: 'City Health Clinic',
    emoji: '🏥',
    tagline: 'New patient intake — skip the paperwork.',
  },
  forum: {
    secret: 'forum-dev-secret',
    scope: 'openid name',
    label: 'Hobbyist Forum',
    emoji: '💬',
    tagline: 'Join the conversation under your public name.',
  },
};

function esc(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

function page(body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Persona demo clients</title>
<style>
  body{font-family:system-ui,sans-serif;background:#eef2f7;margin:0;color:#16161a}
  .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem}
  .card{background:#fff;border-radius:16px;padding:2rem;max-width:32rem;width:100%;box-shadow:0 10px 30px rgba(0,0,0,.06)}
  h1{margin:.2rem 0}.muted{color:#6b7280}
  a.btn,button{display:inline-block;background:#0ea5e9;color:#fff;border:0;border-radius:9px;padding:.7rem 1.1rem;font-weight:600;text-decoration:none;cursor:pointer;margin-top:.5rem}
  .apps{display:flex;gap:1rem;flex-wrap:wrap;align-items:stretch}
  .apps>div{flex:1;min-width:13rem;border:1px solid #e5e7eb;border-radius:12px;padding:1rem;display:flex;flex-direction:column}
  .apps a.btn{margin-top:auto;align-self:flex-start}
  dl{display:grid;grid-template-columns:auto 1fr;gap:.4rem 1rem}dt{color:#6b7280}
  pre{background:#f6f7f9;border-radius:10px;padding:1rem;overflow:auto}
</style></head><body><div class="wrap"><div class="card">${body}</div></div></body></html>`;
}

const app = express();

app.get('/', (_req, res) => {
  const cards = Object.entries(CLIENTS)
    .map(
      ([id, c]) => `<div><h2>${c.emoji} ${esc(c.label)}</h2>
        <p class="muted">${esc(c.tagline)}</p>
        <a class="btn" href="/connect/${id}">Connect with Persona</a></div>`,
    )
    .join('');
  res.send(page(`<h1>Persona demo clients</h1>
    <p class="muted">Same person, different apps — see what each one receives.</p>
    <div class="apps">${cards}</div>`));
});

app.get('/connect/:client', (req, res) => {
  const client = CLIENTS[req.params.client];
  if (!client) {
    res.status(404).send(page('<h1>Unknown demo client</h1>'));
    return;
  }
  const url = new URL(`${PERSONA}/auth`);
  url.searchParams.set('client_id', req.params.client);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', client.scope);
  url.searchParams.set('redirect_uri', `http://localhost:${PORT}/callback/${req.params.client}`);
  url.searchParams.set('state', 'demo');
  res.redirect(url.toString());
});

app.get('/callback/:client', async (req, res, next) => {
  try {
    const id = req.params.client;
    const client = CLIENTS[id];
    const code = String(req.query.code ?? '');
    if (!client || !code) {
      res.status(400).send(page('<h1>No code returned</h1>'));
      return;
    }

    const tokenRes = await fetch(`${PERSONA}/token`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: 'Basic ' + Buffer.from(`${id}:${client.secret}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `http://localhost:${PORT}/callback/${id}`,
      }),
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

    res.send(page(`<h1>${client.emoji} ${esc(client.label)}</h1>
      <p class="muted">Persona shared the following:</p>
      <dl>${rows || '<dt>(nothing)</dt><dd></dd>'}</dl>
      <p><a href="/">Back to demos</a></p>`));
  } catch (err) {
    next(err);
  }
});

app.listen(PORT, () => {
  console.log(`Persona demo clients running — open http://localhost:${PORT}`);
});
