import { useState } from 'react';
import { Alert, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from '../src/theme/uniwind';
import { Text } from '../src/components/text';
import { Button } from '../src/components/button';
import { AppHeader } from '../src/components/AppHeader';
import { CheckForUpdatesRow } from '../src/components/check-for-updates-row';
import { CurrencySettingRow } from '../src/components/currency-setting-row';
import { LanguageSettingRow } from '../src/components/language-setting-row';
import { toast } from '../src/components/toast';
import { useThemeColors } from '../src/theme/colors';
import { useDarkMode } from '../src/theme/theme';
import { authClient } from '../src/auth/client';

// User/settings page. Lives at the root (not inside the (tabs) tree) so pushing it from the header
// user button slides it in from the right ON TOP OF the tab bar, covering the bottom tabs (and the
// mini-player, which the (tabs) layout owns), so there is no floating player to clear here. The
// sections scroll so they stay reachable on shorter screens (and once more sections are added).
// Scaffolded as labelled sections of rows; add new settings by dropping rows into a section.
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('settings');
  return (
    <View className="flex-1 bg-bg">
      <AppHeader title={t('title')} showBack />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        contentContainerClassName="gap-6 px-4 pt-4"
      >
        <SettingsSection title={t('sections.account')}>
          <AccountRow />
          <SignOutRow />
        </SettingsSection>
        <SettingsSection title={t('sections.preferences')}>
          <LanguageSettingRow />
          <CurrencySettingRow />
        </SettingsSection>
        <SettingsSection title={t('sections.appearance')}>
          <DarkModeRow />
        </SettingsSection>
        <SettingsSection title={t('sections.about')}>
          <CheckForUpdatesRow />
        </SettingsSection>
        <SettingsSection title={t('sections.developer')}>
          <ToastDemoRow />
        </SettingsSection>
      </ScrollView>
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
      <View className="overflow-hidden rounded-2xl curve-continuous bg-surface">
        {children}
      </View>
    </View>
  );
}

// The signed-in account: shows the user's email. Sourced from the better-auth session so it stays
// in sync with sign-in/sign-out without any extra wiring.
function AccountRow() {
  const { data: session } = authClient.useSession();
  const { t } = useTranslation('settings');
  return (
    <View className="border-b border-separator px-4 py-3.5">
      <Text size="sm" color="neutral-soft">
        {t('account.signedInAs')}
      </Text>
      <Text weight="semibold" className="mt-0.5">
        {session?.user.email ?? t('account.unknown')}
      </Text>
    </View>
  );
}

// Sign out: clears the session (and the SecureStore token). The root auth gate then redirects to
// the sign-in screen, so no manual navigation is needed here. Tapping the row first raises the
// native confirmation alert (same pattern as deleting a collection); only the destructive action
// commits the sign-out, so an accidental tap is harmless.
function SignOutRow() {
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  return (
    <Pressable
      disabled={busy}
      onPress={() => {
        Alert.alert(
          t('account.signOutConfirmTitle'),
          t('account.signOutConfirmDescription'),
          [
            { text: tc('actions.cancel'), style: 'cancel' },
            {
              text: t('account.signOutAction'),
              style: 'destructive',
              onPress: () => {
                setBusy(true);
                void authClient.signOut().finally(() => setBusy(false));
              },
            },
          ],
        );
      }}
      className="px-4 py-3.5"
    >
      <Text weight="semibold" color="critical">
        {t('account.signOut')}
      </Text>
    </Pressable>
  );
}

// Example trigger for the design-system toast. Fires a success toast with a
// description and an action so the themed surface, typography, icon, and button styling are all
// visible at once. Handy as a living reference for how to call `toast` from anywhere in the app.
function ToastDemoRow() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  return (
    <View className="px-4 py-3.5">
      <Text weight="semibold">{t('toasts.title')}</Text>
      <Text size="sm" color="neutral-soft" className="mt-0.5 mb-3">
        {t('toasts.subtitle')}
      </Text>
      <Button
        label={t('toasts.button')}
        variant="soft"
        color="accent"
        layout="flex"
        size="sm"
        onPress={() =>
          toast.success(t('toasts.successTitle'), {
            description: t('toasts.successDescription'),
            action: { label: tc('actions.undo'), onClick: () => toast(t('toasts.removed')) },
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
  const { t } = useTranslation('settings');

  return (
    <View className="flex-row items-center justify-between px-4 py-3.5">
      <View className="flex-1 pr-4">
        <Text weight="semibold">{t('darkMode.title')}</Text>
        <Text size="sm" color="neutral-soft" className="mt-0.5">
          {t('darkMode.subtitle')}
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
