import { Stack } from 'expo-router';
import { STACK_ANIMATION_DURATION } from '../../../src/theme/motion';

// The Home tab is its own stack so the vinyl detail page pushes ON TOP of the list while the
// bottom tab bar (owned by the parent (tabs) layout) and the global mini-player stay visible.
// Pushing within the tab, not presenting a root modal, is what keeps both on screen.
export default function HomeStackLayout() {
  // `simple_push` is the JS-driven slide that honors animationDuration on both iOS and Android;
  // `slide_from_right` is Android-only and falls back to the non-customizable UIKit push on iOS.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'simple_push',
        animationDuration: STACK_ANIMATION_DURATION,
      }}
    />
  );
}
