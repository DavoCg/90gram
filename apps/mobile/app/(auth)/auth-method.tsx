import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Apple, ChevronRight, Mail } from 'lucide-react-native';
import { Pressable, View } from '../../src/theme/uniwind';
import { useThemeColors } from '../../src/theme/colors';
import { toast } from '../../src/components/toast';
import { Text } from '../../src/components/text';
import { FormSheetHeader } from '../../src/components/form-sheet-header';
import { SHEET_CONTENT_TOP, SHEET_PADDING_X } from '../../src/components/sheet';
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
  const { t } = useTranslation('auth');

  const comingSoon = (provider: string) => {
    router.back();
    toast.info(t('authMethod.comingSoon', { provider }), {
      description: t('authMethod.comingSoonDescription'),
    });
  };

  return (
    <>
      <FormSheetHeader
        title={t('authMethod.title')}
        subtitle={t('authMethod.subtitle')}
      />
      <View
        className="bg-surface"
        style={{
          paddingTop: SHEET_CONTENT_TOP,
          paddingBottom: bottomPadding,
          paddingHorizontal: SHEET_PADDING_X,
        }}
      >
        <View className="gap-2.5">
          <MethodRow
            icon={<Mail color={colors.text} size={20} />}
            label={t('authMethod.email')}
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
            label={t('authMethod.google')}
            onPress={() => comingSoon('Google')}
          />
          <MethodRow
            icon={<Apple color={colors.text} size={20} />}
            label={t('authMethod.apple')}
            onPress={() => comingSoon('Apple')}
          />
        </View>

        <Text size="xs" color="neutral-soft" align="center" className="mt-4" multiline>
          {t('authMethod.legal')}
        </Text>
      </View>
    </>
  );
}
