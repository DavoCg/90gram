// The audio engine: the single module that owns playback. Built on react-native-track-player
// (RNTP), which is a real jukebox: it owns a NATIVE queue, background playback, full-track
// streaming with seeking, and the OS remote controls. So this module no longer builds a Web
// Audio graph, decodes buffers, or tracks position by hand (all of which the old
// react-native-audio-api build had to do).
//
// The UI still reads a Legend State store (`player$`); RNTP is the native source of truth and
// this engine MIRRORS its state into `player$` through event listeners, so NowPlaying / the
// Home list keep reading the same observable slices they always have. The engine is the sole
// writer of `player$`.
//
// The OS remote-control buttons (lock screen, Control Center, headset, Android Auto) are wired
// in the headless playback service (./service.ts), which is registered at the JS entry. The
// listeners here run in the foreground and exist only to reflect native state into `player$`.
//
// Version note (5.0.0-alpha0): pre-release of the New Architecture rewrite. Keep this wrapper
// as the ONLY place that talks to TrackPlayer so a version bump (or a move to the licensed v5
// build) stays a one-file change.
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  IOSCategory,
  PitchAlgorithm,
  State,
  type Track,
} from 'react-native-track-player';
import type { VinylSummaryDto } from '@getvinyls/api-client';
import { player$, type PlayableTrack, type PlayerStatus } from './store';

// How far the lock-screen / notification jump buttons move, and how often we poll position.
const JUMP_INTERVAL_SEC = 15;
const POSITION_TICK_MS = 250;
// Apple-Music "previous" semantics: past this many seconds, previous restarts the track.
const PREV_RESTART_THRESHOLD_SEC = 3;

// Build the playable tracklist for a vinyl: its tracks that have a non-null preview URL,
// each carrying the vinyl's artist/cover for display and `vinylId` so a row can match.
function toPlayableTracks(vinyl: VinylSummaryDto): PlayableTrack[] {
  const tracks: PlayableTrack[] = [];
  for (const track of vinyl.tracks) {
    if (track.previewUrl === null) continue;
    tracks.push({
      id: track.id,
      url: track.previewUrl,
      title: track.title,
      artist: vinyl.artist,
      artwork: vinyl.coverArtUrl ?? undefined,
      vinylId: vinyl.id,
    });
  }
  return tracks;
}

// Map a PlayableTrack onto an RNTP Track. We stash the track id in `mediaId` (a typed field)
// so the native layer and any future external controller can identify the item; the UI matches
// by queue index, which stays aligned because `player$.queue` is this same list.
function toTrack(track: PlayableTrack): Track {
  return {
    url: track.url,
    title: track.title,
    artist: track.artist,
    artwork: track.artwork,
    duration: undefined,
    mediaId: track.id,
    // iOS time-pitch algorithm tuned for music (keeps any future rate change musical).
    pitchAlgorithm: PitchAlgorithm.Music,
  };
}

// Translate RNTP's playback State into the four-value status the UI understands.
function mapState(state: State): PlayerStatus {
  switch (state) {
    case State.Playing:
      return 'playing';
    case State.Loading:
    case State.Buffering:
      return 'loading';
    case State.None:
    case State.Error:
      return 'idle';
    default:
      // Ready, Paused, Stopped, Ended.
      return 'paused';
  }
}

type Subscription = ReturnType<typeof TrackPlayer.addEventListener>;

const subscriptions: Subscription[] = [];
let listenersRegistered = false;
let positionTimer: ReturnType<typeof setInterval> | null = null;

// When we build a queue and skip into it, RNTP emits a burst of transient
// PlaybackActiveTrackChanged events before settling: setQueue first resets the active track
// (an `index: undefined` change, which would null `record` and make the player vanish), passes
// through index 0 (which would flash the queue's first track), and only then does the skip land
// on the tapped track. Mirroring any of those would flash the UI. We record the id of the track
// we actually asked for and ignore every change until that track becomes active.
let pendingStartId: string | null = null;

// setupPlayer must run exactly once before any other call. Memoize the promise so the mount
// effect and the first playQueue share one initialization.
let setupPromise: Promise<void> | null = null;

