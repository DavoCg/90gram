import type { ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';
import { View } from '../../theme/uniwind';
import { PressableScale } from '../pressable-scale';
import { Text } from '../text';
import { buttonRecipe } from './button-recipe';
import type { ButtonProps } from './button-types';

// Wrap a slot node so it picks up the recipe's startSlot/endSlot sizing classes.
function renderSlot(slot: ReactNode, className: string): ReactNode {
  if (slot == null || typeof slot === 'boolean') return null;
  return <View className={`${className} items-center justify-center`}>{slot}</View>;
}

// Lean Button built on the ported button-recipe (tailwind-variants). It keeps the recipe's full
// variant/color/size API but drops the reference's analytics, blur, icon-font, and shimmer deps,
// rendering on our existing primitives (Pressable + the recipe Text + a loading spinner).
export function Button({
  label,
  disabled,
  onPress,
  size,
  shape,
  variant = 'intense',
  color,
  layout,
  loading,
  startSlot,
  endSlot,
  align,
  weight,
  blur,
  icon,
  children,
  preserveDisabledStyle,
  ...pressableProps
}: ButtonProps) {
  const isFunctionallyDisabled = Boolean(disabled || loading);
  const status = isFunctionallyDisabled && !preserveDisabledStyle ? 'disabled' : 'enabled';
  // Disabled buttons render in the neutral color regardless of the requested color.
  const resolvedColor = status === 'disabled' ? 'neutral' : color;
  const hasStartSlot = startSlot !== undefined && startSlot !== null && startSlot !== false;
  // A slot with no label collapses to a square (icon button) unless an explicit layout is given.
  const computedLayout = layout ?? (hasStartSlot && !label ? 'square' : undefined);

  const classes = buttonRecipe({
    size,
    shape,
    variant,
    color: resolvedColor,
    layout: computedLayout,
    status,
    align,
    weight,
    blur,
  });

  // PressableScale carries the recipe `root` (layout: shrink-0 / flex-1) and the press bounce.
  return (
    <PressableScale
      onPress={isFunctionallyDisabled ? undefined : onPress}
      disabled={isFunctionallyDisabled}
      className={classes.root()}
      {...pressableProps}
    >
      <View className={classes.content()}>
        {loading ? (
          <ActivityIndicator />
        ) : (
          (children ?? (
            <>
              {icon}
              {renderSlot(startSlot, classes.startSlot())}
              {label ? (
                <Text className={classes.label()} allowFontScaling={false} numberOfLines={1}>
                  {label}
                </Text>
              ) : null}
              {renderSlot(endSlot, classes.endSlot())}
            </>
          ))
        )}
      </View>
    </PressableScale>
  );
}
