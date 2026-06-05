import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { OTPInputState } from './otp-input-types';
import { otpInputCaretRecipe } from './otp-input-recipe';

// The blinking caret shown on the active slot. Ported from perp-companion.
export function OTPInputCaret({ state }: { state?: OTPInputState }) {
  const opacity = useSharedValue(1);
  const classes = otpInputCaretRecipe({ state });

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0, { duration: 500 }), withTiming(1, { duration: 500 })),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={animatedStyle} className={classes.caret()} />;
}
