import { AuditEntry } from '../domain/models';
import { escapeHtml, page } from '../oidc/views';
import { ConnectionView } from '../services/account.service';
import { ProfileView } from '../services/profile.service';

const NAME_KINDS = ['legal', 'preferred', 'professional', 'public'] as const;
const FIELD_KEYS = ['email', 'phone', 'address', 'dob'] as const;

export function renderSignup(error?: string): string {
  return page('Create your Persona', `
    <h1>Create your Persona</h1>
    <p>One profile you control.</p>
    <form method="post" action="/signup">
      <label for="email">Email</label>
      <input id="email" type="email" name="email" autocomplete="email" required>
      <label for="password">Password</label>
      <input id="password" type="password" name="password" minlength="8" required>
      <button class="primary" type="submit">Create account</button>
      ${error ? `<p class="err">${escapeHtml(error)}</p>` : ''}
    </form>
    <p style="margin-top:1rem"><a href="/login">Already have an account? Sign in</a></p>`);
}

export function renderWebLogin(error?: string): string {
  return page('Sign in to Persona', `
    <h1>Sign in</h1>
    <form method="post" action="/login">
      <label for="email">Email</label>
      <input id="email" type="email" name="email" autocomplete="email" required>
      <label for="password">Password</label>
      <input id="password" type="password" name="password" required>
      <button class="primary" type="submit">Sign in</button>
      ${error ? `<p class="err">${escapeHtml(error)}</p>` : ''}
    </form>
    <p style="margin-top:1rem"><a href="/signup">Create an account</a></p>`);
}

interface AccountData {
  email: string;
  profile: ProfileView;
  connections: ConnectionView[];
  audit: AuditEntry[];
}

export function renderAccount(data: AccountData): string {
  const nameInputs = NAME_KINDS.map(
    (k) =>
      `<label>${k}</label><input name="n_${k}" value="${escapeHtml(data.profile.names[k] ?? '')}">`,
  ).join('');

  const fieldInputs = FIELD_KEYS.map(
    (k) =>
      `<label>${k}</label><input name="f_${k}" value="${escapeHtml(data.profile.fields[k]?.value ?? '')}">`,
  ).join('');

  const connections = data.connections.length
    ? data.connections
        .map(
          (c) =>
            `<li>${escapeHtml(c.clientName)} — ${escapeHtml(
              c.scopes.filter((s) => s !== 'openid').join(', ') || 'sign-in',
            )}
        <form method="post" action="/account/connections/${encodeURIComponent(c.clientId)}/revoke" style="display:inline;float:right">
          <button class="secondary" type="submit">Revoke</button></form></li>`,
        )
        .join('')
    : '<li class="muted">No connected apps yet.</li>';

  const audit = data.audit.length
    ? data.audit
        .slice(0, 10)
        .map(
          (a) =>
            `<li>${escapeHtml(a.clientId)} received ${escapeHtml(
              a.fieldsReleased.join(', '),
            )} <span class="muted">· ${escapeHtml(a.context)}</span></li>`,
        )
        .join('')
    : '<li class="muted">No data shared yet.</li>';

  return page('Your Persona', `
    <h1>Your Persona</h1>
    <p>${escapeHtml(data.email)}
      <form method="post" action="/logout" style="display:inline;float:right">
        <button class="secondary" type="submit">Log out</button>
      </form>
    </p>
    <h2>Profile</h2>
    <form method="post" action="/account/profile">
      ${nameInputs}${fieldInputs}
      <button class="primary" type="submit">Save profile</button>
    </form>
    <h2>Connected apps</h2>
    <ul class="scopes">${connections}</ul>
    <h2>Recent data shared</h2>
    <ul class="scopes">${audit}</ul>`);
}
