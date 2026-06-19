import { useCallback } from 'react';
import { Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LegendList, type LegendListRenderItemProps } from '@legendapp/list/react-native';
import { Trash2, X } from 'lucide-react-native';
import type { VinylSummaryDto } from '@getvinyls/api-client';
import { ActivityIndicator, Pressable, View } from '../../../../src/theme/uniwind';
import { Text } from '../../../../src/components/text';
import { PressableScale } from '../../../../src/components/pressable-scale';
import { CoverArt } from '../../../../src/components/cover-art';
import { Avatar } from '../../../../src/components/avatar';
import { AppHeader } from '../../../../src/components/AppHeader';
import { IconButton } from '../../../../src/components/button';
import { ListFooterLoader } from '../../../../src/components/list-footer-loader';
import { VINYL_ROW_ESTIMATED_HEIGHT } from '../../../../src/components/VinylRow';
import { useThemeColors } from '../../../../src/theme/colors';
import { useScreenRefresh } from '../../../../src/hooks/use-screen-refresh';
import { formatPrice } from '../../../../src/currency';
import {
  useCollection,
  useCollectionVinyls,
  useDeleteCollection,
  useToggleCollectionVinyl,
} from '../../../../src/api/hooks';

const LIST_BOTTOM_PADDING = 140;

// A record row within a collection. Tap opens the record; the owner gets a trailing remove button.
function CollectionVinylRow({
  vinyl,
  isOwner,
  onPress,
  onRemove,
}: {
  vinyl: VinylSummaryDto;
  isOwner: boolean;
  onPress: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const colors = useThemeColors();
  const price = formatPrice(vinyl.lowestPrice, vinyl.currency);
  return (
    <PressableScale
      onPress={() => onPress(vinyl.id)}
      className="flex-row items-center gap-3 px-4 py-2 bg-bg"
    >
      <CoverArt uri={vinyl.coverArtUrl} size={54} radius={8} />
      <View className="flex-1">
        <Text numberOfLines={1} weight="semibold">
          {vinyl.title}
        </Text>
        <Text numberOfLines={1} size="sm" color="neutral-soft">
          {vinyl.artist}
          {vinyl.year ? ` · ${vinyl.year}` : ''}
        </Text>
      </View>
      {isOwner ? (
        <IconButton
          onPress={() => onRemove(vinyl.id)}
          variant="ghost"
          size="xs"
          hitSlop={8}
          accessibilityLabel="Remove from collection"
          icon={<X color={colors.muted} size={20} />}
        />
      ) : price ? (
        <Text size="sm">{price}</Text>
      ) : null}
    </PressableScale>
  );
}

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const collectionId = id ?? '';
  const router = useRouter();
  const colors = useThemeColors();
  const { data: collection, isLoading: metaLoading } = useCollection(collectionId);
  const {
    data: vinyls,
    isLoading: vinylsLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCollectionVinyls(collectionId);
  const deleteCollection = useDeleteCollection();
  const toggleVinyl = useToggleCollectionVinyl();
  const { refreshing, handleRefresh } = useScreenRefresh(refetch);

  const isOwner = collection?.owner.isMe ?? false;

  const onPressVinyl = useCallback(
    (vinylId: string) => router.push(`/profile/vinyl/${vinylId}`),
    [router],
  );
  const onRemoveVinyl = useCallback(
    (vinylId: string) => {
      toggleVinyl.mutate({ collectionId, vinylId, add: false });
    },
    [toggleVinyl, collectionId],
  );
  const onPressOwner = useCallback(() => {
    if (collection?.owner.username) router.push(`/profile/user/${collection.owner.username}`);
  }, [router, collection]);

  const onDelete = useCallback(() => {
    Alert.alert('Delete collection', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteCollection.mutate(collectionId, { onSuccess: () => router.back() });
        },
      },
    ]);
  }, [deleteCollection, collectionId, router]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: LegendListRenderItemProps<VinylSummaryDto>) => (
      <CollectionVinylRow
        vinyl={item}
        isOwner={isOwner}
        onPress={onPressVinyl}
        onRemove={onRemoveVinyl}
      />
    ),
    [isOwner, onPressVinyl, onRemoveVinyl],
  );

  if (metaLoading || !collection) {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  const records = vinyls ?? [];

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title={collection.name}
        right={
          isOwner ? (
            <IconButton
              onPress={onDelete}
              variant="ghost"
              size="xs"
              accessibilityLabel="Delete collection"
              icon={<Trash2 color={colors.text} size={20} />}
            />
          ) : undefined
        }
      />
      <LegendList
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        recycleItems
        estimatedItemSize={VINYL_ROW_ESTIMATED_HEIGHT}
        extraData={isOwner ? 'owner' : 'viewer'}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListHeaderComponent={
          <View className="px-4 pb-2 pt-1">
            {collection.description ? (
              <Text color="neutral-soft" multiline className="mb-3">
                {collection.description}
              </Text>
            ) : null}
            <Pressable onPress={onPressOwner} className="flex-row items-center gap-2">
              <Avatar
                uri={collection.owner.avatarUrl}
                name={collection.owner.displayName ?? collection.owner.username}
                size={28}
              />
              <Text size="sm" color="neutral-soft">
                by @{collection.owner.username ?? 'unknown'}
              </Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          vinylsLoading ? (
            <View className="items-center justify-center py-16">
              <ActivityIndicator />
            </View>
          ) : (
            <View className="items-center justify-center px-6 py-16">
              <Text color="neutral-soft" align="center" multiline>
                {isOwner
                  ? 'No records yet. Add some from a record page.'
                  : 'This collection is empty.'}
              </Text>
            </View>
          )
        }
        ListFooterComponent={<ListFooterLoader loading={isFetchingNextPage} />}
        contentContainerStyle={{ paddingBottom: LIST_BOTTOM_PADDING }}
      />
    </View>
  );
}
