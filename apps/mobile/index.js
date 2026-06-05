// Custom JS entry. We keep Expo Router's entry (it registers the root React component) and
// then register the RNTP playback service. registerPlaybackService MUST run at the top
// level of the entry module so it is in place when the OS spins up the headless JS task to
// handle a notification action after the app was killed. `main` in package.json points here
// instead of directly at expo-router/entry.
import 'expo-router/entry';
import TrackPlayer from 'react-native-track-player';
import { PlaybackService } from './src/audio/service';

TrackPlayer.registerPlaybackService(() => PlaybackService);