async function doSetup(): Promise<void> {
  try {
    await TrackPlayer.setupPlayer({
      // Let RNTP pause/resume around calls and other apps natively (replaces the manual
      // interruption handling the old engine needed).
      autoHandleInterruptions: true,
      iosCategory: IOSCategory.Playback,
    });
  } catch {
    // setupPlayer throws if the native player is already initialized, which happens after a JS
    // hot reload (native state outlives the JS bundle). Safe to fall through to updateOptions.
  }

  await TrackPlayer.updateOptions({
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.Stop,
      Capability.SeekTo,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.JumpForward,
      Capability.JumpBackward,
    ],
    // The subset shown in the compact Android notification.
    notificationCapabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.SeekTo,
    ],
    forwardJumpInterval: JUMP_INTERVAL_SEC,
    backwardJumpInterval: JUMP_INTERVAL_SEC,
    android: {
      // Keep playing when the app is swiped out of recents.
      appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
    },
  });
}

function ensureSetup(): Promise<void> {
  if (!setupPromise) {
    setupPromise = doSetup();
  }
  return setupPromise;
}

// Poll the native progress while playing and publish it to the store. RNTP also emits a
// progress event, but a fixed tick keeps the SeekBar as smooth as the old engine's 250ms timer.
function startPositionTimer(): void {
  stopPositionTimer();
  positionTimer = setInterval(() => {
    void TrackPlayer.getProgress().then((progress) => {
      player$.assign({
        positionSec: progress.position,
        durationSec: progress.duration,
        canSeek: progress.duration > 0,
      });
    });
  }, POSITION_TICK_MS);
}

function stopPositionTimer(): void {
  if (positionTimer) {
    clearInterval(positionTimer);
    positionTimer = null;
  }
}

// Reflect a track change (whether driven by us, the queue auto-advancing, or a remote
// next/previous) into the store. `player$.queue` is the same playable list we set, so the RNTP
// index maps straight onto it.
function onActiveTrackChanged(index: number | undefined, track: Track | undefined): void {
  // While a programmatic queue swap is in flight, ignore the transient changes (undefined index,
  // index 0, ...) until the track we asked for is active, so the player neither vanishes nor
  // flashes the wrong track. Match by id, not index, since the burst passes through both.
  if (pendingStartId !== null) {
    if (track?.mediaId !== pendingStartId) return;
    pendingStartId = null;
  }
  if (index === undefined) {
    player$.assign({ track: null, queueIndex: -1, positionSec: 0, durationSec: 0, canSeek: false });
    return;
  }
  const queue = player$.queue.get();
  const current = queue[index] ?? player$.track.get();
  const duration = track?.duration ?? 0;
  player$.assign({
    queueIndex: index,
    track: current,
    positionSec: 0,
    durationSec: duration,
    canSeek: duration > 0,
  });
}

