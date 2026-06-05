import { Stack } from 'expo-router';

// The Favorites tab is its own stack (like Home) so the vinyl detail page pushes ON TOP of the
// favorites list while the bottom tab bar and the global mini-player stay visible, instead of
// jumping over to the Home stack to show a record.
export default function FavoritesStackLayout() {
  // 200ms slide-from-right push/pop, matching the Home stack.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 200,
      }}
    />
  );
}
