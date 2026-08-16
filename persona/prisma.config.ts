import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 configuration. The connection URL lives here (used by Migrate);
// the runtime client connects through the pg driver adapter (see src/infrastructure/db).
//
// Read straight from the environment rather than through Prisma's `env()`,
// which resolves as this file loads and throws when the variable is missing.
// `prisma generate` needs no database and now runs on install — inside an image
// build, before any deploy has handed the process its variables. Migrate is the
// only command that reads this, and it runs where the variable is set.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
