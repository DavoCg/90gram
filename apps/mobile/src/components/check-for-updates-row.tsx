import Constants from 'expo-constants';
import { Check, RefreshCw } from 'lucide-react-native';
import { ActivityIndicator, Pressable, View } from '../theme/uniwind';
import { Text } from './text';
import { useThemeColors } from '../theme/colors';
import { useAppUpdates } from '../hooks/use-app-updates';

// Settings row that lets the user pull the latest over-the-air update on demand. Tapping it asks
// the EAS Update server (on the build's channel + runtime version) for a newer JS/asset bundle;
// if one exists it downloads and the app reloads into it, otherwise it confirms "Up to date".
// Mirrors the DarkModeRow layout so it sits naturally inside a SettingsSection.
export function CheckForUpdatesRow() {
  const { isEnabled, status, error, checkForUpdate } = useAppUpdates();
  const colors = useThemeColors();

  const busy = status === 'checking' || status === 'downloading';
  const subtitle = describeStatus({ isEnabled, status, error });

  return (
    <Pressable
      disabled={!isEnabled || busy}
      onPress={() => void checkForUpdate()}
      className="flex-row items-center justify-between px-4 py-3.5"
    >
      <View className="flex-1 pr-4">
        <Text weight="semibold">Check for updates</Text>
        <Text size="sm" color="neutral-soft" className="mt-0.5">
          {subtitle}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator color={colors.muted} />
      ) : status === 'upToDate' ? (
        <Check color={colors.accent} size={20} />
      ) : (
        <RefreshCw color={isEnabled ? colors.text : colors.muted} size={18} />
      )}
    </Pressable>
  );
}

// Map the check lifecycle to a short line under the title. Falls back to the app version so the
// row is informative even at rest.
function describeStatus({
  isEnabled,
  status,
  error,
}: {
  isEnabled: boolean;
  status: ReturnType<typeof useAppUpdates>['status'];
  error: string | null;
}): string {
  if (!isEnabled) return 'Not available in development';
  switch (status) {
    case 'checking':
      return 'Checking for updates...';
    case 'downloading':
      return 'Downloading update...';
    case 'upToDate':
      return "You're up to date";
    case 'error':
      return error ?? 'Could not check for updates';
    default:
      return `Version ${Constants.expoConfig?.version ?? '?'}`;
  }
}
