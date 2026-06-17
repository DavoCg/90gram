import { Stack } from 'expo-router';
import { STACK_ANIMATION_DURATION } from '../../../src/theme/motion';
import { useThemeColors } from '../../../src/theme/colors';

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
