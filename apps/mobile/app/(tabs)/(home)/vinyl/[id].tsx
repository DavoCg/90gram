import { useCallback, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { use$ } from '@legendapp/state/react';
import { Play, Shuffle } from 'lucide-react-native';
import type { TrackDto, VinylDto } from '@getvinyls/api-client';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from '../../../../src/theme/uniwind';
import { Text } from '../../../../src/components/text';
import { CoverArt } from '../../../../src/components/cover-art';
import { useVinyl } from '../../../../src/api/hooks';
import { AppHeader } from '../../../../src/components/AppHeader';
import { EqualizerBars } from '../../../../src/components/equalizer-bars';
import { audioEngine } from '../../../../src/audio/engine';
import { player$ } from '../../../../src/audio/store';
import { useThemeColors } from '../../../../src/theme/colors';
import { BIG_COVER_MAX } from '../../../../src/theme/sizes';

// Leaves room at the bottom of the scroll for the floating mini-player.
const LIST_BOTTOM_PADDING = 160;

// "from EUR 24.99" using the cheapest offer across shops, null when no priced offer.
function formatFromPrice(price: number | null, currency: string | null): string | null {
  if (price === null) return null;
  return `from ${currency ?? ''}${currency ? ' ' : ''}${price.toFixed(2)}`.trim();
}

// genre · year · format, skipping the parts we do not have.
function formatMeta(vinyl: VinylDto): string {
  const parts = [vinyl.genres[0]?.name, vinyl.year?.toString(), vinyl.format].filter(
    (part): part is string => Boolean(part),
  );
  return parts.join(' · ');
}

export default function VinylScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: vinyl, isLoading, isError, refetch } = useVinyl(id ?? '');
  const colors = useThemeColors();
  const { width: screenWidth } = useWindowDimensions();

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

  if (isLoading || !vinyl) {
    if (isError) {
      return (
        <View className="flex-1 bg-bg">
          <AppHeader />
          <View className="flex-1 items-center justify-center gap-3 px-6">
            <Text align="center">Could not load this record.</Text>
            <Pressable
              onPress={() => void refetch()}
              className="rounded-full curve-continuous bg-accent px-5 py-2"
            >
              <Text color="white">Retry</Text>
            </Pressable>
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
      <AppHeader />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: LIST_BOTTOM_PADDING }}
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
          <Pressable
            onPress={onPressPlay}
            disabled={!hasPlayable}
            style={{ opacity: hasPlayable ? 1 : 0.4 }}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl curve-continuous bg-surface-2 py-3"
          >
            <Play color={colors.accent} size={18} fill={colors.accent} />
            <Text weight="semibold" color="accent">
              Play
            </Text>
          </Pressable>
          <Pressable
            onPress={onPressShuffle}
            disabled={!hasPlayable}
            style={{ opacity: hasPlayable ? 1 : 0.4 }}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl curve-continuous bg-surface-2 py-3"
          >
            <Shuffle color={colors.accent} size={18} />
            <Text weight="semibold" color="accent">
              Shuffle
            </Text>
          </Pressable>
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
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
