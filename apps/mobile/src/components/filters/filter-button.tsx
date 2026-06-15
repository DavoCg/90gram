import { SlidersHorizontal } from 'lucide-react-native';
import { Pressable, View } from '../../theme/uniwind';
import { useThemeColors } from '../../theme/colors';

interface FilterButtonProps {
  onPress: () => void;
  // Number of active filters; when > 0 a dot badge is shown on the icon.
  activeCount: number;
}

// The header filter button (home top-right). Opens the filter sheet; shows an accent dot when any
// filter is active so the affordance reads as "on" at a glance.
export function FilterButton({ onPress, activeCount }: FilterButtonProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel="Filters"
      className="h-9 w-9 items-center justify-center"
    >
      <SlidersHorizontal color={colors.text} size={22} />
      {activeCount > 0 ? (
        <View className="absolute right-0.5 top-0.5 size-2.5 rounded-full bg-accent" />
      ) : null}
    </Pressable>
  );
}
