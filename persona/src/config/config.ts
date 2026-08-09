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
  // either without a way to send mail. Required rather than optional on purpose:
  // there is no fallback transport to silently drop into. Tests pass a stub
  // mailer to the container instead, so they never need a working key.
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1).default('Persona <onboarding@resend.dev>'),
});

const env = envSchema.parse(process.env);

export const config = {
  env: env.NODE_ENV,
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  authSecret: env.AUTH_SECRET,
  oidcIssuer: env.OIDC_ISSUER,
  webUrl: env.WEB_URL,
  resendApiKey: env.RESEND_API_KEY,
  emailFrom: env.EMAIL_FROM,
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
};

export type AppConfig = typeof config;
