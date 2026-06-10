import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { prisma } from '@getvinyls/db';
import { auth } from '../auth.js';
import {
  CurrencySettingSchema,
  UpdateCurrencySettingSchema,
  CurrencyListSchema,
  ErrorSchema,
} from '../schemas.js';
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, SupportedCurrencySchema } from '../currency/currencies.js';

// Per-user settings. Like favorites, this is an authenticated write surface (the vinyl routes stay
// read-only): each handler resolves the better-auth session and 401s without one. Currently just the
// display currency the API converts all prices into.
export const settingsRouter = new OpenAPIHono();

async function getUserId(c: Context): Promise<string | null> {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return session?.user.id ?? null;
}

const unauthorized = { error: 'unauthorized', message: 'Sign in required' } as const;

const listCurrenciesRoute = createRoute({
  method: 'get',
  path: '/currencies',
  tags: ['settings'],
  summary: 'List the supported display currencies',
  responses: {
    200: {
      description: 'The currencies a user can choose to view prices in.',
      content: { 'application/json': { schema: CurrencyListSchema } },
    },
  },
});

// Public: the picker needs this even before sign-in, and it carries no per-user data.
settingsRouter.openapi(listCurrenciesRoute, (c) => {
  return c.json({ currencies: [...SUPPORTED_CURRENCIES] }, 200);
});

const getSettingsRoute = createRoute({
  method: 'get',
  path: '/settings',
  tags: ['settings'],
  summary: 'Get the signed-in user settings',
  responses: {
    200: {
      description: "The user's settings (the default currency when none has been saved yet).",
      content: { 'application/json': { schema: CurrencySettingSchema } },
    },
    401: {
      description: 'Not signed in.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

settingsRouter.openapi(getSettingsRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json(unauthorized, 401);

  const setting = await prisma.userSetting.findUnique({
    where: { userId },
    select: { currency: true },
  });
  // Coerce a stored value that has since left the supported set back to the default.
  const parsed = SupportedCurrencySchema.safeParse(setting?.currency);
  return c.json({ currency: parsed.success ? parsed.data : DEFAULT_CURRENCY }, 200);
});

const updateSettingsRoute = createRoute({
  method: 'put',
  path: '/settings',
  tags: ['settings'],
  summary: 'Update the signed-in user settings',
  request: {
    body: { content: { 'application/json': { schema: UpdateCurrencySettingSchema } } },
  },
  responses: {
    200: {
      description: 'The updated settings.',
      content: { 'application/json': { schema: CurrencySettingSchema } },
    },
    401: {
      description: 'Not signed in.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

settingsRouter.openapi(updateSettingsRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json(unauthorized, 401);

  const { currency } = c.req.valid('json');
  await prisma.userSetting.upsert({
    where: { userId },
    create: { userId, currency },
    update: { currency },
  });
  // `currency` is already validated against the supported set, so echo it back directly (typed).
  return c.json({ currency }, 200);
});
