import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Apple, ChevronRight, Mail } from 'lucide-react-native';
import { Pressable, View } from '../../src/theme/uniwind';
import { useThemeColors } from '../../src/theme/colors';
import { toast } from '../../src/components/toast';
import { Text } from '../../src/components/text';
import { FormSheetHeader } from '../../src/components/form-sheet-header';
import { useSheetBottomPadding } from '../../src/components/use-sheet-bottom-padding';
import { SHEET_DISMISS_DURATION } from '../../src/theme/motion';

interface MethodRowProps {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}

function MethodRow({ icon, label, onPress }: MethodRowProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl curve-continuous bg-surface-2 px-4 py-3.5"
    >
      <View className="size-9 items-center justify-center rounded-full bg-surface">{icon}</View>
      <Text weight="semibold" className="flex-1">
        {label}
      </Text>
      <ChevronRight color="#9ca3af" size={18} />
    </Pressable>
  );
}

// The "Create account" entry sheet, presented as a native form sheet (see app/(auth)/_layout.tsx).
// Email is the real passwordless path: picking it replaces this sheet with the email step (so Back
// from there returns to the welcome screen, matching the "Log in" flow). Google and Apple are stubs
// (a "coming soon" toast) until OAuth providers are wired into better-auth.
export default function AuthMethodSheet() {
  const router = useRouter();
  const bottomPadding = useSheetBottomPadding();
  const colors = useThemeColors();

  const comingSoon = (provider: string) => {
    router.back();
    toast.info(`${provider} sign-in is coming soon`, { description: 'Use your email for now.' });
  };

  return (
    <>
      <FormSheetHeader
        title="Create your account"
        subtitle="Choose how you want to get started."
      />
      <View className="bg-surface px-4 pt-3" style={{ paddingBottom: bottomPadding }}>
        <View className="gap-2.5">
          <MethodRow
            icon={<Mail color={colors.text} size={20} />}
            label="Continue with email"
            onPress={() => {
              // Close the sheet, then push the email step only once it has finished sliding away.
              // Doing both synchronously batches them into a single transition (no sheet dismiss, no
              // slide); the delay lets the sheet close first, then the email screen slides in.
              router.back();
              setTimeout(() => {
                router.push({ pathname: '/email', params: { intent: 'signup' } });
              }, SHEET_DISMISS_DURATION);
            }}
          />
          <MethodRow
            icon={
              <Text weight="bold" size="lg" className="text-[#4285F4]">
                G
              </Text>
            }
            label="Continue with Google"
            onPress={() => comingSoon('Google')}
          />
          <MethodRow
            icon={<Apple color={colors.text} size={20} />}
            label="Continue with Apple"
            onPress={() => comingSoon('Apple')}
          />
        </View>

        <Text size="xs" color="neutral-soft" align="center" className="mt-4 px-4" multiline>
          By creating an account you agree to our Terms and Privacy Policy.
        </Text>
      </View>
    </>
  );
}
