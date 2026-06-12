import { Stack } from 'expo-router';
import { STACK_ANIMATION_DURATION } from '../../src/theme/motion';

// The unauthenticated area. The landing (welcome) screen is a full-bleed onboarding carousel; the
// email and code steps push over it from the right. The custom AppHeader handles chrome per screen,
// so the native headers stay hidden. The root layout redirects here when there is no session and
// back out once the user signs in.
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
