import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from '../theme/uniwind';
import { Text } from './text';
import { useThemeColors } from '../theme/colors';
import { useDisplayLanguage } from '../language';
import { LANGUAGE_META } from '../i18n/languages';
import { LanguageBadge } from './language-badge';

// Settings row for the UI language. Tapping it opens the language form sheet (app/language.tsx)
// listing the supported languages; choosing one switches every translation instantly and persists it.
// Mirrors the currency row so it sits naturally inside a SettingsSection.
export function LanguageSettingRow() {
  const colors = useThemeColors();
  const router = useRouter();
  const { t } = useTranslation('settings');
  const { language } = useDisplayLanguage();

  const meta = LANGUAGE_META[language];

  return (
    <Pressable
      onPress={() => router.push('/language')}
      className="flex-row items-center justify-between px-4 py-3.5"
    >
      <View className="flex-1 pr-4">
        <Text weight="semibold">{t('language.title')}</Text>
        <Text size="sm" color="neutral-soft" className="mt-0.5">
          {t('language.subtitle', { name: meta.nativeName })}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <LanguageBadge code={language} size={32} />
        <ChevronRight color={colors.muted} size={20} />
      </View>
    </Pressable>
  );
}
