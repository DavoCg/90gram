import { Stack } from 'expo-router';
import { STACK_ANIMATION_DURATION } from '../../../src/theme/motion';
import { useThemeColors } from '../../../src/theme/colors';

// Declaring an explicit <Stack.Screen> child (filter) below makes Expo Router anchor the stack to a
// declared screen, which would land the Home tab on the filter sheet instead of the feed. Pin the
// initial route back to the feed. (Same reason (auth)/_layout.tsx pins 'welcome'.)
//
// initialRouteName alone is not enough here: this stack is doubly nested (root Stack -> Tabs ->
// home Stack), and on a FRESH mount of the whole tab shell (e.g. when the auth guard flips right
// after sign-in) the only explicitly declared <Stack.Screen> (filter) was winning the anchor, so
// the app opened on the genre filter sheet. Declaring `index` explicitly, FIRST, anchors the stack
// to the feed by declaration order, mirroring how (auth)/_layout.tsx declares `welcome` first.
export const unstable_settings = { initialRouteName: 'index' };

// The Home tab is its own stack so the vinyl detail page pushes ON TOP of the list while the
// bottom tab bar (owned by the parent (tabs) layout) and the global mini-player stay visible.
// Pushing within the tab, not presenting a root modal, is what keeps both on screen.
export default function HomeStackLayout() {
  const colors = useThemeColors();
  // `simple_push` is the JS-driven slide that honors animationDuration on both iOS and Android;
  // `slide_from_right` is Android-only and falls back to the non-customizable UIKit push on iOS.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'simple_push',
        animationDuration: STACK_ANIMATION_DURATION,
      }}
    >
      {/* The feed, declared FIRST so it is the stack's anchor/initial route (see note above). */}
      <Stack.Screen name="index" />
      {/* Genre filter, presented as a native form sheet. Uses fixed detents (not 'fitToContents')
          because it pins BOTH a header and a footer: the route lays out a flex column that needs a
          definite sheet height to size the scrolling middle. Other routes in this stack (index,
          vinyl/[id], shop/[id]) auto-register with the default push animation. */}
      <Stack.Screen
        name="filter"
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.9],
          // Paint the whole sheet (incl. the native safe-area extension) with the surface color.
          contentStyle: { backgroundColor: colors.surface },
        }}
      />
    </Stack>
  );
}
