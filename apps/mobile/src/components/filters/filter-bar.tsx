import { SlidersHorizontal } from 'lucide-react-native';
import { Pressable, View } from '../../theme/uniwind';
import { useThemeColors } from '../../theme/colors';
import { Text } from '../text';

interface FilterBarProps {
  onPress: () => void;
  // Number of active filters; drives the active styling and the count badge.
  activeCount: number;
}

// The home filter bar. It sits directly under the app header and above the record list (rendered
// as a sticky bar there, not as a header icon), hosting the affordance that opens the filter sheet.
// The button reflects how many filters are active so the state reads at a glance.
export function FilterBar({ onPress, activeCount }: FilterBarProps) {
  const colors = useThemeColors();
  const active = activeCount > 0;
  return (
    <View className="bg-bg px-4 pb-2 pt-1">
      <Pressable
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Filters"
        className={`flex-row items-center gap-2 self-start rounded-2xl curve-continuous px-3.5 py-2 ${
          active ? 'bg-surface-2' : 'bg-surface'
        }`}
      >
        <SlidersHorizontal color={active ? colors.accent : colors.text} size={18} />
        <Text weight="semibold" size="sm">
          Filters
        </Text>
        {active ? (
          <View
            className="ml-0.5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5"
            style={{ minWidth: 20 }}
          >
            <Text size="xs" weight="bold" color="accent-on-solid">
              {String(activeCount)}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
