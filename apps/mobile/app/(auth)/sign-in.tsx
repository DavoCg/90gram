import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInput, View } from '../../src/theme/uniwind';
import { Text } from '../../src/components/text';
import { Button } from '../../src/components/button';
import { useThemeColors } from '../../src/theme/colors';
import { authClient } from '../../src/auth/client';

// Passwordless sign-in. Two steps in one screen: enter an email to receive a one-time code, then
// enter the code to sign in. On success the better-auth session updates and the root layout's auth
// gate redirects into the app, so there is no manual navigation here.
type Step = 'email' | 'otp';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
      email: trimmed,
      type: 'sign-in',
    });
    setBusy(false);
    if (sendError) {
      setError(sendError.message ?? 'Could not send the code. Try again.');
      return;
    }
    setEmail(trimmed);
    setOtp('');
    setStep('otp');
  };

  const verify = async () => {
    if (otp.trim().length < 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: verifyError } = await authClient.signIn.emailOtp({ email, otp: otp.trim() });
    setBusy(false);
    if (verifyError) {
      setError(verifyError.message ?? 'That code did not work. Try again.');
    }
    // On success the session listener flips and the root gate navigates away.
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
              : `We sent a 6-digit code to ${email}.`}
          </Text>
        </View>

        {step === 'email' ? (
          <TextInput
            className="h-14 rounded-2xl curve-continuous border-hairline border-border bg-surface-2 px-4 text-lg"
            style={{ color: colors.text }}
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            selectionColor={colors.accent}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            returnKeyType="send"
            editable={!busy}
            onSubmitEditing={() => void sendCode()}
          />
        ) : (
          <TextInput
            className="h-14 rounded-2xl curve-continuous border-hairline border-border bg-surface-2 px-4 text-center text-2xl tracking-[8px]"
            style={{ color: colors.text }}
            placeholder="000000"
            placeholderTextColor={colors.muted}
            selectionColor={colors.accent}
            value={otp}
            onChangeText={(text) => {
              setOtp(text.replace(/[^0-9]/g, '').slice(0, 6));
              setError(null);
            }}
            keyboardType="number-pad"
            inputMode="numeric"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={6}
            returnKeyType="done"
            editable={!busy}
            autoFocus
            onSubmitEditing={() => void verify()}
          />
        )}

        {error ? (
          <Text size="sm" color="critical" className="mt-3">
            {error}
          </Text>
        ) : null}

        <View className="mt-6 gap-3">
          {step === 'email' ? (
            <Button
              label="Send code"
              color="accent"
              layout="flex"
              loading={busy}
              disabled={busy}
              onPress={() => void sendCode()}
            />
          ) : (
            <>
              <Button
                label="Verify and sign in"
                color="accent"
                layout="flex"
                loading={busy}
                disabled={busy}
                onPress={() => void verify()}
              />
              <Button
                label="Use a different email"
                variant="ghost"
                color="neutral"
                layout="flex"
                disabled={busy}
                onPress={() => {
                  setStep('email');
                  setOtp('');
                  setError(null);
                }}
              />
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
