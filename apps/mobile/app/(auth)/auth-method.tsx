import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Apple, ChevronRight, Mail } from 'lucide-react-native';
import { Pressable, View } from '../../src/theme/uniwind';
import { useThemeColors } from '../../src/theme/colors';
import { toast } from '../../src/components/toast';
import { Text } from '../../src/components/text';

interface MethodRowProps {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}

function MethodRow({ icon, label, onPress }: MethodRowProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl curve-continuous border-hairline border-border bg-surface-2 px-4 py-3.5"
    >
      <View className="size-9 items-center justify-center rounded-full bg-surface">{icon}</View>
      <Text weight="semibold" className="flex-1">
        {label}
      </Text>
      <ChevronRight color="#9ca3af" size={18} />
    </Pressable>
  );
}

// The "Create account" entry sheet, presented as a native formSheet (see app/(auth)/_layout.tsx).
// Email is the real passwordless path (we replace this sheet with the email step so a back gesture
// returns to welcome, not the sheet); Google and Apple are stubs (a "coming soon" toast) until OAuth
// providers are wired into better-auth. Replaces the old @swmansion AuthMethodSheet.
export default function AuthMethodScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const comingSoon = (provider: string) => {
    router.back();
    toast.info(`${provider} sign-in is coming soon`, { description: 'Use your email for now.' });
  };

  return (
    <View className="bg-surface px-4 pt-4" style={{ paddingBottom: insets.bottom + 16 }}>
      <Text size="xl" weight="bold" className="mb-1 px-1">
        Create your account
      </Text>
      <Text size="sm" color="neutral-soft" className="mb-4 px-1">
        Choose how you want to get started.
      </Text>

      <View className="gap-2.5">
        <MethodRow
          icon={<Mail color={colors.text} size={20} />}
          label="Continue with email"
          onPress={() => router.replace({ pathname: '/email', params: { intent: 'signup' } })}
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

      <Text size="xs" color="neutral-soft" align="center" className="mt-5 px-4" multiline>
        By creating an account you agree to our Terms and Privacy Policy.
      </Text>
    </View>
  );
}
