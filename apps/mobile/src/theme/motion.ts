// Shared motion / animation timings.

// Duration (ms) for stack push/pop transitions across every Expo Router stack in the app, so
// every tab and the root navigator slide at the same pace.
export const STACK_ANIMATION_DURATION = 250;

// Approximate time (ms) a native form sheet takes to slide away on dismiss. Used to sequence a
// dismiss-then-navigate so the sheet closes fully before the next screen slides in, instead of the
// two transitions batching into one jump-cut.
export const SHEET_DISMISS_DURATION = 350;
