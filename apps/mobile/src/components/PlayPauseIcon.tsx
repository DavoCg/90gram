import { useEffect } from 'react';
import Animated, {
  ReduceMotion,
  useAnimatedProps,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Snappy spring for the play/pause morph: stiff and light so the glyph pinches quickly without
// sloppy overshoot. Mirrors the cover's SCALE_SPRING feel in NowPlaying so the button and the
// artwork move together on a play/pause toggle.
const MORPH_SPRING = { damping: 18, stiffness: 380, mass: 0.5 } as const;

// Both glyphs are expressed as two 4-point quads on lucide's 24x24 canvas, so the morph
// interpolates point-for-point AND the resting shapes match the lucide Play / Pause icons used
// everywhere else in the transport. Tuples (not arrays) keep element access typed under
// noUncheckedIndexedAccess.
type P = readonly [number, number];
type Quad = readonly [P, P, P, P];

// Play = lucide's right-pointing triangle (6 3 -> 20 12 -> 6 21), split down the middle at x=13
// into two quads; the right quad doubles the apex (20,12) so that half pinches to the tip.
const PLAY_L: Quad = [
  [6, 3],
  [13, 7.5],
  [13, 16.5],
  [6, 21],
];
const PLAY_R: Quad = [
  [13, 7.5],
  [20, 12],
  [20, 12],
  [13, 16.5],
];
// Pause = lucide's two bars (x 5..10 and 14..19, y 3..21), each a quad that lines up point-for-point
// with a play quad. The 1px corner radius is dropped so the morph stays a clean vertex tween; at the
// rendered sizes the filled bars read identically to the lucide glyph.
const PAUSE_L: Quad = [
  [5, 3],
  [10, 3],
  [10, 21],
  [5, 21],
];
const PAUSE_R: Quad = [
  [14, 3],
  [19, 3],
  [19, 21],
  [14, 21],
];

function subpath(a: Quad, b: Quad, t: number): string {
  'worklet';
  const at = (i: 0 | 1 | 2 | 3): P => [
    a[i][0] + (b[i][0] - a[i][0]) * t,
    a[i][1] + (b[i][1] - a[i][1]) * t,
  ];
  const [x0, y0] = at(0);
  const [x1, y1] = at(1);
  const [x2, y2] = at(2);
  const [x3, y3] = at(3);
  return `M${x0} ${y0}L${x1} ${y1}L${x2} ${y2}L${x3} ${y3}Z`;
}

// A single filled SVG glyph that springs between the play triangle and the pause bars. Driven by
// the user's play/pause INTENT (playWhenReady), like the rest of the transport, so it never flashes
// mid track-swap. Everything animates on the UI thread via useAnimatedProps (no per-frame render).
export function PlayPauseIcon({
  playing,
  size = 44,
  color,
}: {
  playing: boolean;
  size?: number;
  color: string;
}) {
  // 0 = play, 1 = pause. ReduceMotion.Never keeps the spring even with the OS setting on, otherwise
  // it would jump straight to the end.
  const progress = useSharedValue(playing ? 1 : 0);
  useEffect(() => {
    progress.value = withSpring(playing ? 1 : 0, {
      ...MORPH_SPRING,
      reduceMotion: ReduceMotion.Never,
    });
  }, [playing, progress]);

  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    return { d: subpath(PLAY_L, PAUSE_L, t) + subpath(PLAY_R, PAUSE_R, t) };
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <AnimatedPath animatedProps={animatedProps} fill={color} />
    </Svg>
  );
}
