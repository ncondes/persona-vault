import { escapeHtml, renderConsent, renderExpired, renderLogin } from '../src/oidc/views';

// The HTML fallback the provider serves when WEB_URL is unset. It builds pages by
// string concatenation, so `escapeHtml` is the only thing standing between a
// client id and script injection — and until now nothing rendered these at all.

describe('escapeHtml', () => {
  it.each([
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#39;'],
  ])('escapes %s', (raw, escaped) => {
    expect(escapeHtml(raw)).toBe(escaped);
  });

  it('escapes every occurrence, not just the first', () => {
    expect(escapeHtml('<<>>')).toBe('&lt;&lt;&gt;&gt;');
  });

  it('escapes the ampersand of an entity so it cannot be double-decoded', () => {
    expect(escapeHtml('&lt;script&gt;')).toBe('&amp;lt;script&amp;gt;');
  });

  it('leaves ordinary text alone', () => {
    expect(escapeHtml('Camila Rodríguez García')).toBe('Camila Rodríguez García');
  });
});

describe('renderLogin', () => {
  it('renders a sign-in form posting to the interaction', () => {
    const html = renderLogin('abc123');

    expect(html).toContain('<h1>Sign in</h1>');
    expect(html).toContain('action="/interaction/abc123/login"');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).not.toContain('class="err"');
  });

  it('shows an error when one is given', () => {
    expect(renderLogin('abc123', 'Wrong email or password')).toContain(
      '<p class="err">Wrong email or password</p>',
    );
  });

  it('escapes an error message rather than rendering it as markup', () => {
    const html = renderLogin('abc123', '<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('URL-encodes the interaction id in the form action', () => {
    expect(renderLogin('a/b?c')).toContain('action="/interaction/a%2Fb%3Fc/login"');
  });
});

describe('renderConsent', () => {
  it('lists the requested scopes by their human label', () => {
    const html = renderConsent('uid-1', 'clinic', 'openid name email');

    expect(html).toContain('<strong>clinic</strong>');
    expect(html).toContain('<li>Full name</li>');
    expect(html).toContain('<li>Email</li>');
    // `openid` is the protocol asking, not the person's data.
    expect(html).not.toContain('<li>openid</li>');
  });

  it('falls back to the raw scope when the catalog has no label', () => {
    expect(renderConsent('uid-1', 'clinic', 'mystery_scope')).toContain('<li>mystery_scope</li>');
  });

  it('says so when nothing beyond sign-in was asked for', () => {
    expect(renderConsent('uid-1', 'clinic', 'openid')).toContain('<li>Basic sign-in only</li>');
    expect(renderConsent('uid-1', 'clinic', '')).toContain('<li>Basic sign-in only</li>');
  });

  it('offers both an allow and a deny form', () => {
    const html = renderConsent('uid-1', 'clinic', 'openid name');
    expect(html).toContain('action="/interaction/uid-1/decision"');
    expect(html).toContain('action="/interaction/uid-1/abort"');
  });

  // A client id comes from the database and is shown on the page where the
  // person makes their trust decision.
  it('escapes the client id', () => {
    const html = renderConsent('uid-1', '<script>alert(1)</script>', 'openid');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});

describe('renderExpired', () => {
  it('explains what happened and tells the person where to go', () => {
    const html = renderExpired();
    expect(html).toContain('Request expired');
    expect(html).toContain('start again');
  });
});

describe('page shell', () => {
  it('is a complete, titled document on every page', () => {
    for (const html of [renderLogin('u'), renderConsent('u', 'c', 'openid'), renderExpired()]) {
      expect(html.startsWith('<!doctype html>')).toBe(true);
      expect(html).toContain('<meta name="viewport"');
      expect(html).toMatch(/<title>[^<]+<\/title>/);
      expect(html).toContain('Persona');
    }
  });
});
