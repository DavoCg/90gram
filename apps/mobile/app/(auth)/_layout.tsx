import { Stack } from 'expo-router';

// The unauthenticated area. A bare stack (the custom AppHeader handles chrome per screen, like the
// rest of the app). The root layout redirects here when there is no session and back out once the
// user signs in.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
