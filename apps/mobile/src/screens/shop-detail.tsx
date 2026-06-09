import { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { use$ } from '@legendapp/state/react';
import { MapPin } from 'lucide-react-native';
import type { ShopDetailDto, VinylSummaryDto } from '@getvinyls/api-client';
import { ActivityIndicator, View } from '../theme/uniwind';
import { Text } from '../components/text';
import { PressableScale } from '../components/pressable-scale';
import { VinylRow } from '../components/VinylRow';
import { AppHeader } from '../components/AppHeader';
import { useShop } from '../api/hooks';
import { useThemeColors } from '../theme/colors';
import { player$ } from '../audio/store';

// Leaves room at the bottom of the list for the floating mini-player + the tab bar.
const LIST_BOTTOM_PADDING = 140;

// The shop's identity block (name, address, country): the list header above its vinyls.
function ShopHeader({ shop }: { shop: ShopDetailDto }) {
  const colors = useThemeColors();
  const location = [shop.address, shop.country].filter((part): part is string => Boolean(part)).join(' · ');
  const count = shop.vinyls.length;
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
  const router = useRouter();
  // The current vinyl is whichever vinyl the playing track belongs to.
  const currentVinylId = use$(player$.track)?.vinylId;
  // Follow play/pause intent so the row indicator does not flash while a tapped track buffers.
  const playWhenReady = use$(player$.playWhenReady);

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
      <FlashList
        data={shop.vinyls}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={<ShopHeader shop={shop} />}
        extraData={`${currentVinylId ?? ''}:${String(playWhenReady)}`}
        contentContainerStyle={{ paddingBottom: LIST_BOTTOM_PADDING }}
      />
    </View>
  );
}
