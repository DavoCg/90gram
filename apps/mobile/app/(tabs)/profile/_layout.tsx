import { Stack } from 'expo-router';
import { STACK_ANIMATION_DURATION } from '../../../src/theme/motion';

// Pin the stack's initial route to the profile. The stack contains only profile screens (the
// create-collection sheet is a ROOT route, not declared here), so this lands the "You" tab on the
// profile rather than on whichever screen happens to register first.
export const unstable_settings = { initialRouteName: 'index' };

// The Profile tab is its own stack (like Home / Favorites) so user profiles, collections, and the
// records opened from them push ON TOP of the profile while the tab bar and mini-player stay put.
// Every route in this stack (index, edit, followers, following, user/[username], collection/[id],
// vinyl/[id], shop/[id]) auto-registers with the default push animation.
export default function ProfileStackLayout() {
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
