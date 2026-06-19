const SCOPE_LABELS: Record<string, string> = {
  name: 'your name',
  email: 'your email address',
  phone: 'your phone number',
  address: 'your address',
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;max-width:24rem;margin:3rem auto;padding:0 1rem;color:#1c1c1c;line-height:1.5}
  h1{font-size:1.3rem;margin:0 0 1rem}
  label{display:block;margin:.6rem 0;font-size:.9rem}
  input{display:block;width:100%;padding:.5rem;margin-top:.2rem;box-sizing:border-box;border:1px solid #ccc;border-radius:6px}
  button{padding:.55rem 1rem;border:0;border-radius:6px;background:#111;color:#fff;cursor:pointer;font-size:.95rem}
  .muted{color:#666}.err{color:#b00}ul{padding-left:1.2rem}
</style></head><body>${body}</body></html>`;
}

export function renderLogin(uid: string, error?: string): string {
  return page('Sign in to Persona', `
    <h1>Sign in to Persona</h1>
    ${error ? `<p class="err">${escapeHtml(error)}</p>` : ''}
    <form method="post" action="/interaction/${encodeURIComponent(uid)}/login">
      <label>Email<input type="email" name="email" required></label>
      <label>Password<input type="password" name="password" required></label>
      <button type="submit">Sign in</button>
    </form>`);
}

export function renderExpired(): string {
  return page('Request expired', `
    <h1>Request expired</h1>
    <p class="muted">This sign-in request has expired or was already completed.
    Please start again from the app you were using.</p>`);
}

export function renderConsent(uid: string, clientId: string, scope: string): string {
  const items = scope
    .split(' ')
    .filter((s) => s && s !== 'openid')
    .map((s) => `<li>${escapeHtml(SCOPE_LABELS[s] ?? s)}</li>`)
    .join('');

  return page('Connect with Persona', `
    <h1>Connect with Persona</h1>
    <p><strong>${escapeHtml(clientId)}</strong> would like to receive:</p>
    <ul>${items || '<li class="muted">basic sign-in only</li>'}</ul>
    <form method="post" action="/interaction/${encodeURIComponent(uid)}/confirm" style="display:inline">
      <button type="submit">Allow</button>
    </form>
    <form method="post" action="/interaction/${encodeURIComponent(uid)}/abort" style="display:inline;margin-left:.5rem">
      <button type="submit" style="background:#777">Deny</button>
    </form>`);
}
