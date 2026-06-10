import { View } from '../theme/uniwind';
import { Text } from './text';
import { CURRENCY_META } from '../currency';

// A currency's region flag rendered as a circle. Flag emoji are rectangular, so we oversize the
// glyph and clip it to a round container (overflow-hidden + rounded-full) so it reads as a coin-like
// circular flag, matching the currency picker rows.
export function CurrencyFlag({ code, size = 32 }: { code: string; size?: number }) {
  const flag = CURRENCY_META[code]?.flag;
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full bg-surface-2"
      style={{ width: size, height: size }}
    >
      {flag ? (
        <Text style={{ fontSize: size * 0.95, lineHeight: size * 1.15 }}>{flag}</Text>
      ) : (
        <Text weight="semibold" color="neutral-soft" size="sm">
          {code.slice(0, 2)}
        </Text>
      )}
    </View>
  );
}
