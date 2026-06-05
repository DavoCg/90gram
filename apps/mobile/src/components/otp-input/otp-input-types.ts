import type { OTPInputProps as OTPInputBaseProps, OTPInputRef } from 'input-otp-native';
import type { RefObject } from 'react';

export type OTPInputState = 'idle' | 'error' | 'success' | 'loading';

export interface OTPInputProps extends OTPInputBaseProps {
  state?: OTPInputState;
  inputRef?: RefObject<OTPInputRef | null>;
  placeholderChar?: string;
}
