import { Stack } from 'expo-router';

// The Home tab is its own stack so the vinyl detail page pushes ON TOP of the list while the
// bottom tab bar (owned by the parent (tabs) layout) and the global mini-player stay visible.
// Pushing within the tab, not presenting a root modal, is what keeps both on screen.
export default function HomeStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
