import { ScrollView as RNScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Pressable, View } from '../src/theme/uniwind';
import { Text } from '../src/components/text';
import { useThemeColors } from '../src/theme/colors';
import { CurrencySymbol } from '../src/components/currency-symbol';
import { CURRENCY_META, useDisplayCurrency, useSupportedCurrencies } from '../src/currency';

// Display-currency picker, presented as a native formSheet (see app/_layout.tsx). Reads and writes
// the global currency store directly, so it needs no params: choosing a row persists it (re-converting
// every price in the app) and dismisses the sheet. The sheet opens at a fixed detent (a ScrollView
// cannot be measured by `fitToContents`), so the container fills that height and the list scrolls
// within it. Replaces the old shared PickerSheet (@swmansion bottom sheet).
export default function CurrencyScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { currency, setCurrency } = useDisplayCurrency();
  const currencies = useSupportedCurrencies();

  return (
    <View className="flex-1 bg-surface px-4 pt-4">
      <Text size="lg" weight="semibold" className="mb-1 px-1">
        Currency
      </Text>
      {/* Fill the fixed-height sheet and scroll within it; pad the last row clear of the home indicator. */}
      <RNScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: insets.bottom + 12 }}
        showsVerticalScrollIndicator={false}
      >
        {currencies.map((code) => {
          const isSelected = code === currency;
          return (
            <Pressable
              key={code}
              onPress={() => {
                setCurrency(code);
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
                    {CURRENCY_META[code]?.name}
                  </Text>
                ) : null}
              </View>
              {isSelected ? <Check color={colors.accent} size={20} /> : null}
            </Pressable>
          );
        })}
      </RNScrollView>
    </View>
  );
}
