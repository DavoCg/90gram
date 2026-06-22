import { z } from '@hono/zod-openapi';

// The UI languages a user can pick, as ISO-639-1 codes. Deliberately curated so the mobile picker
// stays short and the enum gives validation + types across the whole pipeline (mirrors the supported
// currency set). English is the default and the i18n fallback. Keep this in lockstep with the mobile
// translation bundles (apps/mobile/src/i18n/locales): a code here must have a matching bundle there.
export const SUPPORTED_LANGUAGES = ['en', 'fr', 'de', 'es'] as const;

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export const SupportedLanguageSchema = z
  .enum(SUPPORTED_LANGUAGES)
  .openapi('SupportedLanguage', { example: 'en' });

export type SupportedLanguage = z.infer<typeof SupportedLanguageSchema>;
