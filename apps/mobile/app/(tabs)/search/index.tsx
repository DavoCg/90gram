import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { LegendList, type LegendListRenderItemProps } from '@legendapp/list/react-native';
import { use$ } from '@legendapp/state/react';
import { Search, X } from 'lucide-react-native';
import type { VinylSummaryDto } from '@getvinyls/api-client';
import { ActivityIndicator, Pressable, View } from '../../../src/theme/uniwind';
import { Text } from '../../../src/components/text';
import { Input } from '../../../src/components/input';
import { useVinylSearch } from '../../../src/api/hooks';
import { VinylRow, VINYL_ROW_ESTIMATED_HEIGHT } from '../../../src/components/VinylRow';
import { ListFooterLoader } from '../../../src/components/list-footer-loader';
import { AppHeader } from '../../../src/components/AppHeader';
import { useThemeColors } from '../../../src/theme/colors';
import { player$ } from '../../../src/audio/store';

// Leaves room at the bottom of the list for the floating mini-player + the tab bar.
const LIST_BOTTOM_PADDING = 140;
// Wait this long after the last keystroke before querying, so typing does not fire a request per
// character. Short enough to still feel instant.
const SEARCH_DEBOUNCE_MS = 250;

export default function SearchScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  // `text` is what the field shows (updates on every keystroke); `query` is the debounced value the
  // request actually uses. Trimming happens before the hook so " " never triggers a search.
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const handle = setTimeout(() => setQuery(text.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [text]);

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useVinylSearch(query);

  // The current vinyl is whichever vinyl the playing track belongs to (highlights its row).
  const currentVinylId = use$(player$.track)?.vinylId;
  const playWhenReady = use$(player$.playWhenReady);

  const onPressVinyl = useCallback(
    (vinyl: VinylSummaryDto) => {
      // Push onto the Search stack (not /vinyl/, which lives in the Home stack) so the record opens
      // on top of the results and the Search tab stays active.
      router.push(`/search/vinyl/${vinyl.id}`);
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

  const results = data ?? [];
  const hasQuery = query.length > 0;

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Search" showBack={false} />
      <View className="px-4 pb-2">
        <Input
          value={text}
          onChangeText={setText}
          placeholder="Title, artist, label…"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          startSlot={<Search size={18} />}
          endSlot={
            text.length > 0 ? (
              <Pressable onPress={() => setText('')} hitSlop={8}>
                <X size={18} color={colors.muted} />
              </Pressable>
            ) : undefined
          }
        />
      </View>

      {!hasQuery ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Search color={colors.muted} size={48} strokeWidth={1.5} />
          <Text size="sm" color="neutral-soft" align="center">
            Find records by title, artist, or label.
          </Text>
        </View>
      ) : isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center gap-2 px-8">
          <Text align="center">Search is unavailable.</Text>
          <Text size="sm" color="neutral-soft" align="center">
            Please try again in a moment.
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text size="sm" color="neutral-soft" align="center">
            No records match “{query}”.
          </Text>
        </View>
      ) : (
        <LegendList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          recycleItems
          estimatedItemSize={VINYL_ROW_ESTIMATED_HEIGHT}
          extraData={`${currentVinylId ?? ''}:${String(playWhenReady)}`}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={<ListFooterLoader loading={isFetchingNextPage} />}
          contentContainerStyle={{ paddingBottom: LIST_BOTTOM_PADDING }}
        />
      )}
    </View>
  );
}
