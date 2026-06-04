import type { LucideIcon } from 'lucide-react-native';
import { Text, View } from '../theme/uniwind';
import { useThemeColors } from '../theme/colors';
import { PlayerBar } from './PlayerBar';

interface PlaceholderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

// Empty-state scaffold for tabs that are not built out yet. Keeps the PlayerBar mounted so
// playback controls stay reachable from every tab (it renders null when nothing is playing).
export function Placeholder({ icon: Icon, title, subtitle }: PlaceholderProps) {
  const colors = useThemeColors();

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <Icon color={colors.muted} size={48} strokeWidth={1.5} />
        <Text className="text-xl font-semibold text-text">{title}</Text>
        <Text className="text-center text-sm text-muted">{subtitle}</Text>
      </View>
      <PlayerBar />
    </View>
  );
}
