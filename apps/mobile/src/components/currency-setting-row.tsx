import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from '../theme/uniwind';
import { Text } from './text';
import { useThemeColors } from '../theme/colors';
import { CurrencySymbol } from './currency-symbol';
import { CURRENCY_META, useDisplayCurrency } from '../currency';

// Settings row for the display currency. Tapping it opens the currency formSheet (app/currency.tsx),
// which lists the supported currencies and persists the choice (re-converting every price in the app).
// Mirrors the other settings rows so it sits naturally inside a SettingsSection.
export function CurrencySettingRow() {
  const colors = useThemeColors();
  const { currency } = useDisplayCurrency();

  const selectedMeta = CURRENCY_META[currency];

  return (
    <Pressable
      onPress={() => router.push('/currency')}
      className="flex-row items-center justify-between px-4 py-3.5"
    >
      <View className="flex-1 pr-4">
        <Text weight="semibold">Currency</Text>
        <Text size="sm" color="neutral-soft" className="mt-0.5">
          Show prices in {selectedMeta ? `${selectedMeta.name} (${currency})` : currency}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <CurrencySymbol code={currency} size={32} />
        <ChevronRight color={colors.muted} size={20} />
      </View>
    </Pressable>
  );
}
