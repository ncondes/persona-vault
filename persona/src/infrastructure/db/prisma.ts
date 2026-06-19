import { PrismaClient } from '@prisma/client';
import { config } from '../../config/config';

// Single shared Prisma client for the whole app.
export const prisma = new PrismaClient({
  log: config.isProd ? ['error'] : config.isTest ? [] : ['warn', 'error'],
});
