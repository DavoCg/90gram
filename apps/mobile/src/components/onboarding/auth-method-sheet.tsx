import type { ReactNode } from 'react';
import { StyleSheet, View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModalBottomSheet } from '@swmansion/react-native-bottom-sheet';
import { Apple, ChevronRight, Mail } from 'lucide-react-native';
import { Pressable, View } from '../../theme/uniwind';
import { useThemeColors } from '../../theme/colors';
import { toast } from '../toast';
import { Text } from '../text';

interface AuthMethodSheetProps {
  open: boolean;
  onClose: () => void;
  // Fired when the user picks "Continue with email". The caller navigates to the email screen.
  onSelectEmail: () => void;
}

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

// The "Create account" entry sheet. Email is the real passwordless path; Google and Apple are
// presented as stubs (a "coming soon" toast) until OAuth providers are wired into better-auth.
export function AuthMethodSheet({ open, onClose, onSelectEmail }: AuthMethodSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const comingSoon = (provider: string) => {
    onClose();
    toast.info(`${provider} sign-in is coming soon`, { description: 'Use your email for now.' });
  };

  return (
    <ModalBottomSheet
      index={open ? 1 : 0}
      onIndexChange={(i) => {
        if (i === 0) onClose();
      }}
      detents={[0, 'content']}
      scrimColor="rgba(0, 0, 0, 0.5)"
      surface={
        <RNView
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderCurve: 'continuous',
            },
          ]}
        />
      }
    >
      <View className="px-4 pt-2.5" style={{ paddingBottom: insets.bottom + 16 }}>
        <RNView
          style={{
            alignSelf: 'center',
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            marginBottom: 12,
          }}
        />
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
            onPress={() => {
              onClose();
              onSelectEmail();
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

        <Text size="xs" color="neutral-soft" align="center" className="mt-5 px-4" multiline>
          By creating an account you agree to our Terms and Privacy Policy.
        </Text>
      </View>
    </ModalBottomSheet>
  );
}
