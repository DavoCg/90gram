import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// A horizontal shake plus an error haptic, driven on the UI thread by Reanimated shared values.
// Used to signal a rejected one-time code. Ported from perp-companion.
export function useShake() {
  const shakeTranslateX = useSharedValue(0);

  const shake = useCallback(() => {
    const translationAmount = 4;
    const timingConfig = {
      easing: Easing.bezier(0.35, 0.7, 0.5, 0.7),
      duration: 80,
    };
    shakeTranslateX.value = withSequence(
      withTiming(translationAmount, timingConfig),
      withRepeat(withTiming(-translationAmount, timingConfig), 3, true),
      withSpring(0, { mass: 0.5 }),
    );
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, [shakeTranslateX]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeTranslateX.value }],
  }));

  return { shake, style };
}
