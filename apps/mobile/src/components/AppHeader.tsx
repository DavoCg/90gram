import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, View } from '../theme/uniwind';
import { Text } from './text';
import { useThemeColors } from '../theme/colors';

interface AppHeaderProps {
  title?: string;
  // Show the back arrow. Defaults to whether the navigator can pop, so pushed detail screens
  // get it and tab roots do not. Pass explicitly to override the auto-detection.
  showBack?: boolean;
  // Optional trailing controls, rendered at the end of the row (e.g. actions on the right).
  right?: ReactNode;
}

// The single app header, used on every screen in place of the native navigation headers (which
// are disabled in the layouts). It pads past the status-bar inset, shows an optional back arrow,
// a left-aligned title, and an optional right slot. Keep screens consistent by always rendering
// this at the top rather than re-enabling per-screen native headers.
export function AppHeader({ title, showBack, right }: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const canGoBack = showBack ?? router.canGoBack();

  return (
    <View style={{ paddingTop: insets.top }} className="bg-bg">
      <View className="h-12 flex-row items-center gap-1 px-4">
        {canGoBack ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            className="-ml-2 h-9 w-9 items-center justify-center"
          >
            <ChevronLeft color={colors.text} size={28} />
          </Pressable>
        ) : null}
        {title ? (
          <Text numberOfLines={1} size="2xl" weight="bold" className="flex-1">
            {title}
          </Text>
        ) : (
          <View className="flex-1" />
        )}
        {right ?? null}
      </View>
    </View>
  );
}
