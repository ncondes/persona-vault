import 'dotenv/config';
import { z } from 'zod';

// Validates and types the environment variables the app depends on.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4400),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
});

const env = envSchema.parse(process.env);

export const config = {
  env: env.NODE_ENV,
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  authSecret: env.AUTH_SECRET,
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
};

export type AppConfig = typeof config;
