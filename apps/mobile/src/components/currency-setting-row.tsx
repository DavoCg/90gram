import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react-native';
import { Pressable, View } from '../theme/uniwind';
import { Text } from './text';
import { useThemeColors } from '../theme/colors';
import {
  CURRENCY_META,
  useDisplayCurrency,
  useSupportedCurrencies,
} from '../currency';

// Settings row for the display currency. Tapping it expands an inline list of the supported
// currencies; choosing one persists it (and re-converts every price in the app). Mirrors the other
// settings rows so it sits naturally inside a SettingsSection.
export function CurrencySettingRow() {
  const colors = useThemeColors();
  const { currency, setCurrency } = useDisplayCurrency();
  const currencies = useSupportedCurrencies();
  const [expanded, setExpanded] = useState(false);

  const selectedMeta = CURRENCY_META[currency];

  return (
    <View>
      <Pressable
        onPress={() => setExpanded((open) => !open)}
        className="flex-row items-center justify-between px-4 py-3.5"
      >
        <View className="flex-1 pr-4">
          <Text weight="semibold">Currency</Text>
          <Text size="sm" color="neutral-soft" className="mt-0.5">
            Show prices in {selectedMeta ? `${selectedMeta.name} (${currency})` : currency}
          </Text>
        </View>
        <View
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        >
          <ChevronDown color={colors.muted} size={20} />
        </View>
      </Pressable>

      {expanded
        ? currencies.map((code) => {
            const meta = CURRENCY_META[code];
            const isSelected = code === currency;
            return (
              <Pressable
                key={code}
                onPress={() => {
                  setCurrency(code);
                  setExpanded(false);
                }}
                className="flex-row items-center justify-between border-t border-border px-4 py-3"
              >
                <View className="flex-row items-center gap-3">
                  <Text weight="semibold" color="neutral-soft" className="w-8">
                    {meta?.symbol ?? code}
                  </Text>
                  <Text>{meta ? `${meta.name} (${code})` : code}</Text>
                </View>
                {isSelected ? <Check color={colors.accent} size={18} /> : null}
              </Pressable>
            );
          })
        : null}
    </View>
  );
}
