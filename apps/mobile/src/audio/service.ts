// The RNTP playback service: the headless handler that wires the OS remote controls
// (lock screen, Control Center, notification, headset buttons, Android Auto) to the
// player. It is registered ONCE at the JS entry (see apps/mobile/index.js) and runs for
// the whole life of the player process, including when the UI is backgrounded or the app
// has been killed and the OS restarts JS just to handle a notification action.
//
// Keep this file dependency-light and side-effect free at import time: it only registers
// listeners when invoked as the service. Audio interruptions (calls, other apps) are
// handled natively because we pass `autoHandleInterruptions: true` to setupPlayer, so we
// do NOT register a RemoteDuck handler here.
import TrackPlayer, { Event } from 'react-native-track-player';

export async function PlaybackService(): Promise<void> {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    void TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    void TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    void TrackPlayer.stop();
  });

  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    void TrackPlayer.skipToNext();
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    void TrackPlayer.skipToPrevious();
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    void TrackPlayer.seekTo(event.position);
  });

  TrackPlayer.addEventListener(Event.RemoteJumpForward, (event) => {
    void TrackPlayer.seekBy(event.interval);
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, (event) => {
    void TrackPlayer.seekBy(-event.interval);
  });
}
