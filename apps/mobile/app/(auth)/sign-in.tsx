import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm } from '@tanstack/react-form';
import { View } from '../../src/theme/uniwind';
import { Text } from '../../src/components/text';
import { Button } from '../../src/components/button';
import { Input } from '../../src/components/input';
import { OTPInput, type OTPInputState } from '../../src/components/otp-input';
import { authClient } from '../../src/auth/client';

// Passwordless sign-in. Two steps in one screen, each its own TanStack Form: enter an email to
// receive a one-time code, then enter the 6-digit code to sign in. On success the better-auth
// session updates and the root layout's auth gate redirects into the app (no manual navigation).
type Step = 'email' | 'otp';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('email');
  // Server-side errors from better-auth (field-level validation lives on the forms themselves).
  const [serverError, setServerError] = useState<string | null>(null);

  const emailForm = useForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email: value.email.trim(),
        type: 'sign-in',
      });
      if (error) {
        setServerError(error.message ?? 'Could not send the code. Try again.');
        return;
      }
      setStep('otp');
    },
  });

  const codeForm = useForm({
    defaultValues: { code: '' },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const { error } = await authClient.signIn.emailOtp({
        email: emailForm.state.values.email.trim(),
        otp: value.code.trim(),
      });
      if (error) {
        setServerError(error.message ?? 'That code did not work. Try again.');
      }
      // On success the session listener flips and the root gate navigates away.
    },
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View
        className="flex-1 justify-center bg-bg px-6"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <View className="mb-8">
          <Text size="3xl" weight="bold">
            {step === 'email' ? 'Sign in' : 'Check your email'}
          </Text>
          <Text color="neutral-soft" className="mt-2">
            {step === 'email'
              ? 'Enter your email and we will send you a one-time code.'
              : `We sent a 6-digit code to ${emailForm.state.values.email}.`}
          </Text>
        </View>

        {step === 'email' ? (
          <emailForm.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
            {([canSubmit, isSubmitting]) => (
              <>
                <emailForm.Field
                  name="email"
                  validators={{
                    onChange: ({ value }) =>
                      EMAIL_RE.test(value.trim()) ? undefined : 'Enter a valid email address.',
                  }}
                >
                  {(field) => {
                    const showError =
                      field.state.meta.isTouched && field.state.meta.errors.length > 0;
                    return (
                      <Input
                        size="lg"
                        placeholder="you@example.com"
                        value={field.state.value}
                        onChangeText={field.handleChange}
                        onBlur={field.handleBlur}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        keyboardType="email-address"
                        inputMode="email"
                        returnKeyType="send"
                        editable={!isSubmitting}
                        onSubmitEditing={() => void emailForm.handleSubmit()}
                        variant={showError ? 'error' : 'default'}
                        helperText={showError ? field.state.meta.errors.join(', ') : undefined}
                      />
                    );
                  }}
                </emailForm.Field>

                <View className="mt-6">
                  <Button
                    label="Send code"
                    color="accent"
                    layout="flex"
                    loading={isSubmitting}
                    disabled={isSubmitting || !canSubmit}
                    onPress={() => void emailForm.handleSubmit()}
                  />
                </View>
              </>
            )}
          </emailForm.Subscribe>
        ) : (
          <codeForm.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
            {([canSubmit, isSubmitting]) => {
              const otpState: OTPInputState = isSubmitting
                ? 'loading'
                : serverError
                  ? 'error'
                  : 'idle';
              return (
                <>
                  <codeForm.Field
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
                        onComplete={() => void codeForm.handleSubmit()}
                      />
                    )}
                  </codeForm.Field>

                  <View className="mt-6 gap-3">
                    <Button
                      label="Verify and sign in"
                      color="accent"
                      layout="flex"
                      loading={isSubmitting}
                      disabled={isSubmitting || !canSubmit}
                      onPress={() => void codeForm.handleSubmit()}
                    />
                    <Button
                      label="Use a different email"
                      variant="ghost"
                      color="neutral"
                      layout="flex"
                      disabled={isSubmitting}
                      onPress={() => {
                        setServerError(null);
                        codeForm.reset();
                        setStep('email');
                      }}
                    />
                  </View>
                </>
              );
            }}
          </codeForm.Subscribe>
        )}

        {serverError ? (
          <Text size="sm" color="critical" align="center" className="mt-4">
            {serverError}
          </Text>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
