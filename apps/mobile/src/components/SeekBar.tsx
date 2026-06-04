import { useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';
import type { LayoutChangeEvent } from 'react-native';
import { Text, View } from '../theme/uniwind';

const THUMB_SIZE = 14;

// Animated TextInput whose `text` prop is driven from a worklet, so the elapsed label can
// update on the UI thread without a React re-render on every gesture frame.
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

function formatTime(seconds: number): string {
  'worklet';
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Draggable progress bar. Renders the full "elapsed / track / duration" row and drives
// seeking by sliding. Everything that moves during a drag (fill, thumb, elapsed label) is
// driven by Reanimated shared values on the UI thread, so dragging triggers ZERO React
// renders. The fill/thumb use transforms (scaleX / translateX), never layout props, so the
// UI thread never re-runs layout per frame. We only call onSeek once, on release, which
// matches the engine (a fresh AudioBufferSourceNode starts at the new offset).
export function SeekBar({
  positionSec,
  durationSec,
  canSeek = true,
  onSeek,
}: {
  positionSec: number;
  durationSec: number;
  // False while streaming a non-seekable source: the bar becomes a read-only indicator.
  canSeek?: boolean;
  onSeek: (seconds: number) => void;
}) {
  // Keep the latest onSeek without recreating the gesture each render.
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;
  const seek = (seconds: number) => onSeekRef.current(seconds);

  const accent = useCSSVariable('--color-accent');
  const accentColor = typeof accent === 'string' && accent.length > 0 ? accent : '#e879f9';
  const muted = useCSSVariable('--color-muted');
  const mutedColor = typeof muted === 'string' && muted.length > 0 ? muted : '#9ca3af';

  const trackWidth = useSharedValue(0);
  const scrubbing = useSharedValue(false);
  const scrubFraction = useSharedValue(0);
  // After release we keep showing the scrubbed position until the engine's reported
  // position catches up, otherwise the bar flashes back to the old timestamp for the
  // gap between release and the next position tick.
  const holding = useSharedValue(false);
  const holdFraction = useSharedValue(0);

  // Mirror the props the label needs into shared values so the elapsed text can be computed
  // on the UI thread. These change at most every position tick (~250ms), not per frame.
  const positionShared = useSharedValue(positionSec);
  const durationShared = useSharedValue(durationSec);
  useEffect(() => {
    positionShared.value = positionSec;
  }, [positionSec, positionShared]);
  useEffect(() => {
    durationShared.value = durationSec;
  }, [durationSec, durationShared]);

  // The committed seek target, held until the engine position reaches it. This is the only
  // React state here, and it updates once per release, never during the drag.
  const [pendingSec, setPendingSec] = useState<number | null>(null);

  const progress = durationSec > 0 ? Math.min(Math.max(positionSec / durationSec, 0), 1) : 0;

  // Drop the visual hold once the live position lands on (or passes) the seek target.
  useEffect(() => {
    if (pendingSec === null) return;
    if (Math.abs(positionSec - pendingSec) < 0.5) {
      setPendingSec(null);
      holding.value = false;
    }
  }, [positionSec, pendingSec, holding]);

  const updateFromX = (x: number) => {
    'worklet';
    const width = trackWidth.value;
    scrubFraction.value = width > 0 ? Math.min(Math.max(x / width, 0), 1) : 0;
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .enabled(canSeek && durationSec > 0)
    .onBegin((e) => {
      scrubbing.value = true;
      updateFromX(e.x);
    })
    .onUpdate((e) => {
      updateFromX(e.x);
    })
    .onEnd(() => {
      const target = scrubFraction.value * durationSec;
      scrubbing.value = false;
      // Freeze the bar at the released position until the engine catches up.
      holdFraction.value = scrubFraction.value;
      holding.value = true;
      runOnJS(seek)(target);
      runOnJS(setPendingSec)(target);
    })
    .onFinalize(() => {
      scrubbing.value = false;
    });

  // Tap anywhere on the track to jump there. Pan needs finger movement to activate, so a
  // stationary tap would otherwise do nothing; this handles the "click to seek" case.
  const tap = Gesture.Tap()
    .enabled(canSeek && durationSec > 0)
    .maxDuration(400)
    .onEnd((e) => {
      const width = trackWidth.value;
      const f = width > 0 ? Math.min(Math.max(e.x / width, 0), 1) : 0;
      const target = f * durationSec;
      // Freeze the bar at the tapped position until the engine catches up.
      holdFraction.value = f;
      holding.value = true;
      runOnJS(seek)(target);
      runOnJS(setPendingSec)(target);
    });

  // A real tap (no movement) activates `tap`; any drag activates `pan`. They are mutually
  // exclusive, so racing them never double-seeks.
  const gesture = Gesture.Race(pan, tap);

  // Single source of truth for the displayed fraction, evaluated on the UI thread.
  const fraction = useDerivedValue(() =>
    scrubbing.value ? scrubFraction.value : holding.value ? holdFraction.value : progress,
  );

  // scaleX from the left edge (transformOrigin set statically below) instead of animating width.
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(fraction.value, 0) }],
  }));

  // translateX instead of animating left, and account for the track width measured on layout.
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: fraction.value * trackWidth.value - THUMB_SIZE / 2 }],
  }));

  const elapsedProps = useAnimatedProps(() => {
    const seconds =
      scrubbing.value || holding.value ? fraction.value * durationShared.value : positionShared.value;
    // `text` is a valid TextInput native prop even though it is not in the public RN types.
    return { text: formatTime(seconds) } as object;
  });

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.value = e.nativeEvent.layout.width;
  };

  return (
    <View className="mt-3 flex-row items-center gap-2">
      <AnimatedTextInput
        editable={false}
        underlineColorAndroid="transparent"
        defaultValue={formatTime(positionSec)}
        animatedProps={elapsedProps}
        style={{
          width: 40,
          fontSize: 12,
          lineHeight: 16,
          padding: 0,
          color: mutedColor,
          includeFontPadding: false,
        }}
      />

      <GestureDetector gesture={gesture}>
        {/* Tall, transparent hit area so the thin visual track is easy to grab. */}
        <View className="h-6 flex-1 justify-center" onLayout={onLayout}>
          <View className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
            <Animated.View
              style={[
                {
                  height: 4,
                  width: '100%',
                  borderRadius: 9999,
                  backgroundColor: accentColor,
                  transformOrigin: 'left',
                },
                fillStyle,
              ]}
            />
          </View>
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 0,
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                borderRadius: THUMB_SIZE / 2,
                backgroundColor: accentColor,
              },
              thumbStyle,
            ]}
          />
        </View>
      </GestureDetector>

      <Text className="w-10 text-right text-xs text-muted">{formatTime(durationSec)}</Text>
    </View>
  );
}
