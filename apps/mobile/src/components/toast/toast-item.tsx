import { useCallback, useEffect } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { CircleAlert, CircleCheck, CircleX, Info } from 'lucide-react-native';
import { useUniwind } from 'uniwind';
import { Pressable, View } from '../../theme/uniwind';
import { Text } from '../text';
import type { ToastData, ToastType } from './store';

// Variant icon + its accent color, mirroring the design system's role -> Radix scale mapping
// (success -> grass, error -> tomato, warning -> amber, info -> blue), step-11 so the glyph stays
// legible on our surface in both themes. lucide takes a JS `color`, so these stay JS values
// (same constraint the React Navigation chrome has in theme/colors.ts).
const ICONS: Record<Exclude<ToastType, 'normal'>, typeof CircleCheck> = {
  success: CircleCheck,
  error: CircleX,
  warning: CircleAlert,
  info: Info,
};

const ICON_COLORS = {
  light: { success: '#2a7e3b', error: '#d13415', warning: '#ab6400', info: '#0d74ce' },
  dark: { success: '#71d083', error: '#ff977d', warning: '#ffca16', info: '#70b8ff' },
} as const;

// Snappy: a quick, lightly-damped spring for entry and swipe spring-back (a hint of settle, no
// wobble), and a short linear slide for exits. No opacity anywhere, the toast only ever moves.
const ENTER_SPRING = { duration: 380, dampingRatio: 0.82 } as const;
const SETTLE_SPRING = { duration: 280, dampingRatio: 0.9 } as const;
const EXIT_DURATION = 180;

// Past this many px dragged up, or this upward fling speed, a release dismisses instead of
// springing back.
const SWIPE_DISMISS_DISTANCE = 28;
const SWIPE_DISMISS_VELOCITY = 450;

// Slack added so the toast clears its own shadow/border when parked off the top edge.
const OFFSCREEN_SLACK = 24;

const AnimatedView = Animated.createAnimatedComponent(View);

interface ToastItemProps {
  data: ToastData;
  onRemove: (id: string) => void;
}

// One toast. Owns its entry/exit translate and its swipe-up-to-dismiss gesture. The visible
// translateY is `base + drag`: `base` drives the in/out animation, `drag` tracks the finger, so
// the gesture composes with the animation instead of fighting it over a single value.
export function ToastItem({ data, onRemove }: ToastItemProps) {
  const insets = useSafeAreaInsets();
  const isDark = useUniwind().theme === 'dark';

  const base = useSharedValue(-9999); // parked far off-screen until measured (no first-frame flash)
  const drag = useSharedValue(0);
  const height = useSharedValue(0);
  const entered = useSharedValue(false);

  const remove = useCallback(() => onRemove(data.id), [onRemove, data.id]);

  // Slide in once we know the toast's height: start exactly above the top edge, spring to rest.
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const measured = event.nativeEvent.layout.height;
      height.value = measured;
      if (!entered.value) {
        entered.value = true;
        base.value = -(measured + insets.top + OFFSCREEN_SLACK);
        base.value = withSpring(0, ENTER_SPRING);
      }
    },
    [base, entered, height, insets.top],
  );

  // Animate up and out, then drop from the store. Used by the auto-dismiss timer.
  const dismiss = useCallback(() => {
    base.value = withTiming(
      -(height.value + insets.top + OFFSCREEN_SLACK),
      { duration: EXIT_DURATION },
      (finished) => {
        if (finished) runOnJS(remove)();
      },
    );
  }, [base, height, insets.top, remove]);

  // Auto-dismiss after `duration` (skip when Infinity, e.g. a pending promise toast).
  useEffect(() => {
    if (!Number.isFinite(data.duration)) return;
    const timer = setTimeout(dismiss, data.duration);
    return () => clearTimeout(timer);
  }, [data.duration, dismiss]);

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      // Upward follows the finger 1:1; downward is heavily rubber-banded so the toast resists
      // being pulled below its resting place.
      drag.value = event.translationY < 0 ? event.translationY : event.translationY * 0.12;
    })
    .onEnd((event) => {
      const shouldDismiss =
        event.translationY < -SWIPE_DISMISS_DISTANCE || event.velocityY < -SWIPE_DISMISS_VELOCITY;
      if (shouldDismiss) {
        drag.value = withTiming(
          -(height.value + insets.top + OFFSCREEN_SLACK),
          { duration: EXIT_DURATION },
          (finished) => {
            if (finished) runOnJS(remove)();
          },
        );
      } else {
        drag.value = withSpring(0, SETTLE_SPRING);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: base.value + drag.value }],
  }));

  const onAction = useCallback(() => {
    data.action?.onClick();
    dismiss();
  }, [data.action, dismiss]);

  const Icon = data.type === 'normal' ? null : ICONS[data.type];
  const iconColor = data.type === 'normal' ? undefined : ICON_COLORS[isDark ? 'dark' : 'light'][data.type];

  return (
    <GestureDetector gesture={pan}>
      <AnimatedView
        onLayout={onLayout}
        style={animatedStyle}
        layout={LinearTransition.duration(220)}
        className="flex-row items-center gap-3 rounded-2xl curve-continuous border-hairline border-border bg-surface px-4 py-3"
      >
        {Icon ? <Icon color={iconColor} size={22} /> : null}
        <View className="flex-1">
          <Text size="sm" weight="semibold">
            {data.title}
          </Text>
          {data.description ? (
            <Text size="xs" color="neutral-soft" className="mt-0.5" multiline>
              {data.description}
            </Text>
          ) : null}
        </View>
        {data.action ? (
          <Pressable onPress={onAction} className="rounded-full bg-accent px-3 py-1.5">
            <Text size="sm" weight="semibold" color="white">
              {data.action.label}
            </Text>
          </Pressable>
        ) : null}
      </AnimatedView>
    </GestureDetector>
  );
}
