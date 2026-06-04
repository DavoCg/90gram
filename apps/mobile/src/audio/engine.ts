// The audio engine: a single imperative module that owns the whole audio graph.
// Built on react-native-audio-api (Web Audio model). There is no jukebox here; we
// build playback ourselves. See the audio skill for the rules this follows.
//
// Graph (created once): source -> gain -> analyser -> destination. The analyser sits
// AFTER gain so the visualizer reacts to the actual output level. Source nodes are
// single-use, so a fresh AudioBufferSourceNode is created for every play.
//
// Note on the installed library version (0.12.2): the AudioContext constructor does not
// accept `initSuspended`, so we create the context lazily and resume() it on the first
// user gesture. Lock-screen / now-playing is handled by PlaybackNotificationManager
// (the older enableRemoteCommand / setLockScreenInfo API does not exist in 0.12.2).
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

let context: AudioContext | null = null;
let gainNode: GainNode | null = null;
let analyserNode: AnalyserNode | null = null;
let sourceNode: AudioBufferSourceNode | null = null;

let decodedBuffer: AudioBuffer | null = null;
let loadedRecordId: string | null = null;

// Offset bookkeeping for pause/resume/seek (the engine tracks position itself).
let startOffsetSec = 0; // where in the buffer the current source started
let startedAtCtxTime = 0; // context.currentTime when the current source started
let positionTimer: ReturnType<typeof setInterval> | null = null;

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
    const pos = Math.min(currentPositionSec(), durationSec || Number.POSITIVE_INFINITY);
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
  if (sourceNode) {
    sourceNode.onEnded = null;
    try {
      sourceNode.stop();
    } catch {
      // Source may not have been started or already stopped; safe to ignore.
    }
    sourceNode.disconnect();
    sourceNode = null;
  }
}

function playFromOffset(offsetSec: number): void {
  const { ctx, gain } = ensureGraph();
  if (!decodedBuffer) return;

  teardownSource();

  const source = ctx.createBufferSource({ pitchCorrection: true });
  source.buffer = decodedBuffer;
  source.connect(gain);
  source.onEnded = () => {
    handleEnded();
  };

  startOffsetSec = offsetSec;
  startedAtCtxTime = ctx.currentTime;
  source.start(0, offsetSec);
  sourceNode = source;

  player$.status.set('playing');
  startPositionTimer();
  void updateNotification('playing', offsetSec);
}

function handleEnded(): void {
  // Natural end of the clip. Reset to the start and mark paused.
  stopPositionTimer();
  teardownSource();
  startOffsetSec = 0;
  player$.assign({ status: 'paused', positionSec: 0 });
  void updateNotification('paused', 0);
}

async function decode(record: RecordDto): Promise<boolean> {
  if (!record.previewUrl) return false;
  const { ctx } = ensureGraph();
  const response = await fetch(record.previewUrl);
  const arrayBuffer = await response.arrayBuffer();
  decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
  loadedRecordId = record.id;
  player$.durationSec.set(decodedBuffer.duration);
  return true;
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

  /** Load (if needed) and play a record from the start. Resumes the context on first gesture. */
  async playRecord(record: RecordDto): Promise<void> {
    player$.assign({ record, status: 'loading' });
    await resumeContext();

    if (loadedRecordId !== record.id || !decodedBuffer) {
      const ok = await decode(record);
      if (!ok) {
        player$.status.set('idle');
        return;
      }
    }
    playFromOffset(0);
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
    teardownSource();
    startOffsetSec = pos;
    player$.assign({ status: 'paused', positionSec: pos });
    await updateNotification('paused', pos);
  },

  async resume(): Promise<void> {
    if (!decodedBuffer) return;
    await resumeContext();
    playFromOffset(startOffsetSec);
  },

  /** Seek to an absolute position (seconds) and keep the current play/paused state. */
  seek(toSec: number): void {
    if (!decodedBuffer) return;
    const clamped = Math.max(0, Math.min(toSec, decodedBuffer.duration));
    const wasPlaying = player$.status.get() === 'playing';
    if (wasPlaying) {
      playFromOffset(clamped);
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
    sessionConfigured = false;
    player$.assign({ status: 'idle', record: null, positionSec: 0, durationSec: 0 });
  },
};
