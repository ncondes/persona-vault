import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 configuration. The connection URL lives here (used by Migrate);
// the runtime client connects through the pg driver adapter (see src/infrastructure/db).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
