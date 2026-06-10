import { useSegments } from 'expo-router';

// The vinyl and shop detail screens (src/screens) are shared: each tab stack that can open a record
// mounts the same component. To push a SIBLING detail page (a shop from a vinyl, a vinyl from a shop)
// onto the stack the user is already in (so the active tab and the mini-player stay put), they need
// the current stack's URL prefix. Home is the index group `(home)`, whose routes live at the root
// (no prefix); Favorites routes are prefixed with `/favorites`. An absolute `/shop/[id]` would always
// resolve to the Home stack and jump the user back to Home, which is the bug this avoids.
export function useStackPrefix(): '' | '/favorites' {
  const segments = useSegments();
  return segments.includes('favorites') ? '/favorites' : '';
}
