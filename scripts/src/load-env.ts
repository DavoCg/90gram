// Loads the monorepo root .env before anything reads process.env. Import this FIRST,
// before @getvinyls/db, which throws at import time if DATABASE_URL is unset.
//
// NOTE: scripts here run against whatever DATABASE_URL points at. To hit prod, export a
// prod DATABASE_URL for the invocation, e.g.:
//   DATABASE_URL="postgres://...prod..." pnpm --filter @getvinyls/scripts discover-shops
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

let dir = dirname(fileURLToPath(import.meta.url));
for (;;) {
  const candidate = join(dir, '.env');
  if (existsSync(candidate)) {
    config({ path: candidate });
    break;
  }
  const parent = dirname(dir);
  if (parent === dir) break;
  dir = parent;
}
