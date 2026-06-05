// The audio engine: a single imperative module that owns the whole audio graph.
// Built on react-native-audio-api (Web Audio model). There is no jukebox here; we
// build playback ourselves. See the audio skill for the rules this follows.
//
// Graph (created once): source -> gain -> analyser -> destination. The analyser sits
// AFTER gain so the visualizer reacts to the actual output level. The active source is
// recreated on every play and ALWAYS connected into gain (never straight to destination,
// or the visualizer goes silent).
//
// Two playback modes, chosen per track:
//   - STREAM (fast start): `ctx.createStreamer(url)` plays a remote URL progressively, so
//     sound starts before the file is downloaded. Per the library maintainers, remote
//     streams CANNOT seek (issue #895), so the seek bar is a read-only indicator
//     (player$.canSeek = false) and there is no duration. Pause/resume freezes and
//     resumes the whole context (ctx.suspend / ctx.resume) so position is kept.
//   - BUFFER (fallback): fetch -> decodeAudioData -> a fresh AudioBufferSourceNode per
//     play. Downloads fully before sound, but supports seeking. Used when streaming is
//     disabled, the URL is local, or createStreamer is unavailable.
//
// Streaming requires the FFmpeg-enabled native build (the default for this package, wired
// by the `react-native-audio-api` Expo plugin). On a build WITHOUT FFmpeg, createStreamer
// throws and we fall back to the buffer mode. Set STREAMING_ENABLED = false to force buffer.
//
// Note on the installed library version (0.12.2): the AudioContext constructor does not
// accept `initSuspended`, so we create the context lazily and resume() it on the first
// user gesture. Lock-screen / now-playing is handled by PlaybackNotificationManager.
import {
  AudioContext,
  AudioManager,
  PlaybackNotificationManager,
  type AnalyserNode,
  type AudioBuffer,
  type AudioBufferSourceNode,
  type AudioEventSubscription,
  type GainNode,
} from 'react-native-audio-api';
import type { RecordDto } from '@getvinyls/api-client';
import { player$ } from './store';

const FFT_SIZE = 256;
const SMOOTHING = 0.8;
const POSITION_TICK_MS = 250;

// Master switch for progressive streaming. DEFAULT OFF: react-native-audio-api 0.12.2's
// native StreamerNode throws on the CoreAudio render thread (AURemoteIO::IOThread ->
// std::terminate -> abort), which hard-crashes the app. A JS try/catch cannot catch a
// crash on the audio render thread. Until that is fixed upstream, we stay on the buffer
// path. Flip to true only to test the streamer on a build where the bug is resolved.
const STREAMING_ENABLED = false;

// The StreamerNode type, derived from the factory so we do not import the class as a value.
type StreamerNode = ReturnType<AudioContext['createStreamer']>;

type PlaybackMode = 'stream' | 'buffer';

