import { View } from '../theme/uniwind';
import { Text } from './text';

interface FormSheetHeaderProps {
  // The sheet's title (bold, primary line).
  title: string;
  // Optional secondary line under the title (a section label or a short description).
  subtitle?: string;
}

// Shared header for the native form sheets (currency, filter, auth-method). Marked
// collapsable={false} so react-native-screens keeps it as a real native view pinned above the
// sheet's ScrollView; without that the list renders over the header. The generous top padding clears
// the native grabber, and the surface background matches the sheet so the rounded corners read clean.
export function FormSheetHeader({ title, subtitle }: FormSheetHeaderProps) {
  return (
    <View collapsable={false} className="bg-surface px-5 pb-1 pt-8">
      <Text size="xl" weight="bold">
        {title}
      </Text>
      {subtitle ? (
        <Text size="sm" color="neutral-soft" className="mt-1">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
