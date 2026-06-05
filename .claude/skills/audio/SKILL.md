---
name: audio
description: >-
  Conventions for the audio layer in apps/mobile, built on react-native-track-player (RNTP) v5.
  Read this for ANYTHING audio: the native queue and background playback, the headless playback
  service that wires the OS remote controls, the single engine wrapper that owns all TrackPlayer
  calls, how native state is mirrored into the Legend State player store, and the deliberate
  absence of a spectrum visualizer. This is the app centerpiece; build it deliberately.
---

# Audio (apps/mobile)

The player is built on `react-native-track-player` (RNTP). Unlike the old `react-native-audio-api`
build, RNTP IS a jukebox: it owns a NATIVE queue, background playback, full-track streaming with
seeking, and the OS remote controls (lock screen, Control Center, headset buttons, Android Auto).
We do NOT build a Web Audio graph, decode buffers, or track position by hand anymore. Everything
audio lives under `apps/mobile/src/audio`, plus the JS entry `apps/mobile/index.js`.

Installed version: `react-native-track-player@5.0.0-alpha0`. v5 is the New Architecture rewrite and
is COMMERCIALLY licensed for production use (see rntp.dev); the public npm `5.0.0-alpha0` is a
pre-release. Treat the version as load-bearing: keep the engine the single integration point so a
bump (or a move to the licensed build) is a one-file change.

## The engine is the only thing that talks to TrackPlayer

`src/audio/engine.ts` is the sole module that imports and calls `TrackPlayer`. Components and
screens call the engine, never `TrackPlayer` directly. Public API (keep it stable, the UI depends
on it): `setupSession()`, `teardown()`, `playQueue(records, index)`, `playRecord(record)`,
`next()`, `prev()`, `toggle()`, `pause()`, `resume()`, `seek(sec)`, `setGain(value)`.

## Setup and the playback service (two distinct registrations)

1. **Service registration (JS entry, `apps/mobile/index.js`).** `package.json` `main` points at
   `index.js`, which imports `expo-router/entry` (registers the root component) and then calls
   `TrackPlayer.registerPlaybackService(() => PlaybackService)`. This MUST run at the top level of
   the entry so it is in place when the OS spins up the headless JS task to handle a notification
   action after the app was killed. `PlaybackService` lives in `src/audio/service.ts` and only
   registers the `Remote*` handlers (RemotePlay/Pause/Stop/Next/Previous/Seek/JumpForward/Backward)
   that map OS button presses to `TrackPlayer` calls. Keep it side-effect free at import time.

2. **Player setup (`engine.setupSession()`, called once from the root layout).** Kicks off a
   memoized `setupPlayer({ autoHandleInterruptions: true, iosCategory: Playback })` then
   `updateOptions({ capabilities, notificationCapabilities, forwardJumpInterval,
   backwardJumpInterval, android: { appKilledPlaybackBehavior: ContinuePlayback } })`. Setup must
   complete before any queue/playback call, so `playQueue` awaits the same memoized promise.
   `setupPlayer` throws if the native player is already initialized (survives a JS hot reload), so
   that one call is wrapped in try/catch and we fall through to `updateOptions`.

Interruptions (calls, other apps, ducking) are handled NATIVELY via `autoHandleInterruptions: true`.
Do NOT hand-roll interruption pause/resume.

## Native state is mirrored into the store; never duplicated by hand

The UI reads a Legend State observable (`player$` in `src/audio/store.ts`). RNTP is the native
source of truth, and `setupSession()` registers foreground listeners that MIRROR native state into
`player$` (the engine is the sole writer):

- `Event.PlaybackState` -> map RNTP `State` to our `PlayerStatus` (`mapState`) and set
  `player$.status`; start/stop the position timer.
- `Event.PlaybackPlayWhenReadyChanged` -> set `player$.playWhenReady` (the user's play/pause
  INTENT). The transport button and list-row indicators read THIS, not `status`: intent does not
  dip while a track switch buffers, so the button never flashes the play icon mid-swap. The engine
  also sets it optimistically in `playQueue`/`resume`/`pause`/`toggle`.
- `Event.PlaybackActiveTrackChanged` -> set `queueIndex` from `event.index`, `record` from
  `player$.queue[index]`, reset position, publish duration / `canSeek`.
- `Event.PlaybackQueueEnded` -> status `paused`, `playWhenReady` false, position 0.

A track switch is a full `setQueue` (+ `skip`), which makes RNTP emit a transient burst before it
settles: `ActiveTrackChanged` passes through `index: undefined` (would null `record`) and `index: 0`
(would flash the queue's first track), and `PlaybackState` dips through Ready/None/Paused. The
engine records the id of the track it asked for (`pendingStartId`, set in `playQueue`) and the
`ActiveTrackChanged` handler ignores every change until that track is active. Combined with reading
intent (`playWhenReady`) for the button, this is what keeps a track switch flash-free.
- Position: a ~250ms `setInterval` polls `TrackPlayer.getProgress()` while playing and writes
  `positionSec` / `durationSec` / `canSeek`, keeping the SeekBar smooth.

Components read narrow slices with `use$(player$.x)` from `@legendapp/state/react`. Server/data
state stays in TanStack Query.

## The queue is real; keep `player$.queue` aligned with the native queue

`playQueue(records, index)` filters the list to playable records (non-null `previewUrl`), maps them
to RNTP `Track`s (stash the record id in the typed `mediaId` field; never read Track's `any` index
signature), `setQueue`s them, `skip`s to the tapped index, and `play`s. Set `player$.queue` to that
SAME filtered list so the native index maps straight onto it. `next()`/`prev()` walk the queue
(`prev()` uses Apple-Music semantics: restart the track if past ~3s or it is the first, else skip
back). The queue auto-advances natively at track end, no manual chaining.

## Lock screen / remote controls

Driven by `updateOptions` capabilities + the `Remote*` handlers in the playback service, plus
metadata RNTP derives from each `Track` (title, artist, artwork). There is NO manual now-playing
API to call per tick. Expose a control by adding its `Capability` and handling its `Event.Remote*`.

## No spectrum visualizer (deliberate)

RNTP exposes no `AnalyserNode` and no per-sample PCM, so a real FFT spectrum is impossible on its
output. The visualizer was removed in the migration (decision recorded with the maintainer). Do NOT
reintroduce a fake/synthetic one as if it were real spectrum data. If a visualizer is ever needed,
it must be driven by playback metadata, and that tradeoff should be surfaced first.

## Native config (Expo prebuild / EAS)

The alpha ships NO Expo config plugin. iOS background audio needs `ios.infoPlist.UIBackgroundModes:
["audio"]` in `app.json`. Android keeps `FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_MEDIA_PLAYBACK` /
`MODIFY_AUDIO_SETTINGS` permissions; RNTP merges its own `MusicService` declaration via Android
manifest merging, so no plugin entry is required. This is a dev build (prebuild), not Expo Go.
