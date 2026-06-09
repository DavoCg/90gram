import { Stack } from 'expo-router';
import { STACK_ANIMATION_DURATION } from '../../../src/theme/motion';

// The Favorites tab is its own stack (like Home) so the vinyl detail page pushes ON TOP of the
// favorites list while the bottom tab bar and the global mini-player stay visible, instead of
// jumping over to the Home stack to show a record.
export default function FavoritesStackLayout() {
  // Matches the Home stack. `simple_push` is used (not `slide_from_right`) so animationDuration
  // is honored on iOS as well as Android.
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
