import type { ReactNode } from 'react';
import { Check } from 'lucide-react-native';
import { Pressable, View } from '../../theme/uniwind';
import { useThemeColors } from '../../theme/colors';
import { SHEET_ROW_INSET } from './constants';

interface SheetSelectableRowProps {
  // Whether this row is an active choice. Drives the highlighted background and the trailing check.
  selected: boolean;
  onPress: () => void;
  // Row body (label, currency symbol, secondary line). Laid out in a flex row that fills the width and
  // pushes the check to the trailing edge.
  children: ReactNode;
}

// A selectable list row for native form sheets (genre filter, currency picker). The label always sits
// at SHEET_PADDING_X, aligned with the sheet title. When selected, a rounded surface-2 background
// overflows the content padding by SHEET_ROW_INSET on each side (negative margin + matching inner
// padding), so the highlight bleeds toward the sheet edges while the text stays put. Unselected rows
// have no background, so they read as plain, title-aligned items.
export function SheetSelectableRow({ selected, onPress, children }: SheetSelectableRowProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={{ marginHorizontal: -SHEET_ROW_INSET, paddingHorizontal: SHEET_ROW_INSET }}
      className={`flex-row items-center gap-3 rounded-2xl curve-continuous py-2.5 ${
        selected ? 'bg-surface-2' : ''
      }`}
    >
      <View className="flex-1 flex-row items-center gap-3">{children}</View>
      {selected ? <Check color={colors.accent} size={20} /> : null}
    </Pressable>
  );
}
