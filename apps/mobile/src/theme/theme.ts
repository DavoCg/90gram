import { useCallback } from 'react';
import { Appearance } from 'react-native';
import { useMMKVBoolean } from 'react-native-mmkv';
import { Uniwind } from 'uniwind';
import { storage } from '../storage';

// App-wide dark-mode preference, persisted in MMKV. Uniwind drives the className theme via the
// @variant light/dark blocks in global.css; calling Uniwind.setTheme('dark'|'light') ALSO sets
// the native Appearance color scheme, so the JS color mirror (useThemeColors, used by the React
// Navigation chrome) follows automatically with no extra wiring.
const DARK_MODE_KEY = 'dark-mode';

const applyDarkMode = (isDark: boolean) => {
  Uniwind.setTheme(isDark ? 'dark' : 'light');
};

// Apply the saved theme once, before the first render, to avoid a flash. Called from the root
// layout module so it runs as the app boots. If the user has not made an explicit choice yet we
// leave Uniwind on its adaptive default, so a fresh install still follows the system scheme.
export const initializeTheme = () => {
  const stored = storage.getBoolean(DARK_MODE_KEY);
  if (stored === undefined) return;
  applyDarkMode(stored);
};

// Reactive hook for the settings toggle: reads the persisted preference (defaulting to the OS
// scheme) and writes both MMKV and the live Uniwind/Appearance theme.
export const useDarkMode = () => {
  const [stored, setStored] = useMMKVBoolean(DARK_MODE_KEY, storage);
  const isDark = stored ?? Appearance.getColorScheme() === 'dark';

  const setDarkMode = useCallback(
    (next: boolean) => {
      applyDarkMode(next);
      setStored(next);
    },
    [setStored],
  );

  return { isDark, setDarkMode } as const;
};
