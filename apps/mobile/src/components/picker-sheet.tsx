import type { ReactNode } from 'react';
import { ScrollView as RNScrollView, StyleSheet, View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModalBottomSheet } from '@swmansion/react-native-bottom-sheet';
import { Check } from 'lucide-react-native';
import { Pressable, View } from '../theme/uniwind';
import { useThemeColors } from '../theme/colors';
import { Text } from './text';

// One option in a PickerSheet. `value` is the stable key that is persisted on select; `label` is the
// primary line; `description` is an optional second line; `leading` is an optional visual (e.g. a
// flag) shown before the text.
export interface PickerOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  leading?: ReactNode;
}

export interface PickerSheetProps<T extends string> {
  // Open/closed state, driven by the caller. We map it onto the native sheet's detent index.
  open: boolean;
  // Fired when the sheet should close: a drag-dismiss, or right after a selection.
  onClose: () => void;
  // Heading shown above the list.
  title: string;
  // The selectable options, in display order.
  options: PickerOption<T>[];
  // The currently selected value: it gets the squircle highlight and the trailing check.
  selected: T;
  // Called with the chosen value. The sheet closes itself afterwards via onClose.
  onSelect: (value: T) => void;
}

// Reusable single-select bottom sheet. A native modal sheet (sized to its content, capped to the
// screen and scrollable beyond that) lists options as rows; the selected row gets a continuous-curve
// ("squircle") highlight plus a trailing check. Drive it with `open` / `onClose`, pass the options,
// the current `selected` value, and an `onSelect`. This is the shared "choose one from a list" sheet
// (currency today, sort/filter/... later), so keep it generic: anything currency-specific lives in
// the caller via the `leading`/`label`/`description` fields, not here.
export function PickerSheet<T extends string>({
  open,
  onClose,
  title,
  options,
  selected,
  onSelect,
}: PickerSheetProps<T>) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  return (
    <ModalBottomSheet
      index={open ? 1 : 0}
      // Only fires on a user-driven snap; index 0 means the user dragged the sheet closed.
      onIndexChange={(i) => {
        if (i === 0) onClose();
      }}
      detents={[0, 'content']}
      scrimColor="rgba(0, 0, 0, 0.5)"
      surface={
        <RNView
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderCurve: 'continuous',
            },
          ]}
        />
      }
    >
      <View className="px-4 pt-2.5" style={{ paddingBottom: insets.bottom + 12 }}>
        {/* Grab handle */}
        <RNView
          style={{
            alignSelf: 'center',
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            marginBottom: 8,
          }}
        />
        <Text size="lg" weight="semibold" className="mb-1 px-1">
          {title}
        </Text>
        {/* Cap the list height so a long list scrolls instead of growing past the screen. */}
        <RNScrollView
          style={{ maxHeight: 440 }}
          contentContainerStyle={{ paddingVertical: 4 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {options.map((option) => {
            const isSelected = option.value === selected;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
                className={`flex-row items-center gap-3 rounded-2xl curve-continuous px-3 py-2.5 ${
                  isSelected ? 'border-hairline border-border bg-surface-2' : ''
                }`}
              >
                {option.leading}
                <View className="flex-1">
                  <Text weight="semibold">{option.label}</Text>
                  {option.description ? (
                    <Text size="sm" color="neutral-soft" className="mt-0.5">
                      {option.description}
                    </Text>
                  ) : null}
                </View>
                {isSelected ? <Check color={colors.accent} size={20} /> : null}
              </Pressable>
            );
          })}
        </RNScrollView>
      </View>
    </ModalBottomSheet>
  );
}
