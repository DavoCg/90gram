import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../src/components/AppHeader';
import { Button } from '../src/components/button';
import { Input } from '../src/components/input';
import { Text } from '../src/components/text';
import { ActivityIndicator, View } from '../src/theme/uniwind';
import { useMyProfile, useUpdateProfile } from '../src/api/hooks';

// Edit the signed-in user's display name, bio, and avatar URL. Username is changed elsewhere (it is
// the unique handle); this screen edits the free-form display fields and pops back on save. Lives at
// the root (a sibling of the tab shell, like settings) so opening it slides a full screen OVER the
// tabs and the mini-player rather than pushing within the Profile stack.
export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: profile, isLoading } = useMyProfile();
  const updateProfile = useUpdateProfile();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      displayName: profile?.displayName ?? '',
      bio: profile?.bio ?? '',
      avatarUrl: profile?.avatarUrl ?? '',
    },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await updateProfile.mutateAsync({
          // Empty fields clear the value (null), a non-empty trimmed string sets it.
          displayName: value.displayName.trim() || null,
          bio: value.bio.trim() || null,
          avatarUrl: value.avatarUrl.trim() || null,
        });
        router.back();
      } catch {
        setServerError('Could not save your profile. Check the avatar URL and try again.');
      }
    },
  });

  if (isLoading || !profile) {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader title="Edit profile" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Edit profile" />
      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <View className="flex-1 px-6 pt-4" style={{ paddingBottom: insets.bottom + 16 }}>
            <form.Field name="displayName">
              {(field) => (
                <Input
                  label="Display name"
                  size="lg"
                  placeholder="Your name"
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  onBlur={field.handleBlur}
                  autoCapitalize="words"
                  maxLength={50}
                  editable={!isSubmitting}
                />
              )}
            </form.Field>

            <View className="mt-4">
              <form.Field name="bio">
                {(field) => (
                  <Input
                    label="Bio"
                    size="lg"
                    placeholder="Tell people what you dig"
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    onBlur={field.handleBlur}
                    multiline
                    maxLength={300}
                    editable={!isSubmitting}
                  />
                )}
              </form.Field>
            </View>

            <View className="mt-4">
              <form.Field name="avatarUrl">
                {(field) => (
                  <Input
                    label="Avatar URL"
                    size="lg"
                    placeholder="https://..."
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    onBlur={field.handleBlur}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    inputMode="url"
                    editable={!isSubmitting}
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
                label="Save"
                layout="flex"
                loading={isSubmitting}
                disabled={isSubmitting || !canSubmit}
                onPress={() => void form.handleSubmit()}
              />
            </KeyboardStickyView>
          </View>
        )}
      </form.Subscribe>
    </View>
  );
}
