import { makeMutable } from 'react-native-reanimated';

// The live playback position in seconds, published by the engine's position poll.
//
// This is deliberately NOT part of the Legend State store (player$): position ticks ~4x/second
// while playing, and routing it through React state re-renders every component that subscribes
// to it (NowPlaying, and through it the whole player surface). Instead the engine writes it to
// this Reanimated shared value, and the SeekBar / mini-bar consume it directly on the UI thread
// (see useSmoothPosition), so a position tick triggers ZERO React renders.
//
// The store still owns durationSec / canSeek, which change only at track boundaries. Anything on
// the JS thread that needs the current position non-reactively (e.g. engine.prev()) reads
// positionSignal.value.
export const positionSignal = makeMutable(0);
