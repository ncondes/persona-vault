import 'dotenv/config';
import { z } from 'zod';

// Validates and types the environment variables the app depends on.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4400),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  OIDC_ISSUER: z.string().default('http://localhost:4400/oidc'),
  // When set, browser-facing OIDC interaction pages redirect to the web app.
  // Left unset in tests so the built-in HTML fallback is exercised.
  WEB_URL: z.string().optional(),
  // Sign-up and sign-in both wait on an emailed code, so the app cannot serve
  // either without a way to send mail. Tests pass a stub mailer to the
  // container instead, so they never need a working key.
  //
  // `console` writes the code to the log rather than sending it, which is how
  // the app gets demonstrated without a provider that will accept the address —
  // Resend refuses `example.com`, and the seeded demo user lives there. It is
  // still not a *fallback*: it has to be asked for, and it is refused in
  // production below. Nothing silently drops into it when Resend fails.
  MAIL_TRANSPORT: z.enum(['resend', 'console']).default('resend'),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).default('Persona <onboarding@resend.dev>'),
  // The public demo. Sign-in is gated on a code sent by email, and the seeded
  // account everything interesting hangs off lives at example.com, which no mail
  // provider will deliver to — so a hosted copy that anyone can try needs a way
  // in that does not involve an inbox. Off unless asked for, by name.
  // Rate-limit counters live in Redis so they survive a restart of the API and
  // are shared if it ever runs as more than one process. Optional here and
  // required in production below, the same way RESEND_API_KEY is: local work
  // and unit tests fall back to an in-process store, which is honest for one
  // process and wrong for anything else.
  REDIS_URL: z.string().min(1).optional(),
  // Off switch for the limiter itself. Exists for the load test, which measures
  // the same endpoint with and without it, and for a local session where the
  // limits get in the way.
  RATE_LIMIT_ENABLED: z.stringbool().default(true),
  // How many proxies sit in front of Express, for req.ip. The API has no public
  // domain: traffic arrives through the web app's rewrites over the private
  // network, so without this req.ip is the proxy and every caller shares one
  // address. Only the public-read bound keys on it, and that bound fails open —
  // nothing that checks a credential trusts this number, because a forwarded
  // header is ultimately something the caller can influence.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  DEMO_LOGIN: z.stringbool().default(false),
  // Only these addresses can use it. Accounts a visitor creates are not on the
  // list, so the door does not open for them.
  DEMO_LOGIN_EMAILS: z
    .string()
    .default('camila@example.com,dev@example.com')
    .transform((value) =>
      value
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
});

const env = envSchema.parse(process.env);

// Codes would go to the log rather than to a person. That is exactly what the
// demo wants — it reads them back out through the demo sign-in — and never what
// a real deployment wants.
if (env.MAIL_TRANSPORT === 'console' && env.NODE_ENV === 'production' && !env.DEMO_LOGIN) {
  throw new Error('MAIL_TRANSPORT=console cannot be used in production — codes would go to the log');
}

// Optional in the schema so `console` does not need one, required in practice
// the moment Resend is the transport. Checked here rather than in the mailer so
// the app refuses to start instead of failing at the first sign-up.
if (env.MAIL_TRANSPORT === 'resend' && !env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is required unless MAIL_TRANSPORT=console');
}

// The in-process fallback store is per-process and empties on restart, so in
// production it would be a control in name only. Refuse to start instead of
// pretending, which is the same call made for the mail transport above.
if (env.NODE_ENV === 'production' && env.RATE_LIMIT_ENABLED && !env.REDIS_URL) {
  throw new Error('REDIS_URL is required in production — rate limits cannot live in process memory');
}

export const config = {
  env: env.NODE_ENV,
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  authSecret: env.AUTH_SECRET,
  oidcIssuer: env.OIDC_ISSUER,
  webUrl: env.WEB_URL,
  mailTransport: env.MAIL_TRANSPORT,
  // Safe to assert: the check above refuses to start without it when the Resend
  // transport is the one selected.
  resendApiKey: env.RESEND_API_KEY as string,
  emailFrom: env.EMAIL_FROM,
  redisUrl: env.REDIS_URL,
  rateLimitEnabled: env.RATE_LIMIT_ENABLED,
  trustProxyHops: env.TRUST_PROXY_HOPS,
  demoLogin: env.DEMO_LOGIN,
  demoLoginEmails: env.DEMO_LOGIN_EMAILS,
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
};

export type AppConfig = typeof config;
