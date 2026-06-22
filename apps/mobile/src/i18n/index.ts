import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';
import {
  DEFAULT_LANGUAGE,
  NAMESPACES,
  SUPPORTED_LANGUAGE_CODES,
  resolveInitialLanguage,
} from './languages';

// Initialise i18next ONCE, synchronously, at module load (imported for its side effect from
// app/_layout.tsx, exactly like initializeTheme()). The starting language is resolved from MMKV/the
// phone locale so the very first render is already in the right language (no flash). The signed-in
// user's server setting is reconciled afterwards by useDisplayLanguage.
//
// Translations are bundled (see ./resources), so init is fully synchronous: no Suspense, no async
// backend, nothing to await before rendering.
void i18n.use(initReactI18next).init({
  resources,
  lng: resolveInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGE_CODES],
  ns: [...NAMESPACES],
  defaultNS: 'common',
  // React already escapes everything it renders, so i18next must not double-escape interpolations.
  interpolation: { escapeValue: false },
  // Treat a missing key as a missing translation (fall back), never surface a literal `null`.
  returnNull: false,
  react: {
    // No Suspense: the bundle is ready synchronously, and Suspense would add a needless boundary.
    useSuspense: false,
  },
});

export { default as i18n } from 'i18next';
