import { useCallback, useEffect } from 'react';
import { useMMKVString } from 'react-native-mmkv';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupportedCurrency } from '@getvinyls/api-client';
import { storage } from './storage';
import { apiClient } from './api/client';
import { queryKeys } from './api/queryKeys';

// Display-currency preference. The source of truth is the signed-in user's server setting
// (GET/PUT /settings); we mirror it into MMKV so the picker shows the right selection instantly on
// boot (no flash, no wait for the network). The API converts every price into this currency
// server-side using the user's setting, so the app just renders what it gets back.

const CURRENCY_KEY = 'display-currency';
export const DEFAULT_CURRENCY: SupportedCurrency = 'EUR';

// Order the picker falls back to if /currencies has not loaded yet. The server is authoritative;
// any code it does not return is simply not offered.
const FALLBACK_CURRENCIES: SupportedCurrency[] = [
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
];

// Human-readable names and display symbols for the picker and price formatting. Keyed by ISO code.
// The symbol renders inside a coin-like circle in the currency picker.
export const CURRENCY_META: Record<string, { name: string; symbol: string }> = {
  EUR: { name: 'Euro', symbol: '€' },
  USD: { name: 'US Dollar', symbol: '$' },
  GBP: { name: 'British Pound', symbol: '£' },
  JPY: { name: 'Japanese Yen', symbol: '¥' },
  CHF: { name: 'Swiss Franc', symbol: 'CHF' },
  CAD: { name: 'Canadian Dollar', symbol: 'CA$' },
  AUD: { name: 'Australian Dollar', symbol: 'A$' },
  SEK: { name: 'Swedish Krona', symbol: 'kr' },
  NOK: { name: 'Norwegian Krone', symbol: 'kr' },
  DKK: { name: 'Danish Krone', symbol: 'kr' },
  PLN: { name: 'Polish Zloty', symbol: 'zł' },
};

// Format a price for display: symbol-prefixed where we know the symbol, otherwise the code. Returns
// null when there is no price, so callers can choose what to render in that case.
export function formatPrice(amount: number | null, currency: string | null): string | null {
  if (amount === null) return null;
  const meta = currency ? CURRENCY_META[currency] : undefined;
  const value = amount.toFixed(2);
  if (meta) return `${meta.symbol}${value}`;
  return currency ? `${currency} ${value}` : value;
}

// The currencies the user can choose from (from the server, with a static fallback).
export function useSupportedCurrencies(): SupportedCurrency[] {
  const { data } = useQuery({
    queryKey: queryKeys.currencies,
    queryFn: async (): Promise<SupportedCurrency[]> => {
      const { data, error } = await apiClient.GET('/currencies');
      if (error || !data) throw new Error('Failed to load currencies');
      return data.currencies;
    },
    staleTime: Infinity,
  });
  return data ?? FALLBACK_CURRENCIES;
}

export interface DisplayCurrencyApi {
  currency: SupportedCurrency;
  setCurrency: (next: SupportedCurrency) => void;
}

// Read + write the user's display currency. Reads from the server setting (mirrored into MMKV for an
// instant initial value); writing flips MMKV at once, persists to the server, then invalidates the
// price-bearing queries so they refetch and re-convert against the new setting.
export function useDisplayCurrency(): DisplayCurrencyApi {
  const queryClient = useQueryClient();
  const [stored, setStored] = useMMKVString(CURRENCY_KEY, storage);

  const { data } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: async (): Promise<{ currency: SupportedCurrency }> => {
      const { data, error } = await apiClient.GET('/settings');
      if (error || !data) throw new Error('Failed to load settings');
      return data;
    },
  });

  // Keep MMKV in lockstep with the server value (e.g. after signing in on a new device).
  useEffect(() => {
    if (data && data.currency !== stored) setStored(data.currency);
  }, [data, stored, setStored]);

  const currency: SupportedCurrency =
    data?.currency ?? (stored as SupportedCurrency | undefined) ?? DEFAULT_CURRENCY;

  const setCurrency = useCallback(
    (next: SupportedCurrency) => {
      // Instant local update (picker + next-boot value) and an optimistic settings-cache write.
      setStored(next);
      queryClient.setQueryData(queryKeys.settings, { currency: next });
      void apiClient
        .PUT('/settings', { body: { currency: next } })
        .then(({ error }) => {
          if (error) return;
          // The server now converts to `next`; refetch everything that carries prices (the feed and
          // vinyl details, a shop's vinyls, and the favorited vinyls).
          void queryClient.invalidateQueries({ queryKey: ['vinyls'] });
          void queryClient.invalidateQueries({ queryKey: ['shops'] });
          void queryClient.invalidateQueries({ queryKey: queryKeys.favorites.vinyls });
        })
        .catch(() => {
          // Offline or signed out: MMKV keeps the choice; it syncs on the next successful PUT.
        });
    },
    [setStored, queryClient],
  );

  return { currency, setCurrency };
}
