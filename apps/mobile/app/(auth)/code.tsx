import { useState } from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useForm } from '@tanstack/react-form';
import { View } from '../../src/theme/uniwind';
import { AppHeader } from '../../src/components/AppHeader';
import { Text } from '../../src/components/text';
import { OTPInput, type OTPInputState } from '../../src/components/otp-input';
import { toast } from '../../src/components/toast';
import { authClient } from '../../src/auth/client';

// Step 2 of the passwordless flow: verify the 6-digit code. On success the better-auth session
// updates and the root layout's auth gate redirects into the app (no manual navigation here).
export default function CodeScreen() {
  const insets = useSafeAreaInsets();
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { code: '' },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const { error } = await authClient.signIn.emailOtp({
        email: email.trim(),
        otp: value.code.trim(),
      });
      if (error) {
        setServerError(error.message ?? 'That code did not work. Try again.');
      }
      // On success the session listener flips and the root gate navigates away.
    },
  });

  const resend = async () => {
    setServerError(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: 'sign-in',
    });
    toast[error ? 'error' : 'success'](
      error ? 'Could not resend the code.' : 'A new code is on its way.',
    );
  };

  return (
    <View className="flex-1 bg-bg" style={{ paddingBottom: insets.bottom }}>
      {/* Override the landing's light status bar; these screens have a light background. */}
      <StatusBar style="auto" />
      <AppHeader showBack />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View className="flex-1 px-6">
          <View className="mt-2 mb-8">
            <Text size="3xl" weight="bold">
              Enter your code
            </Text>
            <Text color="neutral-soft" className="mt-2" multiline>
              We sent a 6-digit code to <Text weight="semibold">{email}</Text>.
            </Text>
          </View>

          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => {
              const otpState: OTPInputState = isSubmitting
                ? 'loading'
                : serverError
                  ? 'error'
                  : 'idle';
              return (
                <>
                  <form.Field
                    name="code"
                    validators={{
                      onChange: ({ value }) =>
                        value.trim().length === 6
                          ? undefined
                          : 'Enter the 6-digit code from your email.',
                    }}
                  >
                    {(field) => (
                      <OTPInput
                        value={field.state.value}
                        onChange={field.handleChange}
                        maxLength={6}
                        placeholder="000000"
                        placeholderChar="0"
                        autoFocus
                        state={otpState}
                        onComplete={() => void form.handleSubmit()}
                      />
                    )}
                  </form.Field>

                  {serverError ? (
                    <Text size="sm" color="critical" align="center" className="mt-4">
                      {serverError}
                    </Text>
                  ) : null}

                  <View className="mt-6 flex-row items-center justify-center gap-2">
                    <Text color="neutral-soft">Didn't get it?</Text>
                    <Text
                      weight="semibold"
                      color={isSubmitting ? 'neutral-disabled' : 'accent'}
                      onPress={isSubmitting ? undefined : () => void resend()}
                    >
                      Resend
                    </Text>
                  </View>
                </>
              );
            }}
          </form.Subscribe>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
