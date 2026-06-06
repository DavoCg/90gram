import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { use$ } from '@legendapp/state/react';
import { User } from 'lucide-react-native';
import type { VinylSummaryDto } from '@getvinyls/api-client';
import { ActivityIndicator, Pressable, View } from '../../../src/theme/uniwind';
import { Text } from '../../../src/components/text';
import { useVinyls } from '../../../src/api/hooks';
import { VinylRow } from '../../../src/components/VinylRow';
import { AppHeader } from '../../../src/components/AppHeader';
import { useThemeColors } from '../../../src/theme/colors';
import { player$ } from '../../../src/audio/store';

// The header user button (top-right): opens the settings page within the Home stack.
function HeaderUserButton() {
  const router = useRouter();
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={() => router.push('/settings')}
      hitSlop={8}
      className="-mr-2 h-9 w-9 items-center justify-center"
    >
      <User color={colors.text} size={24} />
    </Pressable>
  );
}

// Leaves room at the bottom of the list for the floating mini-player + the tab bar.
const LIST_BOTTOM_PADDING = 140;

export default function HomeScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useVinyls();
  // The current vinyl is whichever vinyl the playing track belongs to.
  const currentVinylId = use$(player$.track)?.vinylId;
  // Follow play/pause intent so the row indicator does not flash while a tapped track buffers.
  const playWhenReady = use$(player$.playWhenReady);

  // Tapping a vinyl opens its detail sheet (the Vinyl page), where playback is started.
  const onPressVinyl = useCallback(
    (vinyl: VinylSummaryDto) => {
      router.push(`/vinyl/${vinyl.id}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: VinylSummaryDto }) => (
      <VinylRow
        vinyl={item}
        isCurrent={item.id === currentVinylId}
        isPlaying={playWhenReady}
        onPress={onPressVinyl}
      />
    ),
    [currentVinylId, playWhenReady, onPressVinyl],
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader title="Home" showBack={false} right={<HeaderUserButton />} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
          <Text color="neutral-soft" className="mt-3">
            Loading records…
          </Text>
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader title="Home" showBack={false} right={<HeaderUserButton />} />
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text align="center">Could not reach the API.</Text>
          <Text size="sm" color="neutral-soft" align="center">
            Is it running? Check EXPO_PUBLIC_API_BASE_URL.
          </Text>
          <Pressable
            onPress={() => void refetch()}
            className="rounded-full curve-continuous bg-accent px-5 py-2"
          >
            <Text color="white">Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Home" showBack={false} right={<HeaderUserButton />} />
      <FlashList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        extraData={`${currentVinylId ?? ''}:${String(playWhenReady)}`}
        contentContainerStyle={{ paddingBottom: LIST_BOTTOM_PADDING }}
      />
    </View>
  );
}
