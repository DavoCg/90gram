import { Stack } from 'expo-router';
import { STACK_ANIMATION_DURATION } from '../../src/theme/motion';

// Land on the onboarding carousel, not email/code, when the root's Stack.Protected guard mounts this
// group (there is no `index` route here, so the initial route must be named explicitly).
export const unstable_settings = { initialRouteName: 'welcome' };

// The unauthenticated area. The landing (welcome) screen is a full-bleed onboarding carousel; the
// email and code steps push over it from the right. The custom AppHeader handles chrome per screen,
// so the native headers stay hidden. The root layout's Stack.Protected guard mounts this group while
// signed out and swaps to the app once a session exists.
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: STACK_ANIMATION_DURATION,
      }}
    >
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="email" />
      <Stack.Screen name="code" />
    </Stack>
  );
}
