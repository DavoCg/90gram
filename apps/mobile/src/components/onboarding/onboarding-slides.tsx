import type { ComponentType } from 'react';
import { Disc3, Headphones, Heart, Radio, Sparkles } from 'lucide-react-native';

// One onboarding story. Backgrounds are designed gradients (no photo assets yet): a diagonal
// `colors` gradient plus a large faint `Icon` watermark. Swap a slide to a photo later by giving
// the carousel an image layer; the title/subtitle/entrance machinery stays the same.
export interface OnboardingSlide {
  key: string;
  title: string;
  subtitle: string;
  // Lucide icon rendered as the oversized background watermark.
  Icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  // Diagonal gradient stops (top-left -> bottom-right). At least two colors.
  colors: readonly [string, string, ...string[]];
}

// Vinyl-discovery value props, in show order. Keep copy short: a punchy headline plus one line.
export const ONBOARDING_SLIDES: readonly OnboardingSlide[] = [
  {
    key: 'discover',
    title: 'Discover vinyl worth spinning.',
    subtitle: 'New pressings from record shops near you and far.',
    Icon: Disc3,
    colors: ['#3b1f4d', '#1c1714'],
  },
  {
    key: 'preview',
    title: 'Hear it before you buy.',
    subtitle: 'Preview every record, right from the listing.',
    Icon: Headphones,
    colors: ['#0f3d3a', '#15110e'],
  },
  {
    key: 'feed',
    title: 'One feed. Every shop.',
    subtitle: 'Fresh arrivals from stores everywhere, in one place.',
    Icon: Sparkles,
    colors: ['#5a3210', '#1c1410'],
  },
  {
    key: 'radio',
    title: 'Tune into the radio.',
    subtitle: 'Nonstop crate-digging, hand-picked for you.',
    Icon: Radio,
    colors: ['#1e2a55', '#121016'],
  },
  {
    key: 'wishlist',
    title: 'Save the ones you love.',
    subtitle: 'Build a wishlist and never miss a repress.',
    Icon: Heart,
    colors: ['#5a1130', '#180f12'],
  },
] as const;
