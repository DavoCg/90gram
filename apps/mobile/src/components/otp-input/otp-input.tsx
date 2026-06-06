import { OTPInput as OTPInputBase, type OTPInputRef } from 'input-otp-native';
import { useEffect, useRef } from 'react';
import Animated from 'react-native-reanimated';
import { View } from '../../theme/uniwind';
import { useShake } from '../../hooks/use-shake';
import type { OTPInputProps } from './otp-input-types';
import { OTPInputSlot } from './otp-input-slot';
import { otpInputRecipe } from './otp-input-recipe';

// Six-slot one-time-code field built on input-otp-native: a single hidden input drives per-digit
// boxes, so each digit is centered in its own slot (no letter-spacing tricks). Shakes on error.
// Ported from perp-companion. Pass `state="error"` to trigger the shake + error styling.
export function OTPInput({
  autoFocus,
  state = 'idle',
  inputRef,
  placeholderChar,
  ...props
}: OTPInputProps) {
  const internalRef = useRef<OTPInputRef>(null);
  const ref = inputRef ?? internalRef;

  const { shake, style } = useShake();

  useEffect(() => {
    if (state === 'error') {
      shake();
    }
  }, [shake, state]);

  return (
    <Animated.View style={style}>
      <OTPInputBase
        {...props}
        autoFocus={autoFocus}
        ref={ref}
        render={({ slots }) => (
          <View className={otpInputRecipe({ state })}>
            {slots.map((slot, index) => (
              <OTPInputSlot
                key={`otp-slot-${index}`}
                {...slot}
                state={state}
                placeholderChar={placeholderChar?.[index] ?? slot.placeholderChar}
              />
            ))}
          </View>
        )}
      />
    </Animated.View>
  );
}

export type { OTPInputProps, OTPInputState } from './otp-input-types';
