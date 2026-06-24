import { tv } from 'tailwind-variants';

// Ported from perp-companion's Input, adapted to this app's tokens (bg-surface-2, border-border,
// the hairline border utility) and the Polymath type family. The container is a flex row so start/end
// slots and the text input share one vertically-centered baseline.
export const inputContainerRecipe = tv({
  base: 'flex-row items-center gap-2 rounded-2xl curve-continuous bg-surface-2 px-4',
  variants: {
    variant: {
      default: '',
      error: 'border border-critical',
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

// Font size is set with arbitrary px (text-[Npx]) rather than the named text-sm/base/lg, matching
// the Text recipe. The named scales bake in a Tailwind line-height; on a single-line iOS TextInput
// an explicit line-height top-aligns the glyph and breaks vertical centering. With no line-height,
// iOS centers the text natively and Android centers via textAlignVertical (set on the field).
export const inputTextRecipe = tv({
  base: 'flex-1 bg-transparent font-polymath-medium',
  variants: {
    size: {
      sm: 'text-[14px]',
      md: 'text-[16px]',
      lg: 'text-[18px]',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});
