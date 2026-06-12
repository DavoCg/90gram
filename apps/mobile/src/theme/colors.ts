import { useUniwind } from 'uniwind';

// React Navigation chrome (the tab bar, headers) is styled with JS color values, not
// Uniwind classNames, so it cannot read the CSS custom properties in global.css. Mirror
// the SAME token values here and pick the palette from Uniwind's active theme. Keep these
// in sync with the @variant light/dark blocks in global.css.
export interface ThemeColors {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
}

export const lightColors: ThemeColors = {
  bg: '#faf7f2',
  surface: '#ffffff',
  surface2: '#f1ece3',
  text: '#18181b',
  muted: '#6b7280',
  border: '#e7e2d8',
  // Accent now follows the reference design system: grass-9 (green).
  accent: '#46a758',
};

export const darkColors: ThemeColors = {
  bg: '#1c1714',
  surface: '#251e19',
  surface2: '#312922',
  text: '#f1ebe3',
  muted: '#aa9d90',
  border: '#3a312a',
  accent: '#46a758',
};

export function useThemeColors(): ThemeColors {
  // Read Uniwind's active theme, not useColorScheme(). Uniwind.setTheme() notifies its
  // subscribers synchronously, so the nav chrome flips in the same pass as the className
  // views; useColorScheme() only updates on the async native Appearance event, which lagged.
  return useUniwind().theme === 'dark' ? darkColors : lightColors;
}
