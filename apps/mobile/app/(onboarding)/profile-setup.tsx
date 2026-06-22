import { useForm } from '@tanstack/react-form';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X } from 'lucide-react-native';
import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/button';
import { Input } from '../../src/components/input';
import { Text } from '../../src/components/text';
import { View } from '../../src/theme/uniwind';
import { useThemeColors } from '../../src/theme/colors';
import { useClaimUsername, useUpdateProfile, useUsernameAvailable } from '../../src/api/hooks';

// Username rules mirror the server's UsernameSchema (3-20 chars, lowercase letters / digits /
// underscore). We lowercase as the user types so the field always shows the normalized handle.
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

// First-run profile setup: claim a unique username (with a live availability check) and optionally a
// display name. Claiming flips the auth gate, which navigates to the tabs (no manual redirect).
export default function ProfileSetupScreen() {
  const { t } = useTranslation('onboarding');
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const claimUsername = useClaimUsername();
  const updateProfile = useUpdateProfile();
  const [serverError, setServerError] = useState<string | null>(null);

  // Mirror the typed handle into local state so the debounced availability check lives at the top
  // level (hooks cannot run inside the field render-prop). `debounced` is what we actually query.
  const [typed, setTyped] = useState('');
  const [debounced, setDebounced] = useState('');
  const normalized = typed.trim().toLowerCase();
  const formatValid = USERNAME_RE.test(normalized);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(normalized), 350);
    return () => clearTimeout(t);
  }, [normalized]);

  const { data: availability, isFetching: checkingAvailability } = useUsernameAvailable(debounced);
  // Availability only counts once the format is valid and the debounce has caught up to the input.
  const checked = formatValid && availability?.username === normalized && !checkingAvailability;
  const taken = checked && availability?.available === false;
  const free = checked && availability?.available === true;

  const form = useForm({
    defaultValues: { username: '', displayName: '' },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await claimUsername.mutateAsync(value.username.trim().toLowerCase());
        const displayName = value.displayName.trim();
        if (displayName.length > 0) {
          await updateProfile.mutateAsync({ displayName });
        }
        // The auth gate observes the profile cache (now with a username) and swaps to the tabs.
      } catch (e) {
        setServerError(
          e instanceof Error && e.message === 'taken'
            ? t('profileSetup.errors.taken')
            : t('profileSetup.errors.save'),
        );
      }
    },
  });

  return (
    <View className="flex-1 bg-bg">
      <StatusBar style="auto" />
      <AppHeader showBack={false} />
      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <View className="flex-1 px-6" style={{ paddingBottom: insets.bottom + 16 }}>
            <View className="mt-2 mb-8">
              <Text size="3xl" weight="bold">
                {t('profileSetup.title')}
              </Text>
              <Text color="neutral-soft" className="mt-2" multiline>
                {t('profileSetup.subtitle')}
              </Text>
            </View>

            <form.Field
              name="username"
              validators={{
                onChange: ({ value }) =>
                  USERNAME_RE.test(value.trim().toLowerCase())
                    ? undefined
                    : t('profileSetup.username.formatError'),
              }}
            >
              {(field) => {
                const showFormatError =
                  field.state.meta.isTouched && field.state.value.length > 0 && !formatValid;
                const helperText = showFormatError
                  ? field.state.meta.errors.join(', ')
                  : taken
                    ? t('profileSetup.username.taken')
                    : free
                      ? t('profileSetup.username.available')
                      : undefined;
                return (
                  <Input
                    size="lg"
                    placeholder={t('profileSetup.username.placeholder')}
                    value={field.state.value}
                    onChangeText={(text) => {
                      const v = text.toLowerCase();
                      field.handleChange(v);
                      setTyped(v);
                    }}
                    onBlur={field.handleBlur}
                    autoFocus
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={20}
                    editable={!isSubmitting}
                    returnKeyType="next"
                    startSlot={
                      <Text size="lg" color="neutral-soft">
                        @
                      </Text>
                    }
                    endSlot={
                      checkingAvailability && formatValid ? null : free ? (
                        <Check color={colors.accent} size={20} />
                      ) : taken || showFormatError ? (
                        <X color={colors.muted} size={20} />
                      ) : null
                    }
                    variant={taken || showFormatError ? 'error' : 'default'}
                    helperText={helperText}
                  />
                );
              }}
            </form.Field>

            <View className="mt-4">
              <form.Field name="displayName">
                {(field) => (
                  <Input
                    size="lg"
                    placeholder={t('profileSetup.displayName.placeholder')}
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    onBlur={field.handleBlur}
                    autoCapitalize="words"
                    maxLength={50}
                    editable={!isSubmitting}
                    returnKeyType="done"
                    onSubmitEditing={() => void form.handleSubmit()}
                  />
                )}
              </form.Field>
            </View>

            {serverError ? (
              <Text size="sm" color="critical" className="mt-3">
                {serverError}
              </Text>
            ) : null}

            <KeyboardStickyView
              offset={{ closed: -insets.bottom - 16, opened: -16 }}
              style={{ marginTop: 'auto' }}
            >
              <Button
                label={t('profileSetup.continue')}
                layout="flex"
                loading={isSubmitting}
                disabled={isSubmitting || !canSubmit || taken}
                onPress={() => void form.handleSubmit()}
              />
            </KeyboardStickyView>
          </View>
        )}
      </form.Subscribe>
    </View>
  );
}
