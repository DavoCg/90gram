import { create } from 'zustand';
import type { RecordDto } from '@getvinyls/api-client';

// The player store holds ONLY serializable UI state. The audio graph itself is
// imperative and lives in the engine module (refs), never here. See the audio skill.
export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused';

export interface PlayerState {
  record: RecordDto | null;
  status: PlayerStatus;
  positionSec: number;
  durationSec: number;
  gain: number;
}

// No actions on the store: the engine is the sole writer (usePlayerStore.setState).
// Components read narrow slices via selectors.
export const usePlayerStore = create<PlayerState>(() => ({
  record: null,
  status: 'idle',
  positionSec: 0,
  durationSec: 0,
  gain: 1,
}));
