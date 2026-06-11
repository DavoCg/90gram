import './load-env';
import { z } from 'zod';

// Typed env loader: validate at boot, fail fast on missing/invalid vars. Server-only (reads
// secrets); never import this from client component code. Mirrors the apps/api env pattern.
const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Auth (better-auth). Shares the SAME secret as apps/api so sessions are interchangeable across
  // the two better-auth instances that talk to the same Postgres. ADMIN_BASE_URL is where this admin
  // app's auth handler is reachable (/api/auth/*), e.g. https://getvinyls-admin.fly.dev.
  BETTER_AUTH_SECRET: z.string().min(1, 'BETTER_AUTH_SECRET is required'),
  ADMIN_BASE_URL: z.url().default('http://localhost:3000'),
  ADMIN_PORT: z.coerce.number().int().positive().default(3000),

  // Email delivery for sign-in one-time codes (Resend). Leave RESEND_API_KEY empty in development:
  // codes are logged to the server console so the flow works without a provider.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().default('getvinyls <onboarding@resend.dev>'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration (apps/admin):');
  console.error(z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
