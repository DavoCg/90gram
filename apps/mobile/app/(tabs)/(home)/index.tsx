import { useCallback } from 'react';
import { RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { LegendList, type LegendListRenderItemProps } from '@legendapp/list/react-native';
import { use$ } from '@legendapp/state/react';
import { User } from 'lucide-react-native';
import type { VinylSummaryDto } from '@getvinyls/api-client';
import { ActivityIndicator, Pressable, View } from '../../../src/theme/uniwind';
import { Text } from '../../../src/components/text';
import { useVinyls } from '../../../src/api/hooks';
import { VinylRow, VINYL_ROW_ESTIMATED_HEIGHT } from '../../../src/components/VinylRow';
import { ListFooterLoader } from '../../../src/components/list-footer-loader';
import { AppHeader } from '../../../src/components/AppHeader';
import { FilterBar } from '../../../src/components/filters/filter-bar';
import { filters$ } from '../../../src/components/filters/filters-store';
import { useThemeColors } from '../../../src/theme/colors';
import { useScreenRefresh } from '../../../src/hooks/use-screen-refresh';
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
  const colors = useThemeColors();
  // Applied genre filter (slugs), shared with the filter route via filters$ (it cannot receive an
  // onApply callback as a route). The filter sheet writes it on "Show results"; the feed reads it
  // here to build its query key.
  const selectedGenres = use$(filters$.genres);
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useVinyls(selectedGenres);
  const { refreshing, handleRefresh } = useScreenRefresh(refetch);
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
    ({ item }: LegendListRenderItemProps<VinylSummaryDto>) => (
      <VinylRow vinyl={item} isCurrent={item.id === currentVinylId} onPress={onPressVinyl} />
    ),
    [currentVinylId, onPressVinyl],
  );

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const hasFilters = selectedGenres.length > 0;

  // Header right: just the user button now. The filter affordance moved out of the header into the
  // sticky FilterBar below it.
  const headerRight = <HeaderUserButton />;

  // The sticky filter bar, pinned directly under the app header and above the list. Rendered in
  // every state so the filter affordance is always reachable, including while a filtered feed loads.
  const filterBar = (
    <FilterBar onPress={() => router.push('/filter')} activeCount={selectedGenres.length} />
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader title="Home" showBack={false} right={headerRight} />
        {filterBar}
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
        <AppHeader title="Home" showBack={false} right={headerRight} />
        {filterBar}
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text align="center">Could not reach the API.</Text>
          <Text size="sm" color="neutral-soft" align="center">
            Is it running? Check EXPO_PUBLIC_API_BASE_URL.
          </Text>
          <Pressable
            onPress={() => void refetch()}
            className="rounded-2xl curve-continuous bg-accent px-5 py-2"
          >
            <Text color="white">Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Home" showBack={false} right={headerRight} />
      {filterBar}
      <LegendList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        recycleItems
        estimatedItemSize={VINYL_ROW_ESTIMATED_HEIGHT}
        extraData={`${currentVinylId ?? ''}:${String(playWhenReady)}`}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          hasFilters ? (
            <View className="flex-1 items-center justify-center gap-3 px-6 pt-24">
              <Text align="center">No records match these filters.</Text>
              <Pressable
                onPress={() => filters$.genres.set([])}
                className="rounded-2xl curve-continuous bg-accent px-5 py-2"
              >
                <Text color="white">Clear filters</Text>
              </Pressable>
            </View>
          ) : null
        }
        ListFooterComponent={<ListFooterLoader loading={isFetchingNextPage} />}
        contentContainerStyle={{ paddingBottom: LIST_BOTTOM_PADDING }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      />
    </View>
  );
}
