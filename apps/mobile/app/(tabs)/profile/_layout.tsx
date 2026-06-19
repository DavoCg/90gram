import { Stack } from 'expo-router';
import { STACK_ANIMATION_DURATION } from '../../../src/theme/motion';
import { useThemeColors } from '../../../src/theme/colors';

// Declaring an explicit <Stack.Screen> with options (new-collection) makes Expo Router anchor the
// stack to a declared screen; pin the initial route back to the profile so the tab lands there.
export const unstable_settings = { initialRouteName: 'index' };

// The Profile tab is its own stack (like Home / Favorites) so user profiles, collections, and the
// records opened from them push ON TOP of the profile while the tab bar and mini-player stay put.
// Other routes in this stack (index, edit, followers, following, user/[username], collection/[id],
// vinyl/[id], shop/[id]) auto-register with the default push animation.
export default function ProfileStackLayout() {
  const colors = useThemeColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'simple_push',
        animationDuration: STACK_ANIMATION_DURATION,
      }}
    >
      {/* Create-collection, presented as a native form sheet sized to its content. */}
      <Stack.Screen
        name="new-collection"
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: 'fitToContents',
          contentStyle: { backgroundColor: colors.surface },
        }}
      />
    </Stack>
  );
}
