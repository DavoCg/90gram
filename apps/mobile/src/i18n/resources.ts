// The bundled translations, imported statically so Metro packs them into the JS bundle (no async
// loading, no flash). One JSON per namespace per language under ./locales. When you add a namespace,
// add it here AND to NAMESPACES in ./languages.ts, then create the JSON for every language.
import enCommon from './locales/en/common.json';
import enSettings from './locales/en/settings.json';
import enLanguage from './locales/en/language.json';
import enAuth from './locales/en/auth.json';
import enHome from './locales/en/home.json';
import enFavorites from './locales/en/favorites.json';
import enSearch from './locales/en/search.json';
import enProfile from './locales/en/profile.json';
import enVinyl from './locales/en/vinyl.json';
import enOnboarding from './locales/en/onboarding.json';

import frCommon from './locales/fr/common.json';
import frSettings from './locales/fr/settings.json';
import frLanguage from './locales/fr/language.json';
import frAuth from './locales/fr/auth.json';
import frHome from './locales/fr/home.json';
import frFavorites from './locales/fr/favorites.json';
import frSearch from './locales/fr/search.json';
import frProfile from './locales/fr/profile.json';
import frVinyl from './locales/fr/vinyl.json';
import frOnboarding from './locales/fr/onboarding.json';

import deCommon from './locales/de/common.json';
import deSettings from './locales/de/settings.json';
import deLanguage from './locales/de/language.json';
import deAuth from './locales/de/auth.json';
import deHome from './locales/de/home.json';
import deFavorites from './locales/de/favorites.json';
import deSearch from './locales/de/search.json';
import deProfile from './locales/de/profile.json';
import deVinyl from './locales/de/vinyl.json';
import deOnboarding from './locales/de/onboarding.json';

import esCommon from './locales/es/common.json';
import esSettings from './locales/es/settings.json';
import esLanguage from './locales/es/language.json';
import esAuth from './locales/es/auth.json';
import esHome from './locales/es/home.json';
import esFavorites from './locales/es/favorites.json';
import esSearch from './locales/es/search.json';
import esProfile from './locales/es/profile.json';
import esVinyl from './locales/es/vinyl.json';
import esOnboarding from './locales/es/onboarding.json';

// English is the canonical bundle: its shape drives the type-safe translation keys (see
// ./i18next.d.ts). Every other language must mirror these namespaces.
export const englishResources = {
  common: enCommon,
  settings: enSettings,
  language: enLanguage,
  auth: enAuth,
  home: enHome,
  favorites: enFavorites,
  search: enSearch,
  profile: enProfile,
  vinyl: enVinyl,
  onboarding: enOnboarding,
} as const;

export const resources = {
  en: englishResources,
  fr: {
    common: frCommon,
    settings: frSettings,
    language: frLanguage,
    auth: frAuth,
    home: frHome,
    favorites: frFavorites,
    search: frSearch,
    profile: frProfile,
    vinyl: frVinyl,
    onboarding: frOnboarding,
  },
  de: {
    common: deCommon,
    settings: deSettings,
    language: deLanguage,
    auth: deAuth,
    home: deHome,
    favorites: deFavorites,
    search: deSearch,
    profile: deProfile,
    vinyl: deVinyl,
    onboarding: deOnboarding,
  },
  es: {
    common: esCommon,
    settings: esSettings,
    language: esLanguage,
    auth: esAuth,
    home: esHome,
    favorites: esFavorites,
    search: esSearch,
    profile: esProfile,
    vinyl: esVinyl,
    onboarding: esOnboarding,
  },
} as const;
