import { useCallback } from 'react';
import { RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LegendList, type LegendListRenderItemProps } from '@legendapp/list/react-native';
import { use$ } from '@legendapp/state/react';
import { MapPin } from 'lucide-react-native';
import type { ShopDetailDto, VinylSummaryDto } from '@getvinyls/api-client';
import { ActivityIndicator, View } from '../theme/uniwind';
import { Text } from '../components/text';
import { PressableScale } from '../components/pressable-scale';
import { VinylRow, VINYL_ROW_ESTIMATED_HEIGHT } from '../components/VinylRow';
import { ListFooterLoader } from '../components/list-footer-loader';
import { AppHeader } from '../components/AppHeader';
import { useShop, useShopVinyls } from '../api/hooks';
import { useThemeColors } from '../theme/colors';
import { useScreenRefresh } from '../hooks/use-screen-refresh';
import { player$ } from '../audio/store';

// Leaves room at the bottom of the list for the floating mini-player + the tab bar.
const LIST_BOTTOM_PADDING = 140;

// The shop's identity block (name, address, country): the list header above its vinyls.
function ShopHeader({ shop }: { shop: ShopDetailDto }) {
  const colors = useThemeColors();
  const location = [shop.address, shop.country].filter((part): part is string => Boolean(part)).join(' · ');
  const count = shop.vinylCount;
  return (
    <View className="px-6 pb-4 pt-1">
      <Text size="2xl" weight="bold">
        {shop.name}
      </Text>
      {location ? (
        <View className="mt-2 flex-row items-center gap-1.5">
          <MapPin color={colors.muted} size={14} />
          <Text size="sm" color="neutral-soft" className="flex-1">
            {location}
          </Text>
        </View>
      ) : null}
      <Text size="sm" color="neutral-soft" className="mt-3">
        {count === 0 ? 'No records listed yet' : count === 1 ? '1 record' : `${count} records`}
      </Text>
    </View>
  );
}

// The shop page. Shows the shop's name and address, then the vinyls available there. Pushes on top
// of whichever tab stack opened it (so the tab bar and mini-player stay visible).
export default function ShopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: shop, isLoading, isError, refetch } = useShop(id ?? '');
  const {
    data: vinyls,
    refetch: refetchVinyls,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useShopVinyls(id ?? '');
  const router = useRouter();
  const colors = useThemeColors();
  // A pull refreshes both the shop header and its vinyl listing.
  const { refreshing, handleRefresh } = useScreenRefresh(() =>
    Promise.all([refetch(), refetchVinyls()]),
  );
  // The current vinyl is whichever vinyl the playing track belongs to.
  const currentVinylId = use$(player$.track)?.vinylId;
  // Follow play/pause intent so the row indicator does not flash while a tapped track buffers.
  const playWhenReady = use$(player$.playWhenReady);

  // This screen is shared across tab stacks (Home, Favorites), so open a record at the sibling
  // `vinyl/[id]` RELATIVE to the current route, keeping the push inside whichever stack opened the
  // shop. An absolute `/vinyl/[id]` would always resolve to the Home stack and jump to Home.
  const onPressVinyl = useCallback(
    (vinyl: VinylSummaryDto) => {
      router.push(`../vinyl/${vinyl.id}`);
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

  if (isLoading || !shop) {
    if (isError) {
      return (
        <View className="flex-1 bg-bg">
          <AppHeader />
          <View className="flex-1 items-center justify-center gap-3 px-6">
            <Text align="center">Could not load this shop.</Text>
            <PressableScale
              onPress={() => void refetch()}
              className="rounded-full curve-continuous bg-accent px-5 py-2"
            >
              <Text color="white">Retry</Text>
            </PressableScale>
          </View>
        </View>
      );
    }
    return (
      <View className="flex-1 bg-bg">
        <AppHeader />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader />
      <LegendList
        data={vinyls ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        recycleItems
        estimatedItemSize={VINYL_ROW_ESTIMATED_HEIGHT}
        ListHeaderComponent={<ShopHeader shop={shop} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        extraData={`${currentVinylId ?? ''}:${String(playWhenReady)}`}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={<ListFooterLoader loading={isFetchingNextPage} />}
        contentContainerStyle={{ paddingBottom: LIST_BOTTOM_PADDING }}
      />
    </View>
  );
}
