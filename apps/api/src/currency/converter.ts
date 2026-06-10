import type { RatesTable } from './rates.js';

// The result of converting an amount: the converted value and the currency it is now expressed in.
// Normally `currency` is the converter's target; it stays the source currency only when conversion
// was not possible (unknown currency, or no rate table), so the wire value is never a lie.
export interface ConvertedAmount {
  amount: number;
  currency: string;
}

// A per-request price converter into a single target currency, backed by a (possibly null) rate
// table. Pure and synchronous: routes fetch the cached table once, build one of these, and hand it
// to the DTO mappers.
export interface CurrencyConverter {
  // The currency prices are converted INTO (the user's setting, a query override, or EUR).
  target: string;
  convert(amount: number, from: string | null): ConvertedAmount;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function buildConverter(target: string, table: RatesTable | null): CurrencyConverter {
  const rates = table?.rates;
  return {
    target,
    convert(amount, from) {
      // Unknown source currency: assume it is already the target rather than fabricate a rate.
      if (from === null || from === target) return { amount: round2(amount), currency: target };
      const rateFrom = rates?.[from];
      const rateTo = rates?.[target];
      if (rateFrom !== undefined && rateTo !== undefined) {
        // Frankfurter rates are per-EUR, so cross rate = target-per-EUR / source-per-EUR.
        return { amount: round2((amount * rateTo) / rateFrom), currency: target };
      }
      // No usable rate: keep the original amount and its own currency (truthful, just unconverted).
      return { amount: round2(amount), currency: from };
    },
  };
}
