import { env } from '../env.js';

// Exchange rates from Frankfurter (https://frankfurter.dev), cached in memory. Frankfurter publishes
// ECB reference rates roughly once per working day, so we cache aggressively (TTL from env) and fetch
// at most once at a time (in-flight de-dup). On a failed refresh we serve the last good table rather
// than fail a request; with no table at all the caller falls back to identity (original prices).

interface FrankfurterLatest {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

export interface RatesTable {
  // Units of each currency per 1 EUR (the base). EUR: 1 is added explicitly since Frankfurter omits
  // the base from its `rates` map.
  rates: Record<string, number>;
  date: string;
  fetchedAt: number;
}

let cache: RatesTable | null = null;
let inflight: Promise<RatesTable> | null = null;

async function fetchRates(): Promise<RatesTable> {
  const url = `${env.FRANKFURTER_BASE_URL}/latest?base=EUR`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Frankfurter responded ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as FrankfurterLatest;
  return { rates: { ...body.rates, EUR: 1 }, date: body.date, fetchedAt: Date.now() };
}

// The current rates table, refreshing it when the cached one is older than the TTL. Returns null only
// when there is no cached table AND a refresh failed (so the very first call with no network yields
// no rates); every later call keeps serving the last good table even if a refresh later fails.
export async function getRatesTable(): Promise<RatesTable | null> {
  const isFresh = cache !== null && Date.now() - cache.fetchedAt < env.EXCHANGE_RATES_TTL_MS;
  if (isFresh) return cache;

  inflight ??= fetchRates()
    .then((table) => {
      cache = table;
      return table;
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[currency] failed to refresh exchange rates: ${message}`);
      if (cache) return cache; // serve stale rather than fail the request
      throw err;
    })
    .finally(() => {
      inflight = null;
    });

  try {
    return await inflight;
  } catch {
    return null; // no rates available at all; caller converts as identity
  }
}
