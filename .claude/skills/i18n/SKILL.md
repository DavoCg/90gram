---
name: i18n
description: >-
  Conventions for internationalization in apps/mobile: i18next + react-i18next, scoped per-namespace
  locale bundles (en/fr/de/es), type-safe translation keys, device-locale detection with an English
  fallback, and the per-user language setting that mirrors the currency setting end to end. Read this
  whenever you add or change user-facing copy, add a screen, add a language, or touch the language
  setting / picker. Every shipped feature must be translated in all four languages.
---

# Internationalization (apps/mobile)

The mobile app is fully translated with **i18next + react-i18next**. There is **no hardcoded
user-facing copy**: every visible string goes through `t()`. The chosen language is a per-user setting
that mirrors the display-currency setting end to end (server `UserSetting.language` + MMKV mirror).

## The hard rule: translate every feature, in every language

Supported languages: **en, fr, de, es** (English is the fallback). When you add or change ANY
user-facing string, you MUST add the key to **all four** locale bundles, not just English. A feature
is not "done" until its copy exists in en/fr/de/es. English is the canonical shape; the other three
mirror its keys exactly (a missing English key used in code is a TypeScript error; a missing fr/de/es
key silently falls back to English, which is a translation bug, so keep them in lockstep).

## Where things live

```
apps/mobile/src/i18n/
  index.ts            # i18next.init(), imported once for its side effect from app/_layout.tsx
  resources.ts        # static imports of every namespace JSON; englishResources drives the key types
  languages.ts        # SUPPORTED_LANGUAGE_CODES, DEFAULT_LANGUAGE, NAMESPACES, LANGUAGE_META,
                      #   device-locale detection (expo-localization), resolveInitialLanguage()
  i18next.d.ts        # CustomTypeOptions: type-safe keys from englishResources, defaultNS 'common'
  locales/<lang>/<namespace>.json   # one JSON per namespace per language
apps/mobile/src/language.ts         # useDisplayLanguage() + useSupportedLanguages() (mirror currency.ts)
apps/mobile/app/language.tsx        # the language picker form sheet (mirror app/currency.tsx)
apps/mobile/src/components/language-setting-row.tsx  # the Settings row
```

## Scoped namespaces

Copy is split into namespaces (scoped files) so bundles stay small and keys stay readable. `common`
is the default namespace (shared UI: `actions.*`, `states.*`, `errors.*`, `tabs.*`). The rest are
screen/area scoped: `settings`, `language`, `auth`, `home`, `favorites`, `search`, `profile`,
`vinyl`, `onboarding`. Add a namespace by: adding it to `NAMESPACES` in `languages.ts`, importing its
four JSONs in `resources.ts` (and to `englishResources`), and creating the JSON for every language.

## Using translations

```tsx
import { useTranslation } from 'react-i18next';

function Screen() {
  const { t } = useTranslation('settings');       // pick the namespace
  const { t: tc } = useTranslation('common');      // a second hook for shared keys
  return <Text>{t('title')}</Text>;                // t('language.subtitle', { name }) for interpolation
}
```

- Reuse `common` keys (`tc('actions.retry')`, `tc('errors.network')`, `tc('tabs.home')`) instead of
  duplicating shared strings into a screen namespace.
- Interpolation uses `{{var}}` in the JSON and `t('key', { var })` in code. Counts use i18next plurals
  (`key_one` / `key_other`) with `t('key', { count })`.
- **Never** translate API data (artist/album/track/shop/genre names, usernames, bios, user-typed
  values) or non-UI strings (env var names, console logs, analytics). Only UI chrome.
- **No em dashes** in copy (repo-wide rule). Keep the mobile tone concise and friendly.

## How the language is resolved (no flash)

`src/i18n/index.ts` runs `i18next.init()` synchronously at module load (side-effect import in
`app/_layout.tsx`, like `initializeTheme()`), so the first render is already in the right language.
`resolveInitialLanguage()` picks, in order: the explicit MMKV choice (`app-language`) -> the phone
locale (`expo-localization`, narrowed to a supported code) -> English.

`useDisplayLanguage()` then reconciles the signed-in user's server setting: only an EXPLICIT server
value (`UserSetting.language` is nullable; null means "not chosen") overrides the locally resolved
language. Writing a language flips i18next immediately, persists to MMKV, optimistically updates the
shared `['settings']` cache, and PUTs `/settings`. Switching language re-renders translations
client-side, so (unlike currency) there is nothing to invalidate.

## The language setting across the pipeline (mirrors currency)

`packages/db` `UserSetting.language` (nullable) -> `apps/api` `SupportedLanguageSchema`
(`en/fr/de/es`), `GET /languages`, and `GET/PUT /settings` (the `UserSettings` shape carries both
`currency` and `language`, partial updates) -> regenerated `@getvinyls/api-client` types ->
`useDisplayLanguage`. Keep the server's `SUPPORTED_LANGUAGES`
(`apps/api/src/language/languages.ts`) and the mobile `SUPPORTED_LANGUAGE_CODES`
(`apps/mobile/src/i18n/languages.ts`) in lockstep with the locale folders under `locales/`.

## Adding a language

Add the code to `SUPPORTED_LANGUAGES` (api) and `SUPPORTED_LANGUAGE_CODES` + `LANGUAGE_META` (mobile),
create `locales/<code>/<namespace>.json` for every namespace (mirroring the English keys), import them
in `resources.ts`, regenerate the API types, and migrate nothing (the column is a plain string).
