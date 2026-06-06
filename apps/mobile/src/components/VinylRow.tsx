import { memo } from 'react';
import type { VinylSummaryDto } from '@getvinyls/api-client';
import { Pressable, View } from '../theme/uniwind';
import { CoverArt } from './cover-art';
import { Text } from './text';

export interface VinylRowProps {
  vinyl: VinylSummaryDto;
  isCurrent: boolean;
  isPlaying: boolean;
  onPress: (vinyl: VinylSummaryDto) => void;
}

// "from EUR 24.99" using the cheapest offer across shops, null when no priced offer.
function formatFromPrice(price: number | null, currency: string | null): string | null {
  if (price === null) return null;
  return `from ${currency ?? ''}${currency ? ' ' : ''}${price.toFixed(2)}`.trim();
}

function VinylRowBase({ vinyl, isCurrent, isPlaying, onPress }: VinylRowProps) {
  const fromPrice = formatFromPrice(vinyl.lowestPrice, vinyl.currency);
  const genre = vinyl.genres[0]?.name ?? null;
  const shops = vinyl.shopCount === 1 ? '1 shop' : `${vinyl.shopCount} shops`;
  return (
    <Pressable
      onPress={() => onPress(vinyl)}
      className={`flex-row items-center gap-3 px-4 py-3 ${isCurrent ? 'bg-surface-2' : 'bg-bg'}`}
    >
      <CoverArt uri={vinyl.coverArtUrl} size={56} radius={8} />
      <View className="flex-1">
        <Text numberOfLines={1} weight="semibold">
          {vinyl.title}
        </Text>
        <Text numberOfLines={1} size="sm" color="neutral-soft">
          {vinyl.artist}
          {vinyl.year ? ` · ${vinyl.year}` : ''}
        </Text>
        {genre ? (
          <View className="mt-1 self-start rounded-full curve-continuous bg-surface-2 px-2 py-0.5">
            <Text size="xs" color="neutral-soft">
              {genre}
            </Text>
          </View>
        ) : null}
      </View>
      <View className="items-end gap-1">
        {fromPrice ? <Text size="sm">{fromPrice}</Text> : null}
        {vinyl.shopCount > 0 ? (
          <Text size="xs" color="neutral-soft">
            {shops}
          </Text>
        ) : null}
        <Text size="xs" color="accent">
          {isCurrent && isPlaying ? '❚❚ Playing' : '▶ Preview'}
        </Text>
      </View>
    </Pressable>
  );
}

// Memoized row for the FlashList. Pair with a stable onPress (useCallback) in the screen.
export const VinylRow = memo(VinylRowBase);
