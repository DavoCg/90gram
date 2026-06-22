import type { ComponentType } from 'react';
import { Bookmark, Disc3, Headphones, Radio, Sparkles } from 'lucide-react-native';

// One onboarding story. Backgrounds are designed gradients (no photo assets yet): a diagonal
// `colors` gradient plus a large faint `Icon` watermark. Swap a slide to a photo later by giving
// the carousel an image layer; the title/subtitle/entrance machinery stays the same. The title and
// subtitle copy lives in the `onboarding` translation bundle, keyed by `key` (see the carousel).
// The slide identifiers, also the translation-key segment (slides.<key>.title/subtitle in the
// onboarding bundle). A literal union (not string) so those dynamic t() keys stay type-checked.
export type OnboardingSlideKey = 'discover' | 'preview' | 'feed' | 'radio' | 'wishlist';

export interface OnboardingSlide {
  key: OnboardingSlideKey;
  // Lucide icon rendered as the oversized background watermark.
  Icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  // Diagonal gradient stops (top-left -> bottom-right). At least two colors.
  colors: readonly [string, string, ...string[]];
}

// Vinyl-discovery value props, in show order. Keep copy short: a punchy headline plus one line.
export const ONBOARDING_SLIDES: readonly OnboardingSlide[] = [
  {
    key: 'discover',
    Icon: Disc3,
    colors: ['#3b1f4d', '#1c1714'],
  },
  {
    key: 'preview',
    Icon: Headphones,
    colors: ['#0f3d3a', '#15110e'],
  },
  {
    key: 'feed',
    Icon: Sparkles,
    colors: ['#5a3210', '#1c1410'],
  },
  {
    key: 'radio',
    Icon: Radio,
    colors: ['#1e2a55', '#121016'],
  },
  {
    key: 'wishlist',
    Icon: Bookmark,
    colors: ['#5a1130', '#180f12'],
  },
] as const;
