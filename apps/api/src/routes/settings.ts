import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { prisma } from '@getvinyls/db';
import { getUserId, unauthorized } from '../auth-helpers.js';
import {
  UserSettingsSchema,
  UpdateUserSettingsSchema,
  CurrencyListSchema,
  LanguageListSchema,
  ErrorSchema,
} from '../schemas.js';
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, SupportedCurrencySchema } from '../currency/currencies.js';
import { SUPPORTED_LANGUAGES, SupportedLanguageSchema } from '../language/languages.js';

// Per-user settings. Like favorites, this is an authenticated write surface (the vinyl routes stay
// read-only): each handler resolves the better-auth session and 401s without one. Holds the display
// currency the API converts all prices into, plus the preferred UI language (translated client-side).
export const settingsRouter = new OpenAPIHono();

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

const listLanguagesRoute = createRoute({
  method: 'get',
  path: '/languages',
  tags: ['settings'],
  summary: 'List the supported UI languages',
  responses: {
    200: {
      description: 'The languages a user can choose for the app interface.',
      content: { 'application/json': { schema: LanguageListSchema } },
    },
  },
});

// Public: the language picker needs this even before sign-in, and it carries no per-user data.
settingsRouter.openapi(listLanguagesRoute, (c) => {
  return c.json({ languages: [...SUPPORTED_LANGUAGES] }, 200);
});

const getSettingsRoute = createRoute({
  method: 'get',
  path: '/settings',
  tags: ['settings'],
  summary: 'Get the signed-in user settings',
  responses: {
    200: {
      description: "The user's settings (the default currency when none has been saved yet).",
      content: { 'application/json': { schema: UserSettingsSchema } },
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
    select: { currency: true, language: true },
  });
  // Coerce a stored value that has since left the supported set back to the default (currency) or to
  // null (language: null is meaningful, it tells the client to fall back to the phone locale).
  const currency = SupportedCurrencySchema.safeParse(setting?.currency);
  const language = SupportedLanguageSchema.safeParse(setting?.language);
  return c.json(
    {
      currency: currency.success ? currency.data : DEFAULT_CURRENCY,
      language: language.success ? language.data : null,
    },
    200,
  );
});

const updateSettingsRoute = createRoute({
  method: 'put',
  path: '/settings',
  tags: ['settings'],
  summary: 'Update the signed-in user settings',
  request: {
    body: { content: { 'application/json': { schema: UpdateUserSettingsSchema } } },
  },
  responses: {
    200: {
      description: 'The updated settings.',
      content: { 'application/json': { schema: UserSettingsSchema } },
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

  const { currency, language } = c.req.valid('json');
  // Upsert only the keys the client sent (both are optional), leaving the others untouched. The
  // create branch relies on the column defaults for any field not provided (currency -> "EUR",
  // language -> null).
  const data = {
    ...(currency !== undefined ? { currency } : {}),
    ...(language !== undefined ? { language } : {}),
  };
  const saved = await prisma.userSetting.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
    select: { currency: true, language: true },
  });
  // Echo the stored row back through the same coercion as GET so the response shape is identical.
  const savedCurrency = SupportedCurrencySchema.safeParse(saved.currency);
  const savedLanguage = SupportedLanguageSchema.safeParse(saved.language);
  return c.json(
    {
      currency: savedCurrency.success ? savedCurrency.data : DEFAULT_CURRENCY,
      language: savedLanguage.success ? savedLanguage.data : null,
    },
    200,
  );
});
