import { z } from '@hono/zod-openapi';

// Env is loaded by ./load-env.ts, which entrypoints import before this module.

// Typed env loader: validate at boot, fail fast on missing/invalid vars.
const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  API_PORT: z.coerce.number().int().positive().default(8787),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
