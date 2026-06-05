import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { use$ } from '@legendapp/state/react';
import type { VinylSummaryDto } from '@getvinyls/api-client';
import { ActivityIndicator, Pressable, Text, View } from '../../../src/theme/uniwind';
import { useVinyls } from '../../../src/api/hooks';
import { VinylRow } from '../../../src/components/VinylRow';
import { AppHeader } from '../../../src/components/AppHeader';
import { player$ } from '../../../src/audio/store';

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
        <AppHeader title="Home" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
          <Text className="mt-3 text-muted">Loading records…</Text>
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader title="Home" />
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-center text-text">Could not reach the API.</Text>
          <Text className="text-center text-sm text-muted">
            Is it running? Check EXPO_PUBLIC_API_BASE_URL.
          </Text>
          <Pressable
            onPress={() => void refetch()}
            className="rounded-full bg-accent px-5 py-2"
          >
            <Text className="text-surface">Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Home" />
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
