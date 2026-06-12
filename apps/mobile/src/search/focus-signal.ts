import { observable } from '@legendapp/state';

// Bumped each time the Search tab is tapped while the Search screen is already active. The
// Search screen watches this (focus-signal.onChange) to focus its input, implementing the
// "tap the active Search tab again to focus the field" gesture. A counter (not a boolean) so
// every press is a distinct change the listener fires on, even back-to-back taps.
export const searchFocusRequest$ = observable(0);

export function requestSearchFocus(): void {
  searchFocusRequest$.set((n) => n + 1);
}
