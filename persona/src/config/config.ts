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
});

const env = envSchema.parse(process.env);

if (env.MAIL_TRANSPORT === 'console' && env.NODE_ENV === 'production') {
  throw new Error('MAIL_TRANSPORT=console cannot be used in production — codes would go to the log');
}

// Optional in the schema so `console` does not need one, required in practice
// the moment Resend is the transport. Checked here rather than in the mailer so
// the app refuses to start instead of failing at the first sign-up.
if (env.MAIL_TRANSPORT === 'resend' && !env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is required unless MAIL_TRANSPORT=console');
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
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
};

export type AppConfig = typeof config;
