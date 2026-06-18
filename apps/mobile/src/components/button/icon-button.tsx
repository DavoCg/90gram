import type { ReactNode } from 'react';
import { Button } from './button';
import type { ButtonProps } from './button-types';

// Props for an icon-only button: a single glyph, no text. Inherits the full Button API except the
// parts IconButton owns (the slots, label, and square layout). accessibilityLabel is required since
// there is no visible text to name the control.
export interface IconButtonProps
  extends Omit<ButtonProps, 'startSlot' | 'endSlot' | 'icon' | 'label' | 'children' | 'layout'> {
  icon: ReactNode;
  accessibilityLabel: string;
}

// The canonical icon-only button. Defaults to the soft, neutral, square "squircle" look shared across
// the app's headers and toolbars (profile, favorite, more, ...). Every default is overridable: pass
// variant="ghost" for borderless transport controls, or a different size/color as needed.
export function IconButton({
  icon,
  variant = 'soft',
  color = 'neutral',
  size = 'xs',
  ...props
}: IconButtonProps) {
  return (
    <Button variant={variant} color={color} size={size} layout="square" startSlot={icon} {...props} />
  );
}
