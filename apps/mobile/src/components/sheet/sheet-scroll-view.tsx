import type { ComponentProps } from 'react';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { useThemeColors } from '../../theme/colors';
import { SHEET_CONTENT_TOP, SHEET_PADDING_X } from './constants';

// The scroll container for native form-sheet content. Paints the surface background and applies the
// harmonized horizontal padding (SHEET_PADDING_X) to its content, so every sheet's list shares one
// inset instead of each screen repeating the value. Renders a single gesture-handler ScrollView:
// react-native-screens only pins a sheet header when the content is exactly two subviews, so this
// must stay one host view. Vertical and footer-clearance padding is passed in via contentContainerStyle
// by the caller (it differs per sheet); the horizontal padding is owned here.
export function SheetScrollView({
  style,
  contentContainerStyle,
  children,
  ...props
}: ComponentProps<typeof GHScrollView>) {
  const colors = useThemeColors();
  return (
    <GHScrollView
      showsVerticalScrollIndicator={false}
      style={[{ backgroundColor: colors.surface }, style]}
      contentContainerStyle={[
        { paddingHorizontal: SHEET_PADDING_X, paddingTop: SHEET_CONTENT_TOP },
        contentContainerStyle,
      ]}
      {...props}
    >
      {children}
    </GHScrollView>
  );
}
