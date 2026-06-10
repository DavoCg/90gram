import { z } from '@hono/zod-openapi';

// Env is loaded by ./load-env.ts, which entrypoints import before this module.

// Typed env loader: validate at boot, fail fast on missing/invalid vars.
const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  API_PORT: z.coerce.number().int().positive().default(8787),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Auth (better-auth). The secret signs sessions/tokens and MUST be set; generate one with
  // `openssl rand -base64 32`. The base URL is where the auth handler is reachable.
  BETTER_AUTH_SECRET: z.string().min(1, 'BETTER_AUTH_SECRET is required'),
  BETTER_AUTH_URL: z.url().default('http://127.0.0.1:8787'),

  // Mobile deep-link scheme, added to better-auth trustedOrigins (matches apps/mobile app.json).
  APP_SCHEME: z.string().min(1).default('getvinyls'),

  // Optional transactional email (Resend) for delivering sign-in OTP codes. When unset, codes are
  // logged to the server console so the flow is usable in local development without a provider.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().default('getvinyls <onboarding@resend.dev>'),

  // Currency exchange rates (Frankfurter). The base is EUR (our default display currency), so the
  // cached table is keyed per-EUR. The TTL bounds how stale a cached table may get; Frankfurter
  // publishes rates about once per working day, so a few hours is plenty. Override the URL only for
  // tests or a self-hosted mirror.
  FRANKFURTER_BASE_URL: z.url().default('https://api.frankfurter.dev/v1'),
  EXCHANGE_RATES_TTL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(6 * 60 * 60 * 1000),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
