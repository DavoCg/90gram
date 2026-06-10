import { View } from '../theme/uniwind';
import { Text } from './text';
import { CURRENCY_META } from '../currency';

// A currency's symbol (€, $, £, ...) rendered inside a coin-like circle. We size the glyph relative
// to the circle and fall back to the ISO code when no symbol is known, matching the currency picker
// rows.
export function CurrencySymbol({ code, size = 40 }: { code: string; size?: number }) {
  const symbol = CURRENCY_META[code]?.symbol ?? code.slice(0, 3);
  // Multi-character symbols (CHF, kr, zł, ...) need a smaller glyph to stay inside the circle.
  const glyphSize = symbol.length > 1 ? size * 0.36 : size * 0.5;
  return (
    <View
      className="items-center justify-center rounded-full bg-surface-2"
      style={{ width: size, height: size }}
    >
      <Text weight="semibold" style={{ fontSize: glyphSize }}>
        {symbol}
      </Text>
    </View>
  );
}
