import { z } from '@hono/zod-openapi';

// The display currencies a user can pick. Deliberately curated (not every ISO-4217 code) so the
// mobile picker stays short and the enum gives validation + types across the whole pipeline. Every
// code here is supported by Frankfurter. EUR is the default and the base the rate table is keyed on.
export const SUPPORTED_CURRENCIES = [
  'EUR',
  'USD',
  'GBP',
  'JPY',
  'CHF',
  'CAD',
  'AUD',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
] as const;

export const DEFAULT_CURRENCY: SupportedCurrency = 'EUR';

export const SupportedCurrencySchema = z
  .enum(SUPPORTED_CURRENCIES)
  .openapi('SupportedCurrency', { example: 'EUR' });

export type SupportedCurrency = z.infer<typeof SupportedCurrencySchema>;
