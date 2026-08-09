import type { Snippet } from "@/components/console/code-block";
import type { Strings } from "@/lib/strings";
import type { AppView } from "@/lib/types";

// Real, runnable code rather than a sketch of a request. Every value comes from
// the app being viewed, and the query is built with URLSearchParams so the
// encoding is correct by construction — a hand-written URL with a space in
// `scope` is the classic first-hour mistake.
export function integrationSnippets(app: AppView, issuer: string, t: Strings): Snippet[] {
  const scope = ["openid", ...app.allowedScopes].join(" ");
  const redirectUri = app.redirectUris[0] ?? "https://example.com/callback";

  return [
    {
      id: "authorize",
      label: t.console.integration.authorize,
      note: t.console.integration.authorizeNote,
      code: `// 1. Send the browser to Persona.
const params = new URLSearchParams({
  client_id: ${JSON.stringify(app.id)},
  response_type: "code",
  scope: ${JSON.stringify(scope)},
  redirect_uri: ${JSON.stringify(redirectUri)},
  state,                        // random; verify it on the callback
  code_challenge: challenge,    // base64url(SHA-256(verifier))
  code_challenge_method: "S256",
});

redirect(\`${issuer}/auth?\${params}\`);`,
    },
    {
      id: "token",
      label: t.console.integration.token,
      note: t.console.integration.tokenNote,
      code: `// 2. Exchange the code. Server-side only.
const credentials = Buffer.from(\`\${clientId}:\${clientSecret}\`).toString("base64");

const res = await fetch("${issuer}/token", {
  method: "POST",
  headers: {
    authorization: \`Basic \${credentials}\`,
    "content-type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: ${JSON.stringify(redirectUri)},
    code_verifier: verifier,
  }),
});

const { access_token } = await res.json();`,
    },
    {
      id: "userinfo",
      label: t.console.integration.userinfo,
      note: t.console.integration.userinfoNote,
      code: `// 3. Read the claims. This call is what Persona records in
//    the person's audit log, so call it when you need the data.
const claims = await fetch("${issuer}/me", {
  headers: { authorization: \`Bearer \${access_token}\` },
}).then((r) => r.json());`,
    },
  ];
}
