import { observable } from '@legendapp/state';
import type { RecordDto } from '@getvinyls/api-client';

// Client/UI state for the player, held in a Legend State observable (fine-grained
// reactivity). Server/data state stays in TanStack Query. This holds ONLY serializable
// UI state; the audio graph is imperative and lives in the engine module (refs).
//
// The engine is the sole writer (player$.x.set(...) / player$.assign(...)). Components
// read narrow slices with use$(player$.x) so only the bits they use trigger re-render.
export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused';

export interface PlayerState {
  record: RecordDto | null;
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
  // The play queue and the index of the currently-playing item within it. `record` always
  // mirrors `queue[queueIndex]`. The queue is the list the user tapped into (e.g. the Home
  // list), so the transport prev/next buttons skip whole tracks. queueIndex is -1 when idle.
  queue: RecordDto[];
  queueIndex: number;
}

export const player$ = observable<PlayerState>({
  record: null,
  status: 'idle',
  playWhenReady: false,
  positionSec: 0,
  durationSec: 0,
  gain: 1,
  canSeek: false,
  queue: [],
  queueIndex: -1,
});
