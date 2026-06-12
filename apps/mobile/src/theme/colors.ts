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

// Radix sand scale (light): 1, 2, 3, 12, 11, 6.
export const lightColors: ThemeColors = {
  bg: '#fdfdfc',
  surface: '#f9f9f8',
  surface2: '#f1f0ef',
  text: '#21201c',
  // Soft text: neutral-10 (slate-10). Used for the inactive tab tint.
  muted: '#80838d',
  border: '#dad9d6',
  // Accent is neutral and high-contrast: neutral-12 (slate-12). Darkish in light mode.
  accent: '#1c2024',
};

// Radix sand scale (dark): 1, 2, 3, 12, 11, 6.
export const darkColors: ThemeColors = {
  bg: '#111110',
  surface: '#191918',
  surface2: '#222221',
  text: '#eeeeec',
  // Soft text: neutral-10 (slate-10). Used for the inactive tab tint.
  muted: '#777b84',
  border: '#3b3a37',
  // neutral-12 (slate-12). Whiteish in dark mode.
  accent: '#edeef0',
};

export function useThemeColors(): ThemeColors {
  // Read Uniwind's active theme, not useColorScheme(). Uniwind.setTheme() notifies its
  // subscribers synchronously, so the nav chrome flips in the same pass as the className
  // views; useColorScheme() only updates on the async native Appearance event, which lagged.
  return useUniwind().theme === 'dark' ? darkColors : lightColors;
}
