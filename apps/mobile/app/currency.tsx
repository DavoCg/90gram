import { useRouter } from 'expo-router';
import type { SupportedCurrency } from '@getvinyls/api-client';
import { View } from '../src/theme/uniwind';
import { Text } from '../src/components/text';
import { FormSheetHeader } from '../src/components/form-sheet-header';
import { SheetScrollView, SheetSelectableRow } from '../src/components/sheet';
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
  const { currency, setCurrency } = useDisplayCurrency();
  const currencies = useSupportedCurrencies();

  return (
    // react-native-screens pins a header above the list when the sheet content is EXACTLY two
    // subviews: the collapsable={false} header (FormSheetHeader) and the ScrollView. A wrapping View,
    // a background on that wrapper, or extra subviews make the list overlap the header.
    <>
      <FormSheetHeader title="Currency" />
      <SheetScrollView contentContainerStyle={{ paddingBottom: bottomPadding }}>
        {currencies.map((code) => {
          const isSelected = code === currency;
          return (
            <SheetSelectableRow
              key={code}
              selected={isSelected}
              onPress={() => {
                setCurrency(code as SupportedCurrency);
                router.back();
              }}
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
            </SheetSelectableRow>
          );
        })}
      </SheetScrollView>
    </>
  );
}
