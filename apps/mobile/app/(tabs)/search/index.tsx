import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  Extrapolation,
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
import { PressableScale } from '../../../src/components/pressable-scale';
import { useVinylSearch } from '../../../src/api/hooks';
import { VinylRow, VINYL_ROW_ESTIMATED_HEIGHT } from '../../../src/components/VinylRow';
import { ListFooterLoader } from '../../../src/components/list-footer-loader';
import { useThemeColors } from '../../../src/theme/colors';
import { player$ } from '../../../src/audio/store';
import { searchFocusRequest$ } from '../../../src/search/focus-signal';

// Leaves room at the bottom of the list for the floating mini-player + the tab bar.
const LIST_BOTTOM_PADDING = 140;

// Height of the "Search" title row, collapsed to 0 when the field is focused so the search bar
// rises to the top.
const TITLE_HEIGHT = 48;
// Fallback width for the Cancel reveal before/if the label measures itself (see cancelWidth). Sized
// for the English label; a measurement refines it for the real (possibly translated) label.
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

  // The whole header + results block slides up by the title's height so the field rises to the top;
  // the title fades as it slips above the clipped top edge. This is a single translateY on the UI
  // thread, so the results list never relayouts during the transition (animating the title's height
  // instead would reflow every list row on every frame).
  const riseStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(focusProgress.value, [0, 1], [0, -TITLE_HEIGHT]) }],
  }));
  // Fade across the first half of the motion (and back in over the second half when returning) so
  // the title clearly fades out/in rather than just sliding behind the clip edge.
  const titleFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(focusProgress.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
  }));

  // Cancel reveals on the field's right: the wrapper animates from 0 to the label width while the
  // flex-1 field shrinks to make room. cancelWidth starts at a sane default (so it always shows,
  // exactly like the original fixed-width version) and is refined by measuring an invisible,
  // out-of-flow copy of the label (onCancelLayout). We measure that copy, never the visible label:
  // the visible one lives inside the wrapper that clamps it to ~0 at rest, so measuring it would
  // oscillate. The off-flow copy is never clamped, so it stays correct after the custom font loads
  // or the label is translated.
  const [cancelWidth, setCancelWidth] = useState(CANCEL_WIDTH);
  const onCancelLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setCancelWidth((prev) => (prev === w ? prev : w));
  }, []);
  const cancelStyle = useAnimatedStyle(
    () => ({
      width: interpolate(focusProgress.value, [0, 1], [0, cancelWidth]),
      opacity: focusProgress.value,
    }),
    [cancelWidth],
  );

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
      {/* Status-bar inset, fixed. The block below clips the title as it slides up past this edge. */}
      <View style={{ height: insets.top }} className="bg-bg" />
      <View className="flex-1 overflow-hidden">
        {/* Header + results ride one transform up; bottom 48px it exposes is the same bg-bg. */}
        <Animated.View style={[{ flex: 1 }, riseStyle]}>
          <View className="px-4 pb-2">
            <Animated.View pointerEvents="none" style={titleFadeStyle}>
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
              {/* Off-flow copy used only to measure the label's true width (see onCancelLayout). */}
              <View
                pointerEvents="none"
                onLayout={onCancelLayout}
                style={{ position: 'absolute', opacity: 0 }}
                className="pl-3"
              >
                <Text numberOfLines={1} weight="medium">
                  Cancel
                </Text>
              </View>
              <Animated.View
                style={[
                  { overflow: 'hidden', justifyContent: 'center', alignItems: 'flex-start' },
                  cancelStyle,
                ]}
              >
                <PressableScale
                  onPress={handleCancel}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel search"
                  style={{ width: cancelWidth }}
                  className="pl-3"
                >
                  <Text numberOfLines={1} color="accent" weight="medium">
                    Cancel
                  </Text>
                </PressableScale>
              </Animated.View>
            </View>
          </View>

          <View className="flex-1">
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
        </Animated.View>
      </View>
    </View>
  );
}
