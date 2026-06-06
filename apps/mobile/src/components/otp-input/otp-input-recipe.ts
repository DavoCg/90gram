import { tv } from 'tailwind-variants';

// Ported from perp-companion, adapted to this app's tokens: "critical" (not "negative"), the
// neutral/neutral-disabled text roles, the surface-2 field background, and the Polymath type family.
export const otpInputRecipe = tv({
  base: 'w-full flex-row gap-2',
  variants: {
    state: {
      idle: {},
      error: {},
      success: {},
      loading: {},
    },
  },
});

export const otpInputSlotRecipe = tv({
  slots: {
    slot: 'h-14 flex-1 items-center justify-center rounded-2xl curve-continuous',
    outline:
      'absolute -top-[4px] -bottom-[4px] -left-[4px] -right-[4px] rounded-[20px] border-2',
    text: '',
    placeholder: 'text-neutral-disabled',
  },
  variants: {
    state: {
      idle: {
        text: 'text-neutral',
        slot: 'bg-surface-2',
      },
      error: {
        text: 'text-critical',
        slot: 'bg-critical-soft',
      },
      success: {
        text: 'text-positive',
        slot: 'bg-positive-soft',
      },
      loading: {
        text: 'text-neutral-disabled',
        slot: 'bg-surface-2',
      },
    },
    isActive: {
      true: {
        outline: 'border-accent',
      },
      false: {
        outline: 'border-transparent',
      },
    },
  },
  compoundSlots: [
    {
      slots: ['text', 'placeholder'],
      className: 'text-2xl font-polymath-medium',
    },
  ],
});

export const otpInputCaretRecipe = tv({
  slots: {
    caret: 'absolute -left-0.5 top-0 bottom-0 w-0.5 rounded-[1px]',
  },
  variants: {
    state: {
      idle: {
        caret: 'bg-accent',
      },
      error: {
        caret: 'bg-critical',
      },
      success: {
        caret: 'bg-positive',
      },
      loading: {},
    },
  },
});
