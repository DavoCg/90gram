import { useState } from 'react';
import { Switch } from 'react-native';
import { Pressable, View } from '../../../src/theme/uniwind';
import { Text } from '../../../src/components/text';
import { Button } from '../../../src/components/button';
import { AppHeader } from '../../../src/components/AppHeader';
import { CheckForUpdatesRow } from '../../../src/components/check-for-updates-row';
import { toast } from '../../../src/components/toast';
import { useThemeColors } from '../../../src/theme/colors';
import { useDarkMode } from '../../../src/theme/theme';
import { authClient } from '../../../src/auth/client';

// User/settings page, pushed on top of the Home stack from the header user button so the tab bar
// and the global mini-player stay visible (same pattern as the vinyl detail screen). Scaffolded
// as labelled sections of rows; add new settings by dropping rows into a section.
export default function SettingsScreen() {
  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Settings" showBack />
      <View className="gap-6 px-4 pt-4">
        <SettingsSection title="Account">
          <AccountRow />
          <SignOutRow />
        </SettingsSection>
        <SettingsSection title="Appearance">
          <DarkModeRow />
        </SettingsSection>
        <SettingsSection title="About">
          <CheckForUpdatesRow />
        </SettingsSection>
        <SettingsSection title="Developer">
          <ToastDemoRow />
        </SettingsSection>
      </View>
    </View>
  );
}

// A labelled group of settings rows, rendered as a rounded surface card.
function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text
        size="sm"
        weight="semibold"
        color="neutral-soft"
        transform="uppercase"
        className="mb-2 px-1"
      >
        {title}
      </Text>
      <View className="overflow-hidden rounded-2xl curve-continuous border-hairline border-border bg-surface-2">
        {children}
      </View>
    </View>
  );
}

// The signed-in account: shows the user's email. Sourced from the better-auth session so it stays
// in sync with sign-in/sign-out without any extra wiring.
function AccountRow() {
  const { data: session } = authClient.useSession();
  return (
    <View className="border-b border-border px-4 py-3.5">
      <Text size="sm" color="neutral-soft">
        Signed in as
      </Text>
      <Text weight="semibold" className="mt-0.5">
        {session?.user.email ?? 'Unknown'}
      </Text>
    </View>
  );
}

// Sign out: clears the session (and the SecureStore token). The root auth gate then redirects to
// the sign-in screen, so no manual navigation is needed here.
function SignOutRow() {
  const [busy, setBusy] = useState(false);
  return (
    <Pressable
      disabled={busy}
      onPress={() => {
        setBusy(true);
        void authClient.signOut().finally(() => setBusy(false));
      }}
      className="px-4 py-3.5"
    >
      <Text weight="semibold" color="critical">
        Sign out
      </Text>
    </Pressable>
  );
}

// Example trigger for the design-system toast (sonner-native). Fires a success toast with a
// description and an action so the themed surface, typography, icon, and button styling are all
// visible at once. Handy as a living reference for how to call `toast` from anywhere in the app.
function ToastDemoRow() {
  return (
    <View className="px-4 py-3.5">
      <Text weight="semibold">Toasts</Text>
      <Text size="sm" color="neutral-soft" className="mt-0.5 mb-3">
        Preview a design-system toast
      </Text>
      <Button
        label="Show toast"
        variant="soft"
        color="accent"
        layout="flex"
        size="sm"
        onPress={() =>
          toast.success('Added to your collection', {
            description: 'Pink Floyd - The Dark Side of the Moon',
            action: { label: 'Undo', onClick: () => toast('Removed again') },
          })
        }
      />
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
