import { useRef } from 'react';
import { Volume1, Volume2 } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';
import type { LayoutChangeEvent } from 'react-native';
import { View } from '../theme/uniwind';

// Horizontal volume (gain) slider, modeled on SeekBar (Apple Music style: thin track, no thumb,
// neutral fill). Everything that moves during a drag is driven by Reanimated shared values on the
// UI thread (transforms, never layout), so dragging triggers ZERO React renders. It is
// uncontrolled, the engine is the sole writer of gain, so we seed from the current value once and
// push changes out via onChange.
export function VolumeSlider({
  initialValue,
  onChange,
}: {
  initialValue: number;
  onChange: (value: number) => void;
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const emit = (value: number) => onChangeRef.current(value);

  // Accent fill for the active (filled) portion, on the dimmer surface-2 track.
  const accent = useCSSVariable('--color-accent');
  const accentColor = typeof accent === 'string' && accent.length > 0 ? accent : '#46a758';
  const muted = useCSSVariable('--color-muted');
  const mutedColor = typeof muted === 'string' && muted.length > 0 ? muted : '#9ca3af';

  const trackWidth = useSharedValue(0);
  const fraction = useSharedValue(Math.min(Math.max(initialValue, 0), 1));

  const updateFromX = (x: number) => {
    'worklet';
    const width = trackWidth.value;
    const next = width > 0 ? Math.min(Math.max(x / width, 0), 1) : 0;
    fraction.value = next;
    runOnJS(emit)(next);
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => updateFromX(e.x))
    .onUpdate((e) => updateFromX(e.x));

  const tap = Gesture.Tap()
    .maxDuration(400)
    .onEnd((e) => updateFromX(e.x));

  const gesture = Gesture.Race(pan, tap);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(fraction.value, 0) }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.value = e.nativeEvent.layout.width;
  };

  return (
    <View className="mt-3 flex-row items-center gap-3">
      <Volume1 color={mutedColor} size={18} />
      <GestureDetector gesture={gesture}>
        {/* Tall, transparent hit area so the thin visual track is easy to grab. */}
        <View className="h-6 flex-1 justify-center" onLayout={onLayout}>
          <View className="h-2 w-full overflow-hidden rounded-full curve-continuous bg-surface-2">
            <Animated.View
              style={[
                {
                  height: 8,
                  width: '100%',
                  borderRadius: 9999,
                  backgroundColor: accentColor,
                  transformOrigin: 'left',
                },
                fillStyle,
              ]}
            />
          </View>
        </View>
      </GestureDetector>
      <Volume2 color={mutedColor} size={18} />
    </View>
  );
}
