import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Bottom padding for the content of a native form sheet (currency, filter, auth-method).
// Keeps a little breathing room above the home indicator (the "safe" part), but only a fraction of
// the full safe-area inset: a form sheet floats inset from the screen edge and already clears most of
// the indicator itself, so applying the whole inset reads as too much dead space. Half the inset,
// with an 8px floor so devices without a home indicator still get a small gap.
export function useSheetBottomPadding(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom / 2, 8);
}
