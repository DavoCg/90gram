import path from 'node:path';
import { defineConfig, env } from 'prisma/config';
import { loadRootEnv } from './load-root-env.js';

loadRootEnv();

// Prisma 7 config. The schema and migrations live under prisma/. DATABASE_URL is loaded
// from the repo .env via dotenv (Prisma 7 no longer auto-loads .env). The datasource URL
// here is used by Migrate / introspection; the runtime client uses the pg adapter.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
