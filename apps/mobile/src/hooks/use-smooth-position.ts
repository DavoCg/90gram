import { useEffect } from 'react';
import {
  useAnimatedReaction,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

// Extrapolate playback position on the UI thread between the engine's polls. The engine only
// publishes a fresh position every POSITION_TICK_MS (~250ms) into `positionSignal`, so any fill
// driven straight off that value snaps forward in coarse steps (~4fps) instead of gliding. While
// playing, position advances at wall-clock rate (1s per second), so we predict it every frame from
// the last polled value and re-anchor on each poll, which keeps the motion drift-free (the poll is
// the source of truth; the prediction only fills the gaps). When paused, the bar holds the last
// reported value.
//
// `position` is a Reanimated shared value (the engine's positionSignal), NOT React state: re-anchor
// runs in a UI-thread reaction, so a position tick triggers ZERO React renders, not even of this
// hook's owner. Everything else (the frame predictor, the derived fraction) is UI-thread too.
export function useSmoothPosition(
  position: SharedValue<number>,
  durationSec: number,
  isPlaying: boolean,
): { livePosition: SharedValue<number>; fraction: SharedValue<number> } {
  // The reference point for prediction: the last polled position and the frame clock origin we
  // measure elapsed time from. `anchorFrame` is reset to -1 to re-pin the clock on the next frame.
  // Seeded to 0, not position.value, to avoid reading a shared value during render. The reaction
  // below runs on mount and re-anchors to the real position immediately.
  const anchorPos = useSharedValue(0);
  const anchorFrame = useSharedValue(-1);
  const duration = useSharedValue(durationSec);
  const livePosition = useSharedValue(0);

  // Re-anchor on every polled position, on the UI thread. Pinning anchorFrame to -1 makes the
  // frame callback reset its clock origin on the next frame, so prediction always extrapolates
  // from the freshest value.
  useAnimatedReaction(
    () => position.value,
    (pos) => {
      anchorPos.value = pos;
      anchorFrame.value = -1;
      livePosition.value = pos;
    },
  );

  useEffect(() => {
    duration.value = durationSec;
  }, [durationSec, duration]);

  const frame = useFrameCallback((info) => {
    'worklet';
    if (anchorFrame.value < 0) {
      // First frame after an anchor reset: pin the clock origin and anchor to wherever the bar
      // currently sits. Anchoring FROM livePosition (not snapping livePosition to anchorPos) means
      // resuming after a pause continues from the displayed position instead of stepping back to
      // the last poll, which sits a few pixels behind the predicted value the bar froze at.
      anchorFrame.value = info.timeSinceFirstFrame;
      anchorPos.value = livePosition.value;
      return;
    }
    const elapsed = (info.timeSinceFirstFrame - anchorFrame.value) / 1000;
    const predicted = anchorPos.value + elapsed;
    livePosition.value = duration.value > 0 ? Math.min(predicted, duration.value) : predicted;
  }, false);

  // Run the per-frame extrapolation only while playing; when paused the bar holds its last value,
  // so we burn no frames idle. Re-pin the clock on (re)activation (anchorFrame = -1) so the
  // predictor does not count paused wall-clock as elapsed and continues from the frozen position.
  useEffect(() => {
    if (isPlaying) anchorFrame.value = -1;
    frame.setActive(isPlaying);
  }, [isPlaying, frame, anchorFrame]);

  const fraction = useDerivedValue(() => {
    const d = duration.value;
    return d > 0 ? Math.min(Math.max(livePosition.value / d, 0), 1) : 0;
  });

  return { livePosition, fraction };
}
