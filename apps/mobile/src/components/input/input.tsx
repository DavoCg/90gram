import { cloneElement, isValidElement, type ReactElement } from 'react';
import { Platform } from 'react-native';
import { TextInput, View } from '../../theme/uniwind';
import { useThemeColors } from '../../theme/colors';
import { Text } from '../text';
import type { InputProps } from './input-types';
import { inputContainerRecipe, inputTextRecipe } from './input-recipe';

// The app text field, ported from perp-companion. The label and helper render through this app's
// Text component; placeholder/selection/text colors come from useThemeColors() (the wrapped uniwind
// TextInput cannot read the CSS variables in className for those props). The field is vertically
// centered by the items-center row plus textAlignVertical; pass inputClassName="text-center" for a
// horizontally centered field (e.g. a one-time code).
export function Input({
  label,
  helperText,
  reserveHelperSpace,
  startSlot,
  endSlot,
  variant,
  size = 'md',
  disabled,
  className,
  containerClassName,
  inputClassName,
  style,
  placeholderTextColor,
  selectionColor,
  ...rest
}: InputProps) {
  const colors = useThemeColors();
  const isError = variant === 'error';

  const tintSlot = (slot: typeof startSlot) => {
    if (
      isValidElement(slot) &&
      typeof (slot as ReactElement<{ color?: string }>).props?.color === 'undefined'
    ) {
      return cloneElement(slot as ReactElement<{ color?: string }>, { color: colors.muted });
    }
    return slot;
  };

  return (
    <View className={containerClassName}>
      {label ? (
        <Text size="sm" weight="medium" className="mb-1">
          {label}
        </Text>
      ) : null}
      <View className={inputContainerRecipe({ variant, size, disabled, className })}>
        {tintSlot(startSlot)}
        <TextInput
          {...rest}
          className={inputTextRecipe({ size, className: inputClassName })}
          editable={!disabled}
          style={[
            { color: colors.text },
            // A font-size className (text-base / text-lg / text-2xl) also bakes in a Tailwind
            // line-height. On a single-line iOS TextInput an explicit lineHeight top-aligns the
            // glyph and breaks vertical centering, so unset it here. Android centers via the
            // textAlignVertical below. (Same fix as perp-companion's Input.)
            Platform.OS === 'ios' ? { lineHeight: undefined } : null,
            style,
          ]}
          placeholderTextColor={placeholderTextColor ?? colors.muted}
          selectionColor={selectionColor ?? colors.accent}
          textAlignVertical="center"
          allowFontScaling={false}
        />
        {tintSlot(endSlot)}
      </View>
      {reserveHelperSpace ? (
        <View className="h-5 justify-center">
          {helperText ? (
            <Text size="xs" color={isError ? 'critical' : 'neutral-soft'}>
              {helperText}
            </Text>
          ) : null}
        </View>
      ) : helperText ? (
        <Text size="xs" color={isError ? 'critical' : 'neutral-soft'} className="mt-1">
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

export type { InputProps, InputVariants } from './input-types';
