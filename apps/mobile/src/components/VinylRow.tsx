import { memo } from 'react';
import type { VinylSummaryDto } from '@getvinyls/api-client';
import { Pressable, View } from '../theme/uniwind';
import { CoverArt } from './cover-art';
import { Text } from './text';
import { formatPrice } from '../currency';

export interface VinylRowProps {
  vinyl: VinylSummaryDto;
  isCurrent: boolean;
  onPress: (vinyl: VinylSummaryDto) => void;
}

function VinylRowBase({ vinyl, isCurrent, onPress }: VinylRowProps) {
  // Cheapest offer across shops, converted to the display currency; null when no priced offer.
  const price = formatPrice(vinyl.lowestPrice, vinyl.currency);
  const genre = vinyl.genres[0]?.name ?? null;
  const shops = vinyl.shopCount === 1 ? '1 shop' : `${vinyl.shopCount} shops`;
  return (
    <Pressable
      onPress={() => onPress(vinyl)}
      className={`flex-row items-center gap-3 px-4 py-2 ${isCurrent ? 'bg-surface-2' : 'bg-bg'}`}
    >
      <CoverArt uri={vinyl.coverArtUrl} size={56} radius={8} />
      <View className="flex-1 gap-0.5">
        <Text numberOfLines={1} size="md" weight="semibold">
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
      <View className="items-end gap-0.5">
        {price ? <Text size="md">{price}</Text> : null}
        {vinyl.shopCount > 0 ? (
          <Text size="sm" color="neutral-soft">
            {shops}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// Memoized row for the LegendList. Pair with a stable onPress (useCallback) in the screen.
export const VinylRow = memo(VinylRowBase);

// Approximate rendered height of a row (two text lines plus the genre chip line dominate the 56px
// cover, plus vertical padding). Fed to LegendList as `estimatedItemSize` so the first frame renders
// the right number of rows; the real measured sizes take over after layout.
export const VINYL_ROW_ESTIMATED_HEIGHT = 88;
