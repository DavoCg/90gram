---
name: audio
description: >-
  Conventions for the audio layer in apps/mobile, built on react-native-audio-api (Software
  Mansion, Web Audio model). Read this for ANYTHING audio: the single AudioContext, the
  source -> gain -> analyser -> destination graph, buffer-based preview playback, the Zustand
  player store, lock-screen / remote controls via AudioManager, subscription cleanup, and the
  AnalyserNode-driven visualizer. This is the app centerpiece; build it deliberately.
---

# Audio (apps/mobile)

`react-native-audio-api` is a Web Audio engine, not a jukebox: there is no built-in queue or `play(url)`.
We build the player layer ourselves. It lives entirely under `apps/mobile/src/audio`. Do NOT use
`react-native-track-player` or `react-native-audio-pro`. Audio calls are NOT scattered across components.

## One AudioContext for the whole app

Create it once (module singleton / ref guard), `initSuspended: true`, and `resume()` on the first user
gesture. Never instantiate per screen. The graph is imperative and lives in refs; only serializable UI
state lives in the store.

## Node graph

`AudioBufferSourceNode -> GainNode -> AnalyserNode -> destination`. The analyser sits AFTER gain so the
visualizer reacts to actual output level. Start with `analyser.fftSize = 256`, `smoothingTimeConstant = 0.8`.

## Buffer-based preview playback

`fetch(previewUrl) -> response.arrayBuffer() -> ctx.decodeAudioData() -> AudioBuffer`. Source nodes are
single-use: create a fresh `createBufferSource({ pitchCorrection: true })` for every play. Keep the decoded
`AudioBuffer` in a ref; read `buffer.duration` for progress. Track playback offset yourself and use
`start(when, offset)` to resume/seek after pause.

## Player store (Zustand)

Holds only serializable UI state: current record, play state, position/offset, playback rate, gain. It does
NOT hold node instances. Components select narrow slices.

## Lock screen + remote controls (AudioManager)

`enableRemoteCommand('remotePlay'|'remotePause'|'remoteNextTrack'|'remoteChangePlaybackPosition', true)`,
register handlers with `addSystemEventListener`, push metadata via `setLockScreenInfo({ title, artist,
artwork, duration, elapsedTime, speed, state })`. Handle the `'interruption'` event (calls, other apps) by
pausing.

## Subscription hygiene (REQUIRED, the #1 bug with this library)

Every `addSystemEventListener` returns a subscription. On unmount / effect re-run, remove ALL of them and
call `AudioManager.resetLockScreenInfo()`. Get this right once in the player module so handlers do not leak
or double-fire.

## Visualizer

A hook reads `analyser.getByteFrequencyData()` on an animation-frame loop and drives a Skia or Reanimated
view. Keep it OFF the JS render path: write to shared values / Skia directly, never `setState` per frame.
