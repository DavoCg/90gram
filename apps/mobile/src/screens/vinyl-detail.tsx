import { useCallback, useMemo } from 'react';
import { RefreshControl, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { use$ } from '@legendapp/state/react';
import { ChevronRight, Play, Shuffle } from 'lucide-react-native';
import type { FavoriteTrackDto, OfferDto, TrackDto, VinylDto } from '@getvinyls/api-client';
import { ActivityIndicator, Pressable, ScrollView, View } from '../theme/uniwind';
import { Text } from '../components/text';
import { PressableScale } from '../components/pressable-scale';
import { CoverArt } from '../components/cover-art';
import { useVinyl } from '../api/hooks';
import { AppHeader } from '../components/AppHeader';
import { FavoriteButton } from '../components/favorite-button';
import { EqualizerBars } from '../components/equalizer-bars';
import { audioEngine } from '../audio/engine';
import { player$ } from '../audio/store';
import { useThemeColors } from '../theme/colors';
import { useScreenRefresh } from '../hooks/use-screen-refresh';
import { useStackPrefix } from '../hooks/use-stack-prefix';
import { BIG_COVER_MAX } from '../theme/sizes';

// Leaves room at the bottom of the scroll for the floating mini-player.
const LIST_BOTTOM_PADDING = 160;

// "from EUR 24.99" using the cheapest offer across shops, null when no priced offer.
function formatFromPrice(price: number | null, currency: string | null): string | null {
  if (price === null) return null;
  return `from ${currency ?? ''}${currency ? ' ' : ''}${price.toFixed(2)}`.trim();
}

// "EUR 24.99" for a single offer, null when the offer carries no price.
function formatOfferPrice(price: number | null, currency: string | null): string | null {
  if (price === null) return null;
  return `${currency ?? ''}${currency ? ' ' : ''}${price.toFixed(2)}`.trim();
}

// A track plus the parent-vinyl context the favorites list needs to render and navigate.
function toFavoriteTrack(track: TrackDto, vinyl: VinylDto): FavoriteTrackDto {
  return {
    ...track,
    vinyl: {
      id: vinyl.id,
      title: vinyl.title,
      artist: vinyl.artist,
      coverArtUrl: vinyl.coverArtUrl,
    },
  };
}

// genre · year · format, skipping the parts we do not have.
function formatMeta(vinyl: VinylDto): string {
  const parts = [vinyl.genres[0]?.name, vinyl.year?.toString(), vinyl.format].filter(
    (part): part is string => Boolean(part),
  );
  return parts.join(' · ');
}

// The vinyl detail page. Shared by every tab stack that can open a record (Home, Favorites), so it
// pushes ON TOP of whichever tab the user is on rather than forcing a jump to Home.
export default function VinylDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: vinyl, isLoading, isError, refetch } = useVinyl(id ?? '');
  const router = useRouter();
  const stackPrefix = useStackPrefix();
  const colors = useThemeColors();
  const { width: screenWidth } = useWindowDimensions();
  const { refreshing, handleRefresh } = useScreenRefresh(refetch);

  // Match the full player's cover sizing so a "big cover" is the same size everywhere: capped at
  // BIG_COVER_MAX, shrinking only on narrow screens to fit within the page padding (px-6 = 24).
  const coverSize = Math.min(screenWidth - 48, BIG_COVER_MAX);

  // The active track (by id) and play/pause intent drive the row highlight. Reading intent
  // (not raw status) keeps the indicator steady while a tapped track buffers.
  const currentTrackId = use$(player$.track)?.id;
  const playWhenReady = use$(player$.playWhenReady);

  // The tracks we can actually play (those with a preview). playVinyl indexes into THIS list, so
  // a tapped row maps to its position here, not in the full tracklist.
  const playableTracks = useMemo(
    () => (vinyl ? vinyl.tracks.filter((track) => track.previewUrl !== null) : []),
    [vinyl],
  );
  const hasPlayable = playableTracks.length > 0;

  const onPressTrack = useCallback(
    (track: TrackDto) => {
      if (!vinyl || track.previewUrl === null) return;
      const index = playableTracks.findIndex((playable) => playable.id === track.id);
      if (index < 0) return;
      void audioEngine.playVinyl(vinyl, index);
    },
    [vinyl, playableTracks],
  );

  const onPressPlay = useCallback(() => {
    if (vinyl) void audioEngine.playVinyl(vinyl, 0);
  }, [vinyl]);

  const onPressShuffle = useCallback(() => {
    if (vinyl) void audioEngine.shuffleVinyl(vinyl);
  }, [vinyl]);

  // Open the shop page (name, address, the rest of its catalogue) for an offer's shop. Push it onto
  // the SAME tab stack this record was opened in (Home or Favorites) so the tab stays put; an
  // absolute `/shop/[id]` would always land in the Home stack and jump the user back to Home.
  const onPressOffer = useCallback(
    (offer: OfferDto) => {
      router.push(`${stackPrefix}/shop/${offer.shop.id}`);
    },
    [router, stackPrefix],
  );

  if (isLoading || !vinyl) {
    if (isError) {
      return (
        <View className="flex-1 bg-bg">
          <AppHeader />
          <View className="flex-1 items-center justify-center gap-3 px-6">
            <Text align="center">Could not load this record.</Text>
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

  const meta = formatMeta(vinyl);
  const fromPrice = formatFromPrice(vinyl.lowestPrice, vinyl.currency);

  return (
    <View className="flex-1 bg-bg">
      <AppHeader right={<FavoriteButton targetType="vinyl" vinyl={vinyl} />} />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: LIST_BOTTOM_PADDING }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Cover art + identity. */}
        <View className="items-center px-6 pb-4 pt-1">
          <CoverArt uri={vinyl.coverArtUrl} size={coverSize} />
          <Text numberOfLines={2} size="2xl" weight="bold" align="center" className="mt-5">
            {vinyl.title}
          </Text>
          <Text numberOfLines={1} size="lg" color="accent" align="center" className="mt-1">
            {vinyl.artist}
          </Text>
          {meta ? (
            <Text size="sm" color="neutral-soft" align="center" className="mt-1">
              {meta}
            </Text>
          ) : null}
          {fromPrice ? (
            <Text size="sm" color="neutral-soft" align="center" className="mt-0.5">
              {fromPrice}
              {vinyl.shopCount > 0
                ? ` · ${vinyl.shopCount === 1 ? '1 shop' : `${vinyl.shopCount} shops`}`
                : ''}
            </Text>
          ) : null}
        </View>

        {/* Play + Shuffle. Dimmed when nothing in the tracklist has a preview. */}
        <View className="flex-row gap-3 px-6 pb-4">
          <PressableScale
            onPress={onPressPlay}
            disabled={!hasPlayable}
            style={{ opacity: hasPlayable ? 1 : 0.4 }}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl curve-continuous bg-surface-2 py-3"
          >
            <Play color={colors.accent} size={18} fill={colors.accent} />
            <Text weight="semibold" color="accent">
              Play
            </Text>
          </PressableScale>
          <PressableScale
            onPress={onPressShuffle}
            disabled={!hasPlayable}
            style={{ opacity: hasPlayable ? 1 : 0.4 }}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl curve-continuous bg-surface-2 py-3"
          >
            <Shuffle color={colors.accent} size={18} />
            <Text weight="semibold" color="accent">
              Shuffle
            </Text>
          </PressableScale>
        </View>

        {/* Tracklist. Tap a row to play from there; rows without a preview are dimmed. */}
        <View className="px-2">
          {vinyl.tracks.map((track) => {
            const isCurrent = track.id === currentTrackId;
            const playable = track.previewUrl !== null;
            return (
              <Pressable
                key={track.id}
                onPress={() => onPressTrack(track)}
                disabled={!playable}
                className="flex-row items-center gap-3 border-b border-border px-4 py-3"
              >
                <View className="w-7 items-center">
                  {isCurrent ? (
                    <EqualizerBars
                      playing={playWhenReady}
                      color={colors.accent}
                      size={14}
                    />
                  ) : (
                    <Text size="sm" color="neutral-soft">
                      {track.position}
                    </Text>
                  )}
                </View>
                <Text
                  numberOfLines={1}
                  color={isCurrent ? 'accent' : playable ? 'neutral' : 'neutral-soft'}
                  className="flex-1"
                >
                  {track.title}
                </Text>
                {isCurrent && playWhenReady ? (
                  <Text size="xs" color="accent">
                    Playing
                  </Text>
                ) : !playable ? (
                  <Text size="xs" color="neutral-soft">
                    No preview
                  </Text>
                ) : null}
                <FavoriteButton
                  targetType="track"
                  track={toFavoriteTrack(track, vinyl)}
                  size={18}
                />
              </Pressable>
            );
          })}
        </View>

        {/* Available at: the shops listing this record. Tap a shop to open its page. */}
        {vinyl.offers.length > 0 ? (
          <View className="mt-6 px-2">
            <Text size="sm" color="neutral-soft" weight="semibold" className="px-4 pb-1">
              Available at
            </Text>
            {vinyl.offers.map((offer) => {
              const offerPrice = formatOfferPrice(offer.price, offer.currency);
              return (
                <Pressable
                  key={offer.id}
                  onPress={() => onPressOffer(offer)}
                  className="flex-row items-center gap-3 border-b border-border px-4 py-3"
                >
                  <View className="flex-1">
                    <Text numberOfLines={1} weight="semibold">
                      {offer.shop.name}
                    </Text>
                    {offer.condition ? (
                      <Text size="xs" color="neutral-soft" className="mt-0.5">
                        {offer.condition}
                      </Text>
                    ) : null}
                  </View>
                  {offerPrice ? <Text size="sm">{offerPrice}</Text> : null}
                  <ChevronRight color={colors.muted} size={18} />
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
