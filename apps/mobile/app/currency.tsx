import { ScrollView as RNScrollView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import type { SupportedCurrency } from '@getvinyls/api-client';
import { Pressable, View } from '../src/theme/uniwind';
import { useThemeColors } from '../src/theme/colors';
import { Text } from '../src/components/text';
import { FormSheetHeader } from '../src/components/form-sheet-header';
import { useSheetBottomPadding } from '../src/components/use-sheet-bottom-padding';
import { CurrencySymbol } from '../src/components/currency-symbol';
import { CURRENCY_META, useDisplayCurrency, useSupportedCurrencies } from '../src/currency';

// Display-currency picker, presented as a native form sheet (see the formSheet screen options in
// app/_layout.tsx). It is fully self-contained: currency state is global (useDisplayCurrency reads
// the settings query + MMKV, useSupportedCurrencies the server list), so picking a row persists it
// and dismisses, with no callback plumbed in from the opener. Opened from the Settings currency row.
export default function CurrencySheet() {
  const router = useRouter();
  const bottomPadding = useSheetBottomPadding();
  const colors = useThemeColors();
  const { currency, setCurrency } = useDisplayCurrency();
  const currencies = useSupportedCurrencies();

  return (
    // react-native-screens pins a header above the list when the sheet content is EXACTLY two
    // subviews: the collapsable={false} header (FormSheetHeader) and the ScrollView. A wrapping View,
    // a background on that wrapper, or extra subviews make the list overlap the header.
    <>
      <FormSheetHeader title="Currency" />
      <RNScrollView
        style={{ backgroundColor: colors.surface }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {currencies.map((code) => {
          const isSelected = code === currency;
          return (
            <Pressable
              key={code}
              onPress={() => {
                setCurrency(code as SupportedCurrency);
                router.back();
              }}
              className={`flex-row items-center gap-3 rounded-2xl curve-continuous px-3 py-2.5 ${
                isSelected ? 'border-hairline border-border bg-surface-2' : ''
              }`}
            >
              <CurrencySymbol code={code} />
              <View className="flex-1">
                <Text weight="semibold">{code}</Text>
                {CURRENCY_META[code]?.name ? (
                  <Text size="sm" color="neutral-soft" className="mt-0.5">
                    {CURRENCY_META[code].name}
                  </Text>
                ) : null}
              </View>
              {isSelected ? <Check color={colors.accent} size={20} /> : null}
            </Pressable>
          );
        })}
      </RNScrollView>
    </>
  );
}
