import type { SlotProps } from 'input-otp-native';
import { Platform } from 'react-native';
import { View } from '../../theme/uniwind';
import { Text } from '../text';
import type { OTPInputState } from './otp-input-types';
import { OTPInputCaret } from './otp-input-caret';
import { otpInputSlotRecipe } from './otp-input-recipe';

interface OTPInputSlotProps extends Omit<SlotProps, 'placeholderChar'> {
  state?: OTPInputState;
  placeholderChar?: string | null;
}

// One digit box. The single character is centered by the slot's flex alignment; lineHeight is unset
// on iOS so the glyph sits vertically centered (a font-size className otherwise bakes in a
// line-height that top-aligns it). Ported from perp-companion.
export function OTPInputSlot({
  char,
  isActive,
  state,
  hasFakeCaret,
  placeholderChar,
}: OTPInputSlotProps) {
  const classes = otpInputSlotRecipe({ isActive, state });
  const lineHeightFix = Platform.OS === 'ios' ? { lineHeight: undefined } : undefined;

  return (
    <View className={classes.slot()}>
      <View className="relative">
        {hasFakeCaret ? <OTPInputCaret state={state} /> : null}
        {char !== null ? (
          <Text className={classes.text()} style={lineHeightFix}>
            {char}
          </Text>
        ) : (
          <Text className={classes.placeholder()} style={lineHeightFix}>
            {placeholderChar}
          </Text>
        )}
      </View>
      <View className={classes.outline()} pointerEvents="none" />
    </View>
  );
}
