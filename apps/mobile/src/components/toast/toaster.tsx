import { StyleSheet } from 'react-native';
import { CircleAlert, CircleCheck, CircleX, Info } from 'lucide-react-native';
import { Toaster } from 'sonner-native';
import { useUniwind } from 'uniwind';
import { useThemeColors } from '../../theme/colors';

// Semantic accent colors for the toast variant icons, mirroring the design system's role -> Radix
// scale mapping (success/positive -> grass, error/critical -> tomato, warning -> amber, info ->
// blue). We read the active Uniwind theme and pick the step-11 value so the glyph stays legible on
// our surface in both light and dark. These are JS color values because sonner-native styles with
// StyleSheet, not className (same constraint as the React Navigation chrome in theme/colors.ts).
const ICON_COLORS = {
  light: { success: '#2a7e3b', error: '#d13415', warning: '#ab6400', info: '#0d74ce' },
  dark: { success: '#71d083', error: '#ff977d', warning: '#ffca16', info: '#70b8ff' },
} as const;

const FONT_TITLE = 'Polymath-Semibold';
const FONT_BODY = 'Polymath-Medium';

// App-wide toast host. Drop ONE of these near the root (see app/_layout.tsx). It wraps
// sonner-native's Toaster and dresses every toast in our design tokens: the surface/border/text
// colors from useThemeColors, Polymath typography, and continuous-curve rounded corners. Trigger
// toasts from anywhere with the re-exported `toast` (see ./index.ts).
export function AppToaster() {
  const colors = useThemeColors();
  const isDark = useUniwind().theme === 'dark';
  const icons = ICON_COLORS[isDark ? 'dark' : 'light'];
  const iconSize = 22;

  return (
    <Toaster
      // Follow our explicit dark-mode preference rather than sonner's own 'system' detection so
      // toasts flip in the same pass as the rest of the app.
      theme={isDark ? 'dark' : 'light'}
      position="top-center"
      swipeToDismissDirection="up"
      gap={10}
      icons={{
        success: <CircleCheck color={icons.success} size={iconSize} />,
        error: <CircleX color={icons.error} size={iconSize} />,
        warning: <CircleAlert color={icons.warning} size={iconSize} />,
        info: <Info color={icons.info} size={iconSize} />,
      }}
      styles={{
        toast: {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: 18,
          borderCurve: 'continuous',
        },
        title: {
          color: colors.text,
          fontFamily: FONT_TITLE,
          fontSize: 15,
        },
        description: {
          color: colors.muted,
          fontFamily: FONT_BODY,
          fontSize: 13,
        },
      }}
      toastOptions={{
        actionButtonStyle: { backgroundColor: colors.accent, borderRadius: 999 },
        actionButtonTextStyle: { color: '#ffffff', fontFamily: FONT_TITLE },
        cancelButtonTextStyle: { color: colors.muted, fontFamily: FONT_BODY },
      }}
    />
  );
}
