import { getLocales } from 'expo-localization';
import type { SupportedLanguage } from '@getvinyls/api-client';
import { storage } from '../storage';

// Single source of truth for the UI languages the app ships translations for. Keep this in lockstep
// with the server's SUPPORTED_LANGUAGES (apps/api/src/language/languages.ts) and the bundles under
// ./locales: a code here MUST have a matching folder there.
export const SUPPORTED_LANGUAGE_CODES = ['en', 'fr', 'de', 'es'] as const;

// English is the i18n fallback and the default when the phone locale is unsupported.
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

// The translation namespaces (scoped files): one JSON per namespace per language under ./locales.
// `common` is the default namespace (shared UI: actions, generic states, errors).
export const NAMESPACES = [
  'common',
  'settings',
  'language',
  'auth',
  'home',
  'favorites',
  'search',
  'profile',
  'vinyl',
  'onboarding',
] as const;

export type Namespace = (typeof NAMESPACES)[number];

// MMKV key holding the user's EXPLICIT language choice (an empty/missing value means "not chosen",
// so we fall back to the phone locale). Mirrors the server setting for an instant, flash-free boot.
export const LANGUAGE_STORAGE_KEY = 'app-language';

// Human-readable labels for the picker. `nativeName` is shown in the language's own script so a user
// who cannot read the current UI language can still recognise their own. The picker shows the
// two-letter code in a coin-like badge (see LanguageBadge), mirroring the currency picker.
export const LANGUAGE_META: Record<SupportedLanguage, { name: string; nativeName: string }> = {
  en: { name: 'English', nativeName: 'English' },
  fr: { name: 'French', nativeName: 'Français' },
  de: { name: 'German', nativeName: 'Deutsch' },
  es: { name: 'Spanish', nativeName: 'Español' },
};

// Narrow an arbitrary string to a supported language code, or null if unsupported.
export function asSupportedLanguage(code: string | null | undefined): SupportedLanguage | null {
  if (!code) return null;
  const lower = code.toLowerCase();
  return (SUPPORTED_LANGUAGE_CODES as readonly string[]).includes(lower)
    ? (lower as SupportedLanguage)
    : null;
}

// The phone's preferred language, narrowed to a supported code (else English). expo-localization
// returns the OS locales best-first; we take the first whose base language we support.
export function getDeviceLanguage(): SupportedLanguage {
  for (const locale of getLocales()) {
    const supported = asSupportedLanguage(locale.languageCode);
    if (supported) return supported;
  }
  return DEFAULT_LANGUAGE;
}

// The language to start i18next with, resolved synchronously at boot (no flash): the user's explicit
// stored choice wins; otherwise the phone locale; otherwise English. The server setting (when signed
// in) is reconciled afterwards by useDisplayLanguage.
export function resolveInitialLanguage(): SupportedLanguage {
  const stored = asSupportedLanguage(storage.getString(LANGUAGE_STORAGE_KEY));
  return stored ?? getDeviceLanguage();
}
