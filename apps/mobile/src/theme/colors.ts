import { useColorScheme } from 'react-native';

// React Navigation chrome (the tab bar, headers) is styled with JS color values, not
// Uniwind classNames, so it cannot read the CSS custom properties in global.css. Mirror
// the SAME token values here and pick the palette from the system color scheme. Keep these
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

const light: ThemeColors = {
  bg: '#faf7f2',
  surface: '#ffffff',
  surface2: '#f1ece3',
  text: '#18181b',
  muted: '#6b7280',
  border: '#e7e2d8',
  accent: '#c026d3',
};

const dark: ThemeColors = {
  bg: '#0e0e10',
  surface: '#1a1a1d',
  surface2: '#232327',
  text: '#f5f5f4',
  muted: '#a1a1aa',
  border: '#2a2a2e',
  accent: '#e879f9',
};

export function useThemeColors(): ThemeColors {
  return useColorScheme() === 'dark' ? dark : light;
}