export const audioEngine = {
  /**
   * Initialize the native player + remote controls and start mirroring native state into the
   * store. Idempotent; the root layout calls it on mount.
   */
  setupSession(): void {
    void ensureSetup();
    if (listenersRegistered) return;
    listenersRegistered = true;

    subscriptions.push(
      TrackPlayer.addEventListener(Event.PlaybackState, ({ state }) => {
        // Mirror raw playback state. The transport button reads `playWhenReady` (intent), not this,
        // so the transient paused/idle a queue swap passes through never flashes the play icon.
        player$.status.set(mapState(state));
        if (state === State.Playing) {
          startPositionTimer();
        } else {
          stopPositionTimer();
        }
      }),
      // Mirror the user's play/pause INTENT. This is what the transport button reads, and it
      // does not dip during a track switch the way raw playback state does. Ignore a transient
      // `false` while a swap is in flight: we asked to play the new track, so keep intent true.
      TrackPlayer.addEventListener(Event.PlaybackPlayWhenReadyChanged, ({ playWhenReady }) => {
        if (pendingStartId !== null && !playWhenReady) return;
        player$.playWhenReady.set(playWhenReady);
      }),
      TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
        onActiveTrackChanged(event.index, event.track);
      }),
      TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
        stopPositionTimer();
        player$.assign({ status: 'paused', playWhenReady: false, positionSec: 0 });
      }),
    );
  },

  /**
   * Play a vinyl's tracklist as the queue, starting at `startIndex`. The queue is the album, so
   * prev()/next() and the lock-screen transport walk its tracks. Tracks without a preview URL are
   * dropped. A vinyl with no playable track leaves current playback untouched.
   */
  async playVinyl(vinyl: VinylSummaryDto, startIndex = 0): Promise<void> {
    const tracks = toPlayableTracks(vinyl);
    if (tracks.length === 0) return;
    const start = Math.min(Math.max(startIndex, 0), tracks.length - 1);
    await this.playQueue(tracks, start);
  },

  /**
   * Play a vinyl's tracklist in a random order. Builds the same playable list as playVinyl
   * (tracks with a preview URL), shuffles it, and plays from the top, so prev()/next() and the
   * lock-screen transport walk the shuffled order. A vinyl with no playable track is a no-op.
   */
  async shuffleVinyl(vinyl: VinylSummaryDto): Promise<void> {
    const tracks = toPlayableTracks(vinyl);
    if (tracks.length === 0) return;
    // Fisher-Yates shuffle in place. The local consts satisfy noUncheckedIndexedAccess.
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const a = tracks[i];
      const b = tracks[j];
      if (a && b) {
        tracks[i] = b;
        tracks[j] = a;
      }
    }
    await this.playQueue(tracks, 0);
  },

  /**
   * Play a prepared queue of tracks starting at `index`. prev()/next() and the lock-screen
   * transport walk it; `player$.queue` is set to this same list so indices stay aligned.
   */
  async playQueue(tracks: PlayableTrack[], index: number): Promise<void> {
    const startTrack = tracks[index];
    if (!startTrack) return;

    // Optimistic UI: show the tapped track as loading, and set intent to play so the transport
    // button shows pause immediately (and stays there) instead of flashing the play icon.
    player$.assign({
      track: startTrack,
      queue: tracks,
      queueIndex: index,
      status: 'loading',
      playWhenReady: true,
      positionSec: 0,
      durationSec: 0,
      canSeek: false,
    });

    await ensureSetup();
    // Mark the track we are switching to so the transient track-changed burst setQueue/skip emit
    // is ignored until this track is active (see onActiveTrackChanged). setQueue resets the active
    // track even when index is 0, so this guard is needed regardless of the target index.
    pendingStartId = startTrack.id;
    await TrackPlayer.setQueue(tracks.map(toTrack));
    if (index > 0) {
      await TrackPlayer.skip(index);
    }
    await TrackPlayer.play();
  },

  /** Skip to the next queued track. No-op at the end of the queue. */
  next(): void {
    const queue = player$.queue.get();
    const index = player$.queueIndex.get();
    if (index >= 0 && index < queue.length - 1) {
      void TrackPlayer.skipToNext();
    }
  },

  /**
   * Apple-Music semantics: restart the current track when past the first few seconds (or it is
   * the first track), otherwise jump to the previous queued track.
   */
  prev(): void {
    const index = player$.queueIndex.get();
    if (index <= 0 || player$.positionSec.get() > PREV_RESTART_THRESHOLD_SEC) {
      this.seek(0);
      return;
    }
    void TrackPlayer.skipToPrevious();
  },

  /** Toggle play/pause for the active track. Keys off intent (what the button shows). */
  toggle(): void {
    if (player$.playWhenReady.get()) {
      this.pause();
    } else {
      this.resume();
    }
  },

  pause(): void {
    // Reflect intent immediately so the button flips without waiting on the native event.
    player$.playWhenReady.set(false);
    void TrackPlayer.pause();
  },

  resume(): void {
    player$.playWhenReady.set(true);
    void TrackPlayer.play();
  },

  /** Seek to an absolute position in seconds within the active track. */
  seek(toSec: number): void {
    const clamped = Math.max(0, toSec);
    // Reflect the new position immediately so the bar does not flash the old timestamp.
    player$.positionSec.set(clamped);
    void TrackPlayer.seekTo(clamped);
  },

  /** Set output volume / gain (0..1). */
  setGain(value: number): void {
    const clamped = Math.max(0, Math.min(value, 1));
    player$.gain.set(clamped);
    void TrackPlayer.setVolume(clamped);
  },

  /** Remove our listeners and clear the player. Called on root unmount. */
  async teardown(): Promise<void> {
    stopPositionTimer();
    for (const sub of subscriptions) {
      sub.remove();
    }
    subscriptions.length = 0;
    listenersRegistered = false;
    setupPromise = null;
    pendingStartId = null;
    await TrackPlayer.reset();
    player$.assign({
      track: null,
      status: 'idle',
      playWhenReady: false,
      positionSec: 0,
      durationSec: 0,
      canSeek: false,
      queue: [],
      queueIndex: -1,
    });
  },
};
