import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { config } from '../../config/config';

// Connects to Postgres through the pg driver adapter (Prisma 7).
const adapter = new PrismaPg({ connectionString: config.databaseUrl });

// Single shared Prisma client for the whole app.
export const prisma = new PrismaClient({
  adapter,
  log: config.isProd ? ['error'] : config.isTest ? [] : ['warn', 'error'],
});
