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
import { useSmoothPosition } from '../hooks/use-smooth-position';
import { View } from '../theme/uniwind';
import { Text } from './text';

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

function formatRemaining(seconds: number): string {
  'worklet';
  return `-${formatTime(seconds)}`;
}

// Draggable progress bar (Apple Music style: thin track, no thumb, time labels beneath).
// Everything that moves during a drag (the fill and the elapsed/remaining labels) is driven by
// Reanimated shared values on the UI thread, so dragging triggers ZERO React renders. The fill
// uses a transform (scaleX), never layout props, so the UI thread never re-runs layout per frame.
// We only call onSeek once, on release, which matches the engine (a fresh source starts at the
// new offset).
export function SeekBar({
  positionSec,
  durationSec,
  canSeek = true,
  isPlaying = false,
  showRemaining = false,
  onSeek,
}: {
  positionSec: number;
  durationSec: number;
  // False while streaming a non-seekable source: the bar becomes a read-only indicator.
  canSeek?: boolean;
  // Whether playback is advancing. Drives the frame-rate position extrapolation so the fill
  // glides between the engine's 250ms position polls instead of stepping.
  isPlaying?: boolean;
  // When true the right-hand label counts down the time remaining (e.g. "-2:27") and
  // tracks the scrub position, matching the full-screen player. Default shows total length.
  showRemaining?: boolean;
  onSeek: (seconds: number) => void;
}) {
  // Keep the latest onSeek without recreating the gesture each render.
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;
  const seek = (seconds: number) => onSeekRef.current(seconds);

  // Accent fill for the active (played) portion, on the dimmer surface-2 track.
  const accent = useCSSVariable('--color-accent');
  const accentColor = typeof accent === 'string' && accent.length > 0 ? accent : '#46a758';
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

  // The displayed position, extrapolated on the UI thread between the engine's 250ms polls so the
  // fill and labels glide at frame rate. `liveFraction` is position/duration clamped to 0..1.
  const { livePosition, fraction: liveFraction } = useSmoothPosition(
    positionSec,
    durationSec,
    isPlaying,
  );

  // Mirror duration into a shared value so the labels can scale a scrub fraction back to seconds
  // on the UI thread. Changes at most every position tick (~250ms), not per frame.
  const durationShared = useSharedValue(durationSec);
  useEffect(() => {
    durationShared.value = durationSec;
  }, [durationSec, durationShared]);

  // The committed seek target, held until the engine position reaches it. This is the only
  // React state here, and it updates once per release, never during the drag.
  const [pendingSec, setPendingSec] = useState<number | null>(null);

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

  // Single source of truth for the displayed fraction, evaluated on the UI thread. A live drag
  // wins, then the post-release hold, then the frame-rate extrapolated playback position.
  const fraction = useDerivedValue(() =>
    scrubbing.value ? scrubFraction.value : holding.value ? holdFraction.value : liveFraction.value,
  );

  // scaleX from the left edge (transformOrigin set statically below) instead of animating width.
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(fraction.value, 0) }],
  }));

  const elapsedProps = useAnimatedProps(() => {
    const seconds =
      scrubbing.value || holding.value ? fraction.value * durationShared.value : livePosition.value;
    // `text` is a valid TextInput native prop even though it is not in the public RN types.
    return { text: formatTime(seconds) } as object;
  });

  // Remaining time, computed on the UI thread so it tracks the scrub like the elapsed label.
  const remainingProps = useAnimatedProps(() => {
    const elapsed =
      scrubbing.value || holding.value ? fraction.value * durationShared.value : livePosition.value;
    return { text: formatRemaining(Math.max(0, durationShared.value - elapsed)) } as object;
  });

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.value = e.nativeEvent.layout.width;
  };

  return (
    <View className="mt-3">
      <GestureDetector gesture={gesture}>
        {/* Tall, transparent hit area so the thin visual track is easy to grab. No thumb. */}
        <View className="h-6 justify-center" onLayout={onLayout}>
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

      {/* Time labels beneath the track: elapsed left, remaining (or total) right. */}
      <View className="flex-row justify-between">
        <AnimatedTextInput
          editable={false}
          underlineColorAndroid="transparent"
          defaultValue={formatTime(positionSec)}
          animatedProps={elapsedProps}
          style={{
            width: 48,
            fontSize: 12,
            lineHeight: 16,
            padding: 0,
            color: mutedColor,
            includeFontPadding: false,
            fontVariant: ['tabular-nums'],
          }}
        />
        {/* Only show the animated remaining-time countdown once a duration is known; until then
            fall through to the static label below (which shows 0:00 while loading, "live" only
            when a non-seekable stream is actually playing). */}
        {showRemaining && durationSec > 0 ? (
          <AnimatedTextInput
            editable={false}
            underlineColorAndroid="transparent"
            defaultValue={formatRemaining(Math.max(0, durationSec - positionSec))}
            animatedProps={remainingProps}
            style={{
              width: 48,
              fontSize: 12,
              lineHeight: 16,
              padding: 0,
              textAlign: 'right',
              color: mutedColor,
              includeFontPadding: false,
              fontVariant: ['tabular-nums'],
            }}
          />
        ) : (
          <Text size="xs" color="neutral-soft" align="right" tabularNums className="w-12">
            {/* Duration unknown: only label it "live" when audio is genuinely playing a
                non-seekable stream. While the track is still loading (isPlaying false) show 0:00,
                so a track that has not started yet does not masquerade as a live stream. */}
            {durationSec > 0 ? formatTime(durationSec) : isPlaying ? 'live' : '0:00'}
          </Text>
        )}
      </View>
    </View>
  );
}
