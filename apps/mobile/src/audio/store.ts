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
  positionSec: number;
  durationSec: number;
  gain: number;
  // True when the active source supports seeking (the file source). The streamer
  // fallback streams but cannot seek, so the UI shows a read-only progress indicator.
  canSeek: boolean;
}

export const player$ = observable<PlayerState>({
  record: null,
  status: 'idle',
  positionSec: 0,
  durationSec: 0,
  gain: 1,
  canSeek: false,
});
