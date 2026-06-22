import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from '../src/theme/uniwind';
import { Text } from '../src/components/text';
import { FormSheetHeader } from '../src/components/form-sheet-header';
import { SheetScrollView, SheetSelectableRow } from '../src/components/sheet';
import { useSheetBottomPadding } from '../src/components/use-sheet-bottom-padding';
import { useDisplayLanguage, useSupportedLanguages } from '../src/language';
import { LANGUAGE_META } from '../src/i18n/languages';
import { LanguageBadge } from '../src/components/language-badge';

// UI-language picker, presented as a native form sheet (see the formSheet screen options in
// app/_layout.tsx). Fully self-contained: language state is global (useDisplayLanguage reads i18next
// + the settings query, useSupportedLanguages the server list), so picking a row switches every
// translation and persists it, then dismisses. Opened from the Settings language row.
export default function LanguageSheet() {
  const router = useRouter();
  const bottomPadding = useSheetBottomPadding();
  const { t } = useTranslation('language');
  const { language, setLanguage } = useDisplayLanguage();
  const languages = useSupportedLanguages();

  return (
    // react-native-screens pins the header above the list when the sheet content is EXACTLY two
    // subviews: the collapsable={false} header and the ScrollView. Keep it to those two.
    <>
      <FormSheetHeader title={t('title')} />
      <SheetScrollView contentContainerStyle={{ paddingBottom: bottomPadding }}>
        {languages.map((code) => {
          const meta = LANGUAGE_META[code];
          const isSelected = code === language;
          return (
            <SheetSelectableRow
              key={code}
              selected={isSelected}
              onPress={() => {
                setLanguage(code);
                router.back();
              }}
            >
              <LanguageBadge code={code} />
              <View className="flex-1">
                <Text weight="semibold">{meta.nativeName}</Text>
                <Text size="sm" color="neutral-soft" className="mt-0.5">
                  {meta.name}
                </Text>
              </View>
            </SheetSelectableRow>
          );
        })}
      </SheetScrollView>
    </>
  );
}
