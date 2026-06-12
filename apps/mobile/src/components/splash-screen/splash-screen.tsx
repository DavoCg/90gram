import { useThemeColors } from '../../theme/colors';
import { View } from '../../theme/uniwind';
import { EqualizerBars } from '../equalizer-bars';
import { Text } from '../text';

// Neutral waiting screen shown while we do not yet know if the user is signed in (the persisted
// session is still being restored from SecureStore). Branded rather than a bare spinner so the
// first frame reads as a deliberate splash, not a flash, and never reveals the sign-in or the tabs
// before the session resolves. Bouncing equalizer bars keep it on-theme for an audio app.
export function SplashScreen() {
  const colors = useThemeColors();

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-bg">
      <Text variant="display" weight="bold" size="3xl" color="neutral">
        getvinyls
      </Text>
      <EqualizerBars playing color={colors.accent} size={28} />
    </View>
  );
}
