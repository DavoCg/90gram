import { useEffect } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { audioEngine } from './engine';

// Reads the AnalyserNode on an animation-frame loop and writes normalized magnitudes
// into a Reanimated shared value. This stays OFF the JS render path: no setState per
// frame. The visualizer view reads the shared value on the UI thread. See the audio skill.
export function useVisualizer(barCount: number): SharedValue<number[]> {
  const bars = useSharedValue<number[]>(new Array<number>(barCount).fill(0));

  useEffect(() => {
    let frame: number | null = null;
    // fftSize 256 -> frequencyBinCount 128.
    const data = new Uint8Array(128);

    const loop = (): void => {
      const analyser = audioEngine.getAnalyser();
      if (analyser) {
        analyser.getByteFrequencyData(data);
        const next = new Array<number>(barCount);
        const step = Math.max(1, Math.floor(data.length / barCount));
        for (let i = 0; i < barCount; i += 1) {
          next[i] = (data[i * step] ?? 0) / 255;
        }
        bars.value = next;
      }
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [barCount, bars]);

  return bars;
}
