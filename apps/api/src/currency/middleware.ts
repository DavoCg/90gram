import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { prisma } from '@getvinyls/db';
import { auth } from '../auth.js';
import { getRatesTable } from './rates.js';
import { buildConverter, type CurrencyConverter } from './converter.js';
import { DEFAULT_CURRENCY, SupportedCurrencySchema } from './currencies.js';

// Hono context variables this middleware sets, so handlers read the converter type-safely off `c`.
export interface CurrencyVariables {
  converter: CurrencyConverter;
}

// Resolve the display currency for the request, in priority order:
//   1. the SIGNED-IN user's saved setting (better-auth session -> user_settings.currency)
//   2. an explicit ?currency= query param (anonymous browsing only)
//   3. EUR (the default)
// A signed-in user's currency is always their setting: the query param is never consulted for them,
// so the app does not have to echo their setting back on every request. The session is read from the
// request the same way favorites does it (better-auth forwards the cookie from the mobile client).
async function resolveCurrency(c: Context): Promise<string> {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (session?.user.id) {
    const setting = await prisma.userSetting.findUnique({
      where: { userId: session.user.id },
      select: { currency: true },
    });
    const parsed = SupportedCurrencySchema.safeParse(setting?.currency);
    return parsed.success ? parsed.data : DEFAULT_CURRENCY;
  }

  // Anonymous: allow an explicit query override (validated against the supported set).
  const parsed = SupportedCurrencySchema.safeParse(c.req.query('currency'));
  return parsed.success ? parsed.data : DEFAULT_CURRENCY;
}

// Attaches a CurrencyConverter (target currency + cached Frankfurter rates) to every request it
// guards. Apply it to the price-returning routes; their DTO mappers then read `c.var.converter`.
export const currencyContext = createMiddleware<{ Variables: CurrencyVariables }>(
  async (c, next) => {
    const target = await resolveCurrency(c);
    const table = await getRatesTable();
    c.set('converter', buildConverter(target, table));
    await next();
  },
);
