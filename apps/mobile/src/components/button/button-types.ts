import type { ReactNode } from 'react';
import type { PressableProps } from 'react-native';
import type { VariantProps } from 'tailwind-variants';
import type { buttonRecipe } from './button-recipe';

// Lean port of the reference Button props. `status` is derived internally (enabled/disabled),
// so it is omitted from the public variant props. The reference's analytics, label shimmer,
// backdrop blur, and icon-font slots are dropped; slots here are plain ReactNodes.
export type ButtonProps = Omit<VariantProps<typeof buttonRecipe>, 'status'> & {
  onPress?: () => void;
  label?: string;
  loading?: boolean;
  startSlot?: ReactNode;
  endSlot?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  disabled?: boolean;
  preserveDisabledStyle?: boolean;
} & Omit<PressableProps, 'onPress' | 'disabled' | 'children'>;
