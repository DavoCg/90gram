import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { SupportedLanguage, UserSettingsDto } from '@getvinyls/api-client';
import { storage } from './storage';
import { apiClient } from './api/client';
import { queryKeys } from './api/queryKeys';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGE_CODES,
  asSupportedLanguage,
} from './i18n/languages';

// UI-language preference. The effective language is whatever i18next currently renders (resolved at
// boot from MMKV/the phone locale; see src/i18n). The source of truth for an EXPLICIT choice is the
// signed-in user's server setting (GET/PUT /settings), mirrored into MMKV so the right language shows
// instantly on boot. Unlike currency, switching language re-renders translations client-side, so
// there is nothing to invalidate. Mirrors src/currency.ts.

// The order the picker falls back to before /languages has loaded. The server is authoritative.
const FALLBACK_LANGUAGES: SupportedLanguage[] = [...SUPPORTED_LANGUAGE_CODES];

// The languages the user can choose from (from the server, with a static fallback).
export function useSupportedLanguages(): SupportedLanguage[] {
  const { data } = useQuery({
    queryKey: queryKeys.languages,
    queryFn: async (): Promise<SupportedLanguage[]> => {
      const { data, error } = await apiClient.GET('/languages');
      if (error || !data) throw new Error('Failed to load languages');
      return data.languages;
    },
    staleTime: Infinity,
  });
  return data ?? FALLBACK_LANGUAGES;
}

export interface DisplayLanguageApi {
  language: SupportedLanguage;
  setLanguage: (next: SupportedLanguage) => void;
}

// Read + write the user's UI language. The live value comes from i18next (so the hook re-renders on
// every language change, here or elsewhere); writing flips i18next immediately, persists to MMKV +
// the server, and optimistically updates the settings cache.
export function useDisplayLanguage(): DisplayLanguageApi {
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();

  // The signed-in user's saved settings (shared cache with useDisplayCurrency). `language` is null
  // when the user has never chosen one (the app then keeps the boot language: phone locale).
  const { data } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: async (): Promise<UserSettingsDto> => {
      const { data, error } = await apiClient.GET('/settings');
      if (error || !data) throw new Error('Failed to load settings');
      return data;
    },
  });

  // Reconcile the server choice into i18next + MMKV (e.g. after signing in on a new device). Only an
  // EXPLICIT server value (non-null) overrides the locally resolved language.
  const serverLanguage = asSupportedLanguage(data?.language);
  useEffect(() => {
    if (serverLanguage && serverLanguage !== i18n.language) {
      storage.set(LANGUAGE_STORAGE_KEY, serverLanguage);
      void i18n.changeLanguage(serverLanguage);
    }
  }, [serverLanguage, i18n]);

  const language: SupportedLanguage = asSupportedLanguage(i18n.language) ?? DEFAULT_LANGUAGE;

  const setLanguage = useCallback(
    (next: SupportedLanguage) => {
      // Instant local switch (re-renders every translation) + persisted choice for next boot.
      storage.set(LANGUAGE_STORAGE_KEY, next);
      void i18n.changeLanguage(next);
      // Optimistically reflect the choice in the shared settings cache (keep currency untouched).
      queryClient.setQueryData<UserSettingsDto>(queryKeys.settings, (prev) =>
        prev ? { ...prev, language: next } : prev,
      );
      void apiClient.PUT('/settings', { body: { language: next } }).catch(() => {
        // Offline or signed out: MMKV keeps the choice; it syncs on the next successful PUT.
      });
    },
    [i18n, queryClient],
  );

  return { language, setLanguage };
}
