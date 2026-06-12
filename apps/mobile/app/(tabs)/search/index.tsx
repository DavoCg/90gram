import { useCallback, useEffect, useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
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
import { useThemeColors } from '../../../src/theme/colors';
import { player$ } from '../../../src/audio/store';
import { searchFocusRequest$ } from '../../../src/search/focus-signal';

// Leaves room at the bottom of the list for the floating mini-player + the tab bar.
const LIST_BOTTOM_PADDING = 140;

// Height of the "Search" title row, collapsed to 0 when the field is focused so the search bar
// rises to the top. Width reserved for the Cancel button that slides in to the field's right.
const TITLE_HEIGHT = 48;
const CANCEL_WIDTH = 76;
// Drives both the title collapse and the Cancel reveal. Short and eased so it feels snappy.
const FOCUS_TIMING = { duration: 220, easing: Easing.out(Easing.cubic) } as const;

export default function SearchScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  // 0 = idle (title visible, no Cancel), 1 = focused (title collapsed up, Cancel revealed). Driven
  // entirely on the UI thread from the field's focus/blur, so no per-frame React state.
  const focusProgress = useSharedValue(0);

  // The title row slides up and fades while its height collapses, reclaiming the space so the
  // search bar (and the results below it) rise to the top.
  const titleStyle = useAnimatedStyle(() => ({
    height: interpolate(focusProgress.value, [0, 1], [TITLE_HEIGHT, 0]),
    opacity: interpolate(focusProgress.value, [0, 1], [1, 0]),
    transform: [{ translateY: interpolate(focusProgress.value, [0, 1], [0, -TITLE_HEIGHT]) }],
  }));

  // Cancel grows in from zero width on the field's right; overflow-hidden clips its text while it
  // expands, and the flex-1 field shrinks to make room.
  const cancelStyle = useAnimatedStyle(() => ({
    width: interpolate(focusProgress.value, [0, 1], [0, CANCEL_WIDTH]),
    opacity: focusProgress.value,
  }));

  const onFocus = useCallback(() => {
    focusProgress.value = withTiming(1, FOCUS_TIMING);
  }, [focusProgress]);

  const onBlur = useCallback(() => {
    focusProgress.value = withTiming(0, FOCUS_TIMING);
  }, [focusProgress]);

  // `text` is what the field shows; `query` is what the request uses. No debounce: the API is fast
  // enough to query on every keystroke, and react-query caches each term (staleTime) so backspacing
  // to an earlier term is served from cache. Trimmed so " " never triggers a search.
  const [text, setText] = useState('');
  const query = text.trim();

  // Focus the field when the Search tab is tapped while it is already active (the tab listener in
  // app/(tabs)/_layout.tsx bumps searchFocusRequest$). onChange fires only on re-press, so the
  // field is never auto-focused on first arrival or initial mount.
  const inputRef = useRef<TextInput>(null);
  useEffect(() => searchFocusRequest$.onChange(() => inputRef.current?.focus()), []);

  // Cancel clears the field and blurs it; the blur collapses the header back to its idle state.
  const handleCancel = useCallback(() => {
    setText('');
    inputRef.current?.blur();
  }, []);

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
      <View style={{ paddingTop: insets.top }} className="bg-bg px-4 pb-2">
        <Animated.View style={[{ overflow: 'hidden' }, titleStyle]}>
          <View className="h-12 justify-center">
            <Text numberOfLines={1} size="2xl" weight="bold">
              Search
            </Text>
          </View>
        </Animated.View>
        <View className="flex-row items-center">
          <View className="flex-1">
            <Input
              ref={inputRef}
              value={text}
              onChangeText={setText}
              onFocus={onFocus}
              onBlur={onBlur}
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
          <Animated.View style={[{ overflow: 'hidden', justifyContent: 'center' }, cancelStyle]}>
            <Pressable
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel search"
              style={{ width: CANCEL_WIDTH }}
              className="pl-3"
            >
              <Text numberOfLines={1} color="accent" weight="medium">
                Cancel
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>

      {!hasQuery ? null : isLoading ? (
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
