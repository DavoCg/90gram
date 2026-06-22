import 'i18next';
import type { englishResources } from './resources';

// Type-safe translation keys: react-i18next reads CustomTypeOptions to type `t()` and
// `useTranslation()` against the actual English bundle. A typo in a key, a wrong namespace, or a
// missing interpolation value becomes a compile error (strict TS, zero `any`). English is the
// canonical shape; other languages mirror it.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: typeof englishResources;
  }
}
