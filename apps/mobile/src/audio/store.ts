import { observable } from '@legendapp/state';

// Client/UI state for the player, held in a Legend State observable (fine-grained
// reactivity). Server/data state stays in TanStack Query. This holds ONLY serializable
// UI state; the audio graph is imperative and lives in the engine module (refs).
//
// The engine is the sole writer (player$.x.set(...) / player$.assign(...)). Components
// read narrow slices with use$(player$.x) so only the bits they use trigger re-render.
export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused';

// The minimal, self-contained shape the player needs to play and display one track. Built
// from a vinyl's tracks (see engine.playVinyl): track title/preview, the parent vinyl's
// artist/cover for display, and `vinylId` so a list row can tell whether its vinyl is current.
export interface PlayableTrack {
  id: string;
  url: string;
  title: string;
  artist: string;
  artwork?: string;
  vinylId: string;
  // The track's known length in seconds (from the catalog metadata, durationSeconds), or 0 when
  // unknown. Used to seed `durationSec` so the SeekBar shows the real total at its right edge while
  // the source is still loading, instead of "0:00". RNTP's measured duration replaces it once known.
  durationSec: number;
}

export interface PlayerState {
  track: PlayableTrack | null;
  status: PlayerStatus;
  // The user's play/pause INTENT, mirrored from RNTP's `playWhenReady`. This is what the
  // transport button reads: it stays true across a track switch (setQueue resets the native
  // `status` through Ready/None/Buffering, but intent does not change), so the button does not
  // flash to the play icon while the new track buffers. `status` still reflects raw playback.
  playWhenReady: boolean;
  positionSec: number;
  durationSec: number;
  gain: number;
  // True when the active source supports seeking (the file source). The streamer
  // fallback streams but cannot seek, so the UI shows a read-only progress indicator.
  canSeek: boolean;
  // The play queue and the index of the currently-playing item within it. `track` always
  // mirrors `queue[queueIndex]`. The queue is the tapped vinyl's tracklist, so the transport
  // prev/next buttons walk the album. queueIndex is -1 when idle.
  queue: PlayableTrack[];
  queueIndex: number;
}

export const player$ = observable<PlayerState>({
  track: null,
  status: 'idle',
  playWhenReady: false,
  positionSec: 0,
  durationSec: 0,
  gain: 1,
  canSeek: false,
  queue: [],
  queueIndex: -1,
});
