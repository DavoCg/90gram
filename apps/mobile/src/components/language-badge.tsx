import { View } from '../theme/uniwind';
import { Text } from './text';

// A language's two-letter code (EN, FR, DE, ...) rendered inside a coin-like circle. Mirrors
// CurrencySymbol so the language picker and settings row match the currency rows, with no flag emoji.
export function LanguageBadge({ code, size = 40 }: { code: string; size?: number }) {
  const label = code.slice(0, 2).toUpperCase();
  return (
    <View
      className="items-center justify-center rounded-full bg-surface-2"
      style={{ width: size, height: size }}
    >
      <Text weight="semibold" style={{ fontSize: size * 0.36 }}>
        {label}
      </Text>
    </View>
  );
}
