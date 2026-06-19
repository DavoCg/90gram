import { Stack } from 'expo-router';
import { STACK_ANIMATION_DURATION } from '../../src/theme/motion';

// One-time onboarding shown after the first sign-in until the user has claimed a username. The root
// auth gate (app/_layout.tsx) only mounts this group while signed in AND without a username; claiming
// one flips the gate and reveals the tabs.
export default function OnboardingLayout() {
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
