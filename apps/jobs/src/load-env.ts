// Side effect: load the monorepo root .env regardless of cwd. Import this FIRST, before anything
// that reads process.env (env.ts, @getvinyls/db). Walks up from this file's location until it
// finds a .env. Mirrors apps/api/src/load-env.ts.
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
