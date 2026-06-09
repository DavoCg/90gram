import { useEffect } from 'react';
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

// Extrapolate playback position on the UI thread between the engine's polls. The engine only
// publishes a fresh position every POSITION_TICK_MS (~250ms), so any fill driven straight off
// `positionSec` snaps forward in coarse steps (~4fps) instead of gliding. While playing, position
// advances at wall-clock rate (1s per second), so we predict it every frame from the last polled
// value and re-anchor on each poll, which keeps the motion drift-free (the poll is the source of
// truth; the prediction only fills the gaps). When paused, the bar holds the last reported value.
//
// Everything moves on the UI thread (shared values only), so smoothing a fill triggers ZERO React
// renders per frame, matching the SeekBar discipline.
export function useSmoothPosition(
  positionSec: number,
  durationSec: number,
  isPlaying: boolean,
): { livePosition: SharedValue<number>; fraction: SharedValue<number> } {
  // The reference point for prediction: the last polled position and the frame clock origin we
  // measure elapsed time from. `anchorFrame` is reset to -1 to re-pin the clock on the next frame.
  const anchorPos = useSharedValue(positionSec);
  const anchorFrame = useSharedValue(-1);
  const duration = useSharedValue(durationSec);
  const livePosition = useSharedValue(positionSec);

  // Re-anchor on every polled position. Pinning anchorFrame to -1 makes the frame callback reset
  // its clock origin on the next frame, so prediction always extrapolates from the freshest value.
  useEffect(() => {
    anchorPos.value = positionSec;
    anchorFrame.value = -1;
    livePosition.value = positionSec;
  }, [positionSec, anchorPos, anchorFrame, livePosition]);

  useEffect(() => {
    duration.value = durationSec;
  }, [durationSec, duration]);

  const frame = useFrameCallback((info) => {
    'worklet';
    if (anchorFrame.value < 0) {
      // First frame after an anchor reset: pin the clock origin and hold this frame's value.
      anchorFrame.value = info.timeSinceFirstFrame;
      livePosition.value = anchorPos.value;
      return;
    }
    const elapsed = (info.timeSinceFirstFrame - anchorFrame.value) / 1000;
    const predicted = anchorPos.value + elapsed;
    livePosition.value = duration.value > 0 ? Math.min(predicted, duration.value) : predicted;
  }, false);

  // Only run the per-frame extrapolation while playing; when paused the bar holds the last reported
  // position (set by the anchor effect), so we burn no frames idle.
  useEffect(() => {
    frame.setActive(isPlaying);
  }, [isPlaying, frame]);

  const fraction = useDerivedValue(() => {
    const d = duration.value;
    return d > 0 ? Math.min(Math.max(livePosition.value / d, 0), 1) : 0;
  });

  return { livePosition, fraction };
}
