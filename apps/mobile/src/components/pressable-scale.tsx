import type { ComponentProps } from 'react';
import type { GestureResponderEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Pressable } from '../theme/uniwind';

// A drop-in replacement for our Pressable that adds the press-scale "bounce": dip to 0.95 on
// press-in, spring back on press-out, all on the UI thread. className is supported (uniwind), so a
// caller's existing styling is preserved unchanged. Animating the single pressable node (rather
// than an outer wrapper) keeps layout intact, so flex-1 children still split their row.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PRESSED_SCALE = 0.95;
const SPRING_CONFIG = { damping: 15, stiffness: 280, mass: 0.5 } as const;

// Public props mirror our plain Pressable; the reanimated wrapping is an internal detail.
export type PressableScaleProps = ComponentProps<typeof Pressable>;

export function PressableScale({ onPressIn, onPressOut, disabled, style, ...rest }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = (event: GestureResponderEvent) => {
    if (!disabled) scale.value = withSpring(PRESSED_SCALE, SPRING_CONFIG);
    onPressIn?.(event);
  };
  const handlePressOut = (event: GestureResponderEvent) => {
    scale.value = withSpring(1, SPRING_CONFIG);
    onPressOut?.(event);
  };

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, style]}
      {...rest}
    />
  );
}
