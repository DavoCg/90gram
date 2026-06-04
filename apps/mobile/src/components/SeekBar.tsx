import { useRef, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';
import type { LayoutChangeEvent } from 'react-native';
import { Text, View } from '../theme/uniwind';

const THUMB_SIZE = 14;

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Draggable progress bar. Renders the full "elapsed / track / duration" row and drives
// seeking by sliding. The fill and thumb are animated on the UI thread (Reanimated shared
// values), so dragging never round-trips through React render. We only call onSeek once, on
// release, which matches the engine (a fresh AudioBufferSourceNode starts at the new offset).
export function SeekBar({
  positionSec,
  durationSec,
  onSeek,
}: {
  positionSec: number;
  durationSec: number;
  onSeek: (seconds: number) => void;
}) {
  // Keep the latest onSeek without recreating the gesture each render.
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;
  const seek = (seconds: number) => onSeekRef.current(seconds);

  const accent = useCSSVariable('--color-accent');
  const accentColor = typeof accent === 'string' && accent.length > 0 ? accent : '#e879f9';

  const trackWidth = useSharedValue(0);
  const scrubbing = useSharedValue(false);
  const scrubFraction = useSharedValue(0);

  // Local label state, only set while the finger is down (cheap: one update per gesture frame,
  // not a continuous animation). Null means "show the live position from the engine".
  const [scrubSec, setScrubSec] = useState<number | null>(null);

  const progress = durationSec > 0 ? Math.min(Math.max(positionSec / durationSec, 0), 1) : 0;

  const updateFromX = (x: number) => {
    'worklet';
    const width = trackWidth.value;
    const fraction = width > 0 ? Math.min(Math.max(x / width, 0), 1) : 0;
    scrubFraction.value = fraction;
    runOnJS(setScrubSec)(fraction * durationSec);
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .enabled(durationSec > 0)
    .onBegin((e) => {
      scrubbing.value = true;
      updateFromX(e.x);
    })
    .onUpdate((e) => {
      updateFromX(e.x);
    })
    .onEnd(() => {
      const fraction = scrubFraction.value;
      scrubbing.value = false;
      runOnJS(seek)(fraction * durationSec);
      runOnJS(setScrubSec)(null);
    })
    .onFinalize(() => {
      scrubbing.value = false;
    });

  const fillStyle = useAnimatedStyle(() => {
    const fraction = scrubbing.value ? scrubFraction.value : progress;
    return { width: `${fraction * 100}%` };
  });

  const thumbStyle = useAnimatedStyle(() => {
    const fraction = scrubbing.value ? scrubFraction.value : progress;
    return { left: `${fraction * 100}%`, marginLeft: -THUMB_SIZE / 2 };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.value = e.nativeEvent.layout.width;
  };

  const elapsedSec = scrubSec ?? positionSec;

  return (
    <View className="mt-3 flex-row items-center gap-2">
      <Text className="w-10 text-xs text-muted">{formatTime(elapsedSec)}</Text>

      <GestureDetector gesture={pan}>
        {/* Tall, transparent hit area so the thin visual track is easy to grab. */}
        <View className="h-6 flex-1 justify-center" onLayout={onLayout}>
          <View className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
            <Animated.View
              style={[{ height: 4, borderRadius: 9999, backgroundColor: accentColor }, fillStyle]}
            />
          </View>
          <Animated.View
            style={[
              {
                position: 'absolute',
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
