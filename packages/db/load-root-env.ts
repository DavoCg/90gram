import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

// Load the monorepo root .env regardless of the current working directory.
// Walks up from this file's location until it finds a .env, so `prisma generate`,
// the seed script, and any tool run from packages/db all see DATABASE_URL.
export function loadRootEnv(): void {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) {
      config({ path: candidate });
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}
