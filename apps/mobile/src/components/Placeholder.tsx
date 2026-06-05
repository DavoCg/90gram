import type { LucideIcon } from 'lucide-react-native';
import { Text, View } from '../theme/uniwind';
import { useThemeColors } from '../theme/colors';
import { AppHeader } from './AppHeader';

interface PlaceholderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

// Empty-state scaffold for tabs that are not built out yet. Renders the shared AppHeader (the
// tab title) above a centered empty state. The Now Playing surface is mounted globally at the
// app root, so playback controls stay reachable from every tab.
export function Placeholder({ icon: Icon, title, subtitle }: PlaceholderProps) {
  const colors = useThemeColors();

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title={title} />
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <Icon color={colors.muted} size={48} strokeWidth={1.5} />
        <Text className="text-center text-sm text-muted">{subtitle}</Text>
      </View>
    </View>
  );
}
