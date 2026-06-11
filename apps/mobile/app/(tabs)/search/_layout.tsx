import { Stack } from 'expo-router';
import { STACK_ANIMATION_DURATION } from '../../../src/theme/motion';

// The Search tab is its own stack (like Home and Favorites) so a record opened from the results
// pushes ON TOP of the search list while the bottom tab bar and the global mini-player stay
// visible, instead of jumping over to the Home stack. The shared detail screens navigate relatively
// (`../shop/[id]`, `../vinyl/[id]`), which resolves to the siblings mounted in this folder.
export default function SearchStackLayout() {
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
