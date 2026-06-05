---
name: audio
description: >-
  Conventions for the audio layer in apps/mobile, built on react-native-audio-api (Software
  Mansion, Web Audio model). Read this for ANYTHING audio: the single AudioContext, the
  source -> gain -> analyser -> destination graph, buffer-based preview playback, the Legend State
  player store, lock-screen / remote controls via AudioManager, subscription cleanup, and the
  AnalyserNode-driven visualizer. This is the app centerpiece; build it deliberately.
---

# Audio (apps/mobile)

`react-native-audio-api` is a Web Audio engine, not a jukebox: there is no built-in queue or `play(url)`.
We build the player layer ourselves. It lives entirely under `apps/mobile/src/audio`. Do NOT use
`react-native-track-player` or `react-native-audio-pro`. Audio calls are NOT scattered across components.

## One AudioContext for the whole app

Create it once (module singleton in `src/audio/engine.ts`) and `resume()` on the first user gesture.
Never instantiate per screen. The graph is imperative and lives in module refs; only serializable UI
state lives in the store.

Version note (react-native-audio-api 0.12.2): the `AudioContext` constructor does NOT accept
`initSuspended`, so we create it lazily and resume on the first gesture instead. There is also no
`playbackRate` AudioParam on `AudioBufferSourceNode` in this version, so the player exposes gain
(volume) but not a playback-rate control. Keep this in sync if the library version changes.

## Node graph

`source -> GainNode -> AnalyserNode -> destination`. The analyser sits AFTER gain so the visualizer reacts
to actual output level. Start with `analyser.fftSize = 256`, `smoothingTimeConstant = 0.8`. The active
source is recreated on every play; always connect it into `gainNode` (never straight to `destination`, or
the visualizer goes silent).

## Two playback modes (engine picks per track)

Previews are full-length tracks, so a fast start matters. The engine has a master switch `STREAMING_ENABLED`
(in `engine.ts`) and chooses per track:

### STREAM mode (fast start, no seek) — DISABLED by default

`ctx.createStreamer(previewUrl)` plays a remote URL progressively. FFmpeg is present and it DOES stream, but
in react-native-audio-api 0.12.2 the native `StreamerNode` throws on the CoreAudio render thread
(`AURemoteIO::IOThread` -> `std::terminate` -> SIGABRT) and hard-crashes the app. A JS try/catch cannot
catch a crash on the audio render thread. So `STREAMING_ENABLED` is `false` and previews use the buffer
mode. Only flip it on to test a build where the upstream bug is fixed. When testing, connect the streamer
straight to `ctx.destination` (NOT through gain/analyser) and do NOT use `ctx.suspend()` to pause it (the
crash shows the streamer's producer queue stalling) - tear it down and restart instead.

Remote streams CANNOT seek (maintainer confirmed in issue #895: you would have to drain the socket and open
a new connection). So in stream mode set `player$.canSeek = false` and `durationSec = 0`; the `SeekBar`
renders read-only (elapsed counts up, no scrub, label shows `live`). Pause/resume uses `ctx.suspend()` /
`ctx.resume()` to freeze the whole context in place (the stream cannot resume from an offset); `currentTime`
stops advancing while suspended, so the position estimate stays continuous.

### BUFFER mode (seekable fallback)

`fetch(previewUrl) -> arrayBuffer -> ctx.decodeAudioData() -> AudioBuffer`, then a fresh
`createBufferSource({ pitchCorrection: true })` per play with `start(0, offset)`. Used when streaming is
disabled, the URL is local, the offset is non-zero (streaming ignores offsets), or createStreamer is
unavailable. Cache the decoded `AudioBuffer` per record id (replay/seek/resume does not re-download). Set
`canSeek = true` and publish `buffer.duration`. On seek-while-playing, set `player$.positionSec` to the
target BEFORE recreating the source so the bar does not flash the old timestamp.

### Shared rules

Always connect the active source into `gainNode` (volume + analyser/visualizer). A `playGeneration` counter
guards against a slow decode clobbering a newer `playRecord`, and `playRecord` tears down the current source
immediately so the old preview does not keep sounding while the next starts. Position is estimated from the
context clock on a ~250ms timer in both modes (the streamer reports no `currentTime`).

WARNING: do not pass a remote URL to `createFileSource` (it expects a local path or an ArrayBuffer and
crashes on a URL). For remote progressive playback use `createStreamer` only.

## Player store (Legend State)

Client/UI state lives in a Legend State observable (`player$` in `src/audio/store.ts`): current record,
play state, position/offset, gain. It holds ONLY serializable state, never node instances. The engine is the
sole writer (`player$.x.set(...)` / `player$.assign({...})`); components read narrow slices with
`use$(player$.x)` from `@legendapp/state/react` (fine-grained reactivity). Server/data state stays in
TanStack Query. (This replaces the Zustand store the bootstrap originally specified, per a project decision.)

## Lock screen + remote controls (0.12.2 API)

In 0.12.2 the now-playing / lock-screen controls live on `PlaybackNotificationManager`, not the older
`enableRemoteCommand` / `setLockScreenInfo` names:

- `PlaybackNotificationManager.enableControl('play' | 'pause' | 'seekTo', true)` to expose controls.
- `PlaybackNotificationManager.show({ title, artist, artwork, duration, elapsedTime, speed, state })` to
  push/update metadata; `hide()` to clear it.
- `PlaybackNotificationManager.addEventListener('playbackNotificationPlay' | 'playbackNotificationPause' |
  'playbackNotificationSeekTo', handler)` for remote actions.
- Configure the session once with `AudioManager.setAudioSessionOptions({ iosCategory: 'playback' })`,
  `AudioManager.setAudioSessionActivity(true)`, `AudioManager.observeAudioInterruptions(true)`.
- Handle `AudioManager.addSystemEventListener('interruption', e => ...)` (calls, other apps) by pausing on
  `e.type === 'began'` and resuming on `e.type === 'ended' && e.shouldResume`.

## Subscription hygiene (REQUIRED, the #1 bug with this library)

Every `addSystemEventListener` / `addEventListener` returns a subscription (or undefined). Keep them in an
array and, on unmount, call `.remove()` on ALL of them and `PlaybackNotificationManager.hide()`. The engine's
`teardown()` does this once; the root layout calls it on unmount. Get this right in one place so handlers do
not leak or double-fire.

## Visualizer

A hook reads `analyser.getByteFrequencyData()` on an animation-frame loop and drives a Skia or Reanimated
view. Keep it OFF the JS render path: write to shared values / Skia directly, never `setState` per frame.