function isRemote(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

let context: AudioContext | null = null;
let gainNode: GainNode | null = null;
let analyserNode: AnalyserNode | null = null;

// Exactly one of these is set while playing.
let streamerNode: StreamerNode | null = null;
let bufferSource: AudioBufferSourceNode | null = null;
let mode: PlaybackMode | null = null;

// Buffer-mode state (cached so replaying the same record does not re-download).
let decodedBuffer: AudioBuffer | null = null;
let loadedRecordId: string | null = null;

let currentRecord: RecordDto | null = null;

// Position bookkeeping (both modes estimate from the context clock; the streamer cannot
// seek, so its offset is always 0).
let startOffsetSec = 0;
let startedAtCtxTime = 0;
let positionTimer: ReturnType<typeof setInterval> | null = null;

// Bumped on every playRecord call so a slow decode cannot start playback after the user
// has already switched to a newer track.
let playGeneration = 0;

const subscriptions: AudioEventSubscription[] = [];
let sessionConfigured = false;

function ensureGraph(): {
  ctx: AudioContext;
  gain: GainNode;
  analyser: AnalyserNode;
} {
  if (!context) {
    context = new AudioContext();
  }
  if (!gainNode) {
    gainNode = context.createGain();
    gainNode.gain.value = player$.gain.get();
  }
  if (!analyserNode) {
    analyserNode = context.createAnalyser();
    analyserNode.fftSize = FFT_SIZE;
    analyserNode.smoothingTimeConstant = SMOOTHING;
    gainNode.connect(analyserNode);
    analyserNode.connect(context.destination);
  }
  return { ctx: context, gain: gainNode, analyser: analyserNode };
}

async function resumeContext(): Promise<void> {
  const { ctx } = ensureGraph();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}

function currentPositionSec(): number {
  if (!context || player$.status.get() !== 'playing') {
    return startOffsetSec;
  }
  return startOffsetSec + (context.currentTime - startedAtCtxTime);
}

function startPositionTimer(): void {
  stopPositionTimer();
  positionTimer = setInterval(() => {
    const durationSec = player$.durationSec.get();
    const raw = currentPositionSec();
    const pos = durationSec > 0 ? Math.min(raw, durationSec) : raw;
    player$.positionSec.set(pos);
    void updateNotification('playing', pos);
  }, POSITION_TICK_MS);
}

function stopPositionTimer(): void {
  if (positionTimer) {
    clearInterval(positionTimer);
    positionTimer = null;
  }
}

function teardownSource(): void {
  if (streamerNode) {
    streamerNode.onEnded = null;
    try {
      streamerNode.stop(0);
    } catch {
      // May not have been started or already stopped; safe to ignore.
    }
    try {
      streamerNode.disconnect();
    } catch {
      // Already detached.
    }
    streamerNode = null;
  }
  if (bufferSource) {
    bufferSource.onEnded = null;
    try {
      bufferSource.stop();
    } catch {
      // Same as above.
    }
    try {
      bufferSource.disconnect();
    } catch {
      // Already detached.
    }
    bufferSource = null;
  }
  mode = null;
}

// Fast-start streaming. createStreamer throws on a build without FFmpeg; we normalize that
// to "false" so the caller falls back to the buffer mode.
function startStreamer(url: string): boolean {
  const { ctx } = ensureGraph();
  let streamer: StreamerNode;
  try {
    streamer = ctx.createStreamer(url);
    // Mitigation: connect the streamer straight to destination rather than through
    // gain -> analyser. Keeping the streamer out of the analyser's render path reduces
    // the chance of contributing to the native StreamerNode render-thread crash. The
    // tradeoff is the visualizer does not react to streamed audio.
    streamer.connect(ctx.destination);
    streamer.onEnded = () => {
      handleEnded();
    };
    startOffsetSec = 0;
    startedAtCtxTime = ctx.currentTime;
    streamer.start(ctx.currentTime);
  } catch {
    teardownSource();
    return false;
  }
  streamerNode = streamer;
  bufferSource = null;
  mode = 'stream';
  // Duration is unknown for a live stream; the bar shows elapsed time only.
  player$.assign({ status: 'playing', canSeek: false, durationSec: 0 });
  void updateNotification('playing', 0);
  startPositionTimer();
  return true;
}

// Buffer playback from an offset (seekable).
function startBufferFromOffset(offsetSec: number): void {
  const { ctx, gain } = ensureGraph();
  if (!decodedBuffer) return;
  teardownSource();
  const src = ctx.createBufferSource({ pitchCorrection: true });
  src.buffer = decodedBuffer;
  src.connect(gain);
  src.onEnded = () => {
    handleEnded();
  };
  startOffsetSec = offsetSec;
  startedAtCtxTime = ctx.currentTime;
  src.start(0, offsetSec);
  bufferSource = src;
  mode = 'buffer';
  player$.assign({ status: 'playing', canSeek: true, durationSec: decodedBuffer.duration });
  void updateNotification('playing', offsetSec);
  startPositionTimer();
}

async function decode(record: RecordDto): Promise<boolean> {
  if (!record.previewUrl) return false;
  const { ctx } = ensureGraph();
  const response = await fetch(record.previewUrl);
  const arrayBuffer = await response.arrayBuffer();
  decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
  loadedRecordId = record.id;
  return true;
}

// Start a record from an offset, preferring the streamer. Streaming ignores the offset, so
// it is only used when starting from the beginning. Returns true if playback started.
async function startRecord(record: RecordDto, offsetSec: number, generation: number): Promise<boolean> {
  if (!record.previewUrl) return false;

  if (STREAMING_ENABLED && offsetSec === 0 && isRemote(record.previewUrl)) {
    if (startStreamer(record.previewUrl)) return true;
  }

  try {
    if (loadedRecordId !== record.id || !decodedBuffer) {
      const ok = await decode(record);
      if (!ok) return false;
    }
  } catch {
    return false;
  }
  // A newer playRecord superseded this one while decoding; let it win.
  if (generation !== playGeneration) return false;
  startBufferFromOffset(offsetSec);
  return true;
}

function handleEnded(): void {
  // Natural end of the clip. Tear the source down, then auto-advance to the next queued
  // track if there is one; otherwise reset to the start and mark paused.
  stopPositionTimer();
  teardownSource();
  startOffsetSec = 0;
  const queue = player$.queue.get();
  const index = player$.queueIndex.get();
  if (index >= 0 && index < queue.length - 1) {
    void audioEngine.playQueue(queue, index + 1);
    return;
  }
  player$.assign({ status: 'paused', positionSec: 0 });
  void updateNotification('paused', 0);
}

async function updateNotification(state: 'playing' | 'paused', elapsedSec: number): Promise<void> {
  const record = player$.record.get();
  if (!record) return;
  try {
    await PlaybackNotificationManager.show({
      title: record.title,
      artist: record.artist,
      artwork: record.coverArtUrl ? { uri: record.coverArtUrl } : undefined,
      duration: player$.durationSec.get(),
      elapsedTime: elapsedSec,
      speed: 1,
      state,
    });
  } catch {
    // Notifications are best-effort (e.g. permissions not granted); never crash playback.
  }
}

export const audioEngine = {
  /** Configure the audio session and register lock-screen + interruption handlers once. */
  setupSession(): void {
    if (sessionConfigured) return;
    sessionConfigured = true;

    AudioManager.setAudioSessionOptions({ iosCategory: 'playback', iosMode: 'default' });
    void AudioManager.setAudioSessionActivity(true);
    AudioManager.observeAudioInterruptions(true);

    // Pause on interruption (calls, other apps); resume when the system allows.
    subscriptions.push(
      AudioManager.addSystemEventListener('interruption', (event) => {
        if (event.type === 'began') {
          void audioEngine.pause();
        } else if (event.type === 'ended' && event.shouldResume) {
          void audioEngine.resume();
        }
      }),
    );

    // Lock-screen / now-playing controls.
    PlaybackNotificationManager.enableControl('play', true);
    PlaybackNotificationManager.enableControl('pause', true);
    PlaybackNotificationManager.enableControl('seekTo', true);

    const playSub = PlaybackNotificationManager.addEventListener('playbackNotificationPlay', () => {
      void audioEngine.resume();
    });
    const pauseSub = PlaybackNotificationManager.addEventListener(
      'playbackNotificationPause',
      () => {
        void audioEngine.pause();
      },
    );
    const seekSub = PlaybackNotificationManager.addEventListener(
      'playbackNotificationSeekTo',
      (event) => {
        audioEngine.seek(event.value);
      },
    );
    for (const sub of [playSub, pauseSub, seekSub]) {
      if (sub) subscriptions.push(sub);
    }
  },

  /**
   * Play a queue from `index`. The queue is the list the user tapped into; prev()/next()
   * walk it. Streams for a fast start (no seek), falling back to decoded-buffer playback so
   * a track always loads.
   */
  async playQueue(records: RecordDto[], index: number): Promise<void> {
    const record = records[index];
    if (!record) return;

    const generation = ++playGeneration;

    // Stop the current preview right away so it does not keep sounding while the next
    // track starts. Reset progress and duration for the new track.
    stopPositionTimer();
    teardownSource();
    startOffsetSec = 0;
    currentRecord = record;
    player$.assign({
      record,
      queue: records,
      queueIndex: index,
      status: 'loading',
      positionSec: 0,
      durationSec: 0,
      canSeek: false,
    });

    if (!record.previewUrl) {
      player$.status.set('idle');
      return;
    }

    await resumeContext();
    if (generation !== playGeneration) return;

    const started = await startRecord(record, 0, generation);
    if (!started && generation === playGeneration) {
      player$.status.set('idle');
    }
  },

  /** Play a single record (a one-item queue). */
  async playRecord(record: RecordDto): Promise<void> {
    await this.playQueue([record], 0);
  },

  /** Skip to the next queued track, if any. No-op at the end of the queue. */
  next(): void {
    const queue = player$.queue.get();
    const index = player$.queueIndex.get();
    if (index >= 0 && index < queue.length - 1) {
      void this.playQueue(queue, index + 1);
    }
  },

  /**
   * Apple-Music semantics: restart the current track if we are past the first few seconds
   * (or it is the first track), otherwise jump to the previous queued track.
   */
  prev(): void {
    const queue = player$.queue.get();
    const index = player$.queueIndex.get();
    if (index <= 0 || player$.positionSec.get() > 3) {
      this.seek(0);
      return;
    }
    void this.playQueue(queue, index - 1);
  },

  /** Toggle play/pause for the currently loaded record. */
  async toggle(): Promise<void> {
    const status = player$.status.get();
    if (status === 'playing') {
      await this.pause();
    } else {
      await this.resume();
    }
  },

  async pause(): Promise<void> {
    if (player$.status.get() !== 'playing') return;
    const pos = currentPositionSec();
    stopPositionTimer();

    // Tear the source down on pause for both modes. (We avoid ctx.suspend() for streams:
    // the crash report shows the streamer's producer thread stalling in its send() queue,
    // and suspending the render/consumer side is a likely contributor.) The streamer
    // restarts from the beginning on resume since it cannot seek.
    teardownSource();
    startOffsetSec = pos;

    player$.assign({ status: 'paused', positionSec: pos });
    await updateNotification('paused', pos);
  },

  async resume(): Promise<void> {
    if (player$.status.get() === 'playing') return;

    await resumeContext();

    // A live buffer source paused mid-track: recreate it from the saved offset.
    if (mode === 'buffer' && decodedBuffer) {
      startBufferFromOffset(startOffsetSec);
      return;
    }

    // No live source (e.g. after a stream ended): restart the current record.
    const record = currentRecord;
    if (!record) return;
    const generation = playGeneration;
    const started = await startRecord(record, startOffsetSec, generation);
    if (!started && generation === playGeneration) {
      player$.status.set('idle');
    }
  },

  /** Seek to an absolute position (seconds). No-op while streaming (not supported). */
  seek(toSec: number): void {
    if (mode !== 'buffer' || !decodedBuffer) return;
    const clamped = Math.max(0, Math.min(toSec, decodedBuffer.duration));
    const wasPlaying = player$.status.get() === 'playing';
    if (wasPlaying) {
      // Reflect the new position immediately so the UI does not flash the old timestamp.
      player$.positionSec.set(clamped);
      startBufferFromOffset(clamped);
    } else {
      startOffsetSec = clamped;
      player$.positionSec.set(clamped);
      void updateNotification('paused', clamped);
    }
  },

  setGain(value: number): void {
    const clamped = Math.max(0, Math.min(value, 1));
    const { gain } = ensureGraph();
    gain.gain.value = clamped;
    player$.gain.set(clamped);
  },

  /** The analyser node for the visualizer (null until the graph exists). */
  getAnalyser(): AnalyserNode | null {
    return analyserNode;
  },

  /** Remove every subscription and release the graph. Call on app unmount. */
  async teardown(): Promise<void> {
    stopPositionTimer();
    teardownSource();
    for (const sub of subscriptions) {
      sub.remove();
    }
    subscriptions.length = 0;
    await PlaybackNotificationManager.hide();
    if (context) {
      await context.close();
    }
    context = null;
    gainNode = null;
    analyserNode = null;
    decodedBuffer = null;
    loadedRecordId = null;
    currentRecord = null;
    sessionConfigured = false;
    player$.assign({
      status: 'idle',
      record: null,
      positionSec: 0,
      durationSec: 0,
      canSeek: false,
      queue: [],
      queueIndex: -1,
    });
  },
};
