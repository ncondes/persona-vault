import { SCOPE_CATALOG } from '../constants/scopes';

// Derived from the catalog so this fallback can never drift from the scopes the
// provider actually supports.
const SCOPE_LABELS = new Map(SCOPE_CATALOG.map((meta) => [meta.scope, meta.label]));

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

export function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root{--ink:#16161a;--muted:#6b7280;--accent:#4f46e5;--line:#e5e7eb}
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0;background:#f6f7f9;color:var(--ink)}
  .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem}
  .card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:2rem;width:100%;max-width:24rem;box-shadow:0 10px 30px rgba(0,0,0,.06)}
  .brand{display:flex;align-items:center;gap:.5rem;font-weight:700;letter-spacing:-.01em;margin-bottom:1.25rem}
  .dot{width:.8rem;height:.8rem;border-radius:50%;background:var(--accent);display:inline-block}
  h1{font-size:1.25rem;margin:0 0 .25rem}
  p{margin:.25rem 0 1rem;color:var(--muted);font-size:.92rem}
  label{display:block;font-size:.85rem;margin:.7rem 0 .25rem;font-weight:500}
  input{width:100%;padding:.6rem .7rem;border:1px solid var(--line);border-radius:9px;font-size:.95rem}
  input:focus{outline:2px solid var(--accent);outline-offset:0;border-color:var(--accent)}
  button{font-size:.95rem;padding:.6rem 1rem;border:0;border-radius:9px;cursor:pointer;font-weight:600}
  .primary{background:var(--accent);color:#fff;width:100%;margin-top:1rem}
  .row{display:flex;gap:.6rem;margin-top:1.25rem}
  .row form{flex:1}
  .row button{width:100%;margin-top:0}
  .secondary{background:#f1f1f4;color:var(--ink)}
  .scopes{list-style:none;padding:0;margin:.5rem 0 0;border:1px solid var(--line);border-radius:10px;overflow:hidden}
  .scopes li{padding:.6rem .8rem;font-size:.92rem;border-top:1px solid var(--line)}
  .scopes li:first-child{border-top:0}
  .err{color:#b91c1c;font-size:.85rem;margin:.5rem 0 0}
</style></head><body><div class="wrap"><div class="card">
  <div class="brand"><span class="dot"></span>Persona</div>
  ${body}
</div></div></body></html>`;
}

export function renderLogin(uid: string, error?: string): string {
  return page('Sign in to Persona', `
    <h1>Sign in</h1>
    <p>Sign in to choose what you share.</p>
    <form method="post" action="/interaction/${encodeURIComponent(uid)}/login">
      <label for="email">Email</label>
      <input id="email" type="email" name="email" autocomplete="email" required>
      <label for="password">Password</label>
      <input id="password" type="password" name="password" autocomplete="current-password" required>
      <button class="primary" type="submit">Sign in</button>
      ${error ? `<p class="err">${escapeHtml(error)}</p>` : ''}
    </form>`);
}

export function renderConsent(uid: string, clientId: string, scope: string): string {
  const items = scope
    .split(' ')
    .filter((s) => s && s !== 'openid')
    .map((s) => `<li>${escapeHtml(SCOPE_LABELS.get(s) ?? s)}</li>`)
    .join('');

  return page('Share with an app', `
    <h1>Share your details?</h1>
    <p><strong>${escapeHtml(clientId)}</strong> is requesting access to:</p>
    <ul class="scopes">${items || '<li>Basic sign-in only</li>'}</ul>
    <div class="row">
      <form method="post" action="/interaction/${encodeURIComponent(uid)}/decision">
        <button class="primary" type="submit">Allow</button>
      </form>
      <form method="post" action="/interaction/${encodeURIComponent(uid)}/abort">
        <button class="secondary" type="submit">Deny</button>
      </form>
    </div>`);
}

export function renderExpired(): string {
  return page('Request expired', `
    <h1>Request expired</h1>
    <p>This sign-in request has expired or was already completed. Please start again
    from the app you were using.</p>`);
}
