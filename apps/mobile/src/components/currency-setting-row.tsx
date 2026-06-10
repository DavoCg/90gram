import { useState } from 'react';
import { ChevronRight } from 'lucide-react-native';
import type { SupportedCurrency } from '@getvinyls/api-client';
import { Pressable, View } from '../theme/uniwind';
import { Text } from './text';
import { useThemeColors } from '../theme/colors';
import { CurrencySymbol } from './currency-symbol';
import { PickerSheet, type PickerOption } from './picker-sheet';
import {
  CURRENCY_META,
  useDisplayCurrency,
  useSupportedCurrencies,
} from '../currency';

// Settings row for the display currency. Tapping it opens the shared PickerSheet listing the
// supported currencies (each with its symbol); choosing one persists it (and re-converts every price
// in the app). Mirrors the other settings rows so it sits naturally inside a SettingsSection.
export function CurrencySettingRow() {
  const colors = useThemeColors();
  const { currency, setCurrency } = useDisplayCurrency();
  const currencies = useSupportedCurrencies();
  const [open, setOpen] = useState(false);

  const selectedMeta = CURRENCY_META[currency];

  const options: PickerOption<SupportedCurrency>[] = currencies.map((code) => ({
    value: code,
    label: code,
    description: CURRENCY_META[code]?.name,
    leading: <CurrencySymbol code={code} />,
  }));

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
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

      <PickerSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Currency"
        options={options}
        selected={currency}
        onSelect={setCurrency}
      />
    </>
  );
}
