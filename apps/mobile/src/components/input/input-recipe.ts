import { tv } from 'tailwind-variants';

// Ported from perp-companion's Input, adapted to this app's tokens (bg-surface-2, border-border,
// the hairline border utility) and the Polymath type family. The container is a flex row so start/end
// slots and the text input share one vertically-centered baseline.
export const inputContainerRecipe = tv({
  base: 'flex-row items-center gap-2 rounded-2xl curve-continuous bg-surface-2 px-4',
  variants: {
    variant: {
      default: 'border-hairline border-border',
      error: 'border-hairline border-critical',
    },
    size: {
      sm: 'h-10',
      md: 'h-12',
      lg: 'h-14',
    },
    disabled: {
      true: 'opacity-50',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
    disabled: false,
  },
});

export const inputTextRecipe = tv({
  base: 'flex-1 bg-transparent font-polymath-medium',
  variants: {
    size: {
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});
