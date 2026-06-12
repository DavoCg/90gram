import type { ReactNode, Ref } from 'react';
import type { TextInput, TextInputProps } from 'react-native';
import type { VariantProps } from 'tailwind-variants';

import type { inputContainerRecipe } from './input-recipe';

export type InputVariants = VariantProps<typeof inputContainerRecipe>;

export interface InputProps extends TextInputProps, InputVariants {
  label?: string;
  helperText?: string;
  /** Always reserve space below the input for helperText to prevent layout shift. */
  reserveHelperSpace?: boolean;
  /** Element rendered before the text input (e.g. a leading icon). */
  startSlot?: ReactNode;
  /** Element rendered after the text input (e.g. a trailing icon). */
  endSlot?: ReactNode;
  /** Classes for the outer wrapper (label + field + helper). */
  containerClassName?: string;
  /** Extra classes for the inner text input itself (e.g. "text-center tracking-[8px]"). */
  inputClassName?: string;
  /** Ref forwarded to the underlying TextInput, e.g. to focus the field programmatically. */
  ref?: Ref<TextInput>;
}
