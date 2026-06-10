import { useCallback } from 'react';
import { RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { LegendList, type LegendListRenderItemProps } from '@legendapp/list/react-native';
import { use$ } from '@legendapp/state/react';
import { Heart } from 'lucide-react-native';
import type { FavoriteTrackDto, VinylSummaryDto } from '@getvinyls/api-client';
import { ActivityIndicator, Pressable, View } from '../../../src/theme/uniwind';
import { Text } from '../../../src/components/text';
import { CoverArt } from '../../../src/components/cover-art';
import { VinylRow, VINYL_ROW_ESTIMATED_HEIGHT } from '../../../src/components/VinylRow';
import { ListFooterLoader } from '../../../src/components/list-footer-loader';
import { FavoriteButton } from '../../../src/components/favorite-button';
import { EqualizerBars } from '../../../src/components/equalizer-bars';
import { AppHeader } from '../../../src/components/AppHeader';
import { Placeholder } from '../../../src/components/Placeholder';
import { useFavoriteTracks, useFavoriteVinyls } from '../../../src/api/hooks';
import { audioEngine } from '../../../src/audio/engine';
import { player$ } from '../../../src/audio/store';
import { useThemeColors } from '../../../src/theme/colors';
import { useScreenRefresh } from '../../../src/hooks/use-screen-refresh';

// Leaves room at the bottom for the floating mini-player + the tab bar.
const LIST_BOTTOM_PADDING = 140;

function SectionTitle({ children }: { children: string }) {
  return (
    <Text size="sm" weight="semibold" color="neutral-soft" className="px-4 pb-1 pt-4">
      {children}
    </Text>
  );
}

// A favorited track: cover + title + parent artist. Tapping the row plays just this track; the
// cover doubles as a shortcut into the parent vinyl page. The trailing heart un-favorites in place.
function FavoriteTrackRow({
  track,
  isCurrent,
  isPlaying,
  onPlay,
  onOpenVinyl,
}: {
  track: FavoriteTrackDto;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: (track: FavoriteTrackDto) => void;
  onOpenVinyl: (vinylId: string) => void;
}) {
  const colors = useThemeColors();
  const playable = track.previewUrl !== null;
  return (
    <Pressable
      onPress={() => onPlay(track)}
      disabled={!playable}
      className="flex-row items-center gap-3 px-4 py-3"
    >
      <Pressable onPress={() => onOpenVinyl(track.vinyl.id)} hitSlop={6}>
        <CoverArt uri={track.vinyl.coverArtUrl} size={48} radius={8} />
      </Pressable>
      <View className="flex-1">
        <Text numberOfLines={1} weight="semibold" color={isCurrent ? 'accent' : 'neutral'}>
          {track.title}
        </Text>
        <Text numberOfLines={1} size="sm" color="neutral-soft">
          {track.vinyl.artist} · {track.vinyl.title}
        </Text>
      </View>
      {isCurrent ? (
        <EqualizerBars playing={isPlaying} color={colors.accent} size={14} />
      ) : !playable ? (
        <Text size="xs" color="neutral-soft">
          No preview
        </Text>
      ) : null}
      <FavoriteButton targetType="track" track={track} size={18} />
    </Pressable>
  );
}

export default function FavoritesScreen() {
  const router = useRouter();
  const {
    data: vinyls,
    isLoading: vinylsLoading,
    isError: vinylsError,
    refetch: refetchVinyls,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFavoriteVinyls();
  const {
    data: tracks,
    isLoading: tracksLoading,
    isError: tracksError,
    refetch: refetchTracks,
  } = useFavoriteTracks();
  const currentTrack = use$(player$.track);
  const currentVinylId = currentTrack?.vinylId;
  const currentTrackId = currentTrack?.id;
  const playWhenReady = use$(player$.playWhenReady);
  const colors = useThemeColors();
  // Favorites is two queries on one scroll surface, so a pull refreshes both records and tracks.
  const { refreshing, handleRefresh } = useScreenRefresh(() =>
    Promise.all([refetchVinyls(), refetchTracks()]),
  );

  // Push the record onto the Favorites stack (not /vinyl/, which lives in the Home stack) so the
  // detail slides in over Favorites and the tab stays put.
  const onPressVinyl = useCallback(
    (vinyl: VinylSummaryDto) => router.push(`/favorites/vinyl/${vinyl.id}`),
    [router],
  );
  const onOpenVinyl = useCallback(
    (vinylId: string) => router.push(`/favorites/vinyl/${vinylId}`),
    [router],
  );
  const onPlayTrack = useCallback((track: FavoriteTrackDto) => {
    void audioEngine.playTrack(track);
  }, []);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: LegendListRenderItemProps<VinylSummaryDto>) => (
      <VinylRow
        vinyl={item}
        isCurrent={item.id === currentVinylId}
        isPlaying={playWhenReady}
        onPress={onPressVinyl}
      />
    ),
    [currentVinylId, playWhenReady, onPressVinyl],
  );

  if (vinylsLoading || tracksLoading) {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader title="Favorites" showBack={false} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  if (vinylsError || tracksError) {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader title="Favorites" showBack={false} />
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text align="center">Could not load your favorites.</Text>
          <Pressable
            onPress={() => {
              void refetchVinyls();
              void refetchTracks();
            }}
            className="rounded-full curve-continuous bg-accent px-5 py-2"
          >
            <Text color="white">Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const favoriteVinyls = vinyls ?? [];
  const favoriteTracks = tracks ?? [];

  if (favoriteVinyls.length === 0 && favoriteTracks.length === 0) {
    return (
      <Placeholder icon={Heart} title="Favorites" subtitle="Records you save will show up here." />
    );
  }

  // The favorited vinyls (Records) drive the infinite list; the favorited tracks render in the
  // footer so the existing Records-then-Tracks order is preserved on one scroll surface.
  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Favorites" showBack={false} />
      <LegendList
        data={favoriteVinyls}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        recycleItems
        estimatedItemSize={VINYL_ROW_ESTIMATED_HEIGHT}
        extraData={`${currentVinylId ?? ''}:${String(playWhenReady)}`}
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
        ListHeaderComponent={favoriteVinyls.length > 0 ? <SectionTitle>Records</SectionTitle> : null}
        ListFooterComponent={
          <>
            <ListFooterLoader loading={isFetchingNextPage} />
            {favoriteTracks.length > 0 ? (
              <>
                <SectionTitle>Tracks</SectionTitle>
                {favoriteTracks.map((track) => (
                  <FavoriteTrackRow
                    key={track.id}
                    track={track}
                    isCurrent={track.id === currentTrackId}
                    isPlaying={playWhenReady}
                    onPlay={onPlayTrack}
                    onOpenVinyl={onOpenVinyl}
                  />
                ))}
              </>
            ) : null}
          </>
        }
        contentContainerStyle={{ paddingBottom: LIST_BOTTOM_PADDING }}
      />
    </View>
  );
}
