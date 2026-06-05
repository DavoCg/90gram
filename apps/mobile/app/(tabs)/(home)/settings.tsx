import { Switch } from 'react-native';
import { View } from '../../../src/theme/uniwind';
import { Text } from '../../../src/components/text';
import { AppHeader } from '../../../src/components/AppHeader';
import { useThemeColors } from '../../../src/theme/colors';
import { useDarkMode } from '../../../src/theme/theme';

// User/settings page, pushed on top of the Home stack from the header user button so the tab bar
// and the global mini-player stay visible (same pattern as the vinyl detail screen). Scaffolded
// as labelled sections of rows; add new settings by dropping rows into a section.
export default function SettingsScreen() {
  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Settings" showBack />
      <View className="px-4 pt-4">
        <SettingsSection title="Appearance">
          <DarkModeRow />
        </SettingsSection>
      </View>
    </View>
  );
}

// A labelled group of settings rows, rendered as a rounded surface card.
function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text size="sm" weight="semibold" color="neutral-soft" transform="uppercase" className="mb-2 px-1">
        {title}
      </Text>
      <View className="overflow-hidden rounded-2xl curve-continuous border-hairline border-border bg-surface-2">
        {children}
      </View>
    </View>
  );
}

// The dark-mode toggle. Flipping it persists the choice (MMKV) and switches the live Uniwind
// theme immediately; the rest of the app re-renders through Uniwind / Appearance.
function DarkModeRow() {
  const { isDark, setDarkMode } = useDarkMode();
  const colors = useThemeColors();

  return (
    <View className="flex-row items-center justify-between px-4 py-3.5">
      <View className="flex-1 pr-4">
        <Text weight="semibold">Dark mode</Text>
        <Text size="sm" color="neutral-soft" className="mt-0.5">
          Use a dark color scheme
        </Text>
      </View>
      <Switch
        value={isDark}
        onValueChange={setDarkMode}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}
