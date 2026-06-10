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

// "from €24.99" using the cheapest offer across shops (converted to the display currency), null
// when no priced offer.
function formatFromPrice(price: number | null, currency: string | null): string | null {
  const formatted = formatPrice(price, currency);
  return formatted === null ? null : `from ${formatted}`;
}

function VinylRowBase({ vinyl, isCurrent, onPress }: VinylRowProps) {
  const fromPrice = formatFromPrice(vinyl.lowestPrice, vinyl.currency);
  const shops = vinyl.shopCount === 1 ? '1 shop' : `${vinyl.shopCount} shops`;
  return (
    <Pressable
      onPress={() => onPress(vinyl)}
      className={`flex-row items-center gap-3 px-4 py-3 ${isCurrent ? 'bg-surface-2' : 'bg-bg'}`}
    >
      <CoverArt uri={vinyl.coverArtUrl} size={56} radius={8} />
      <View className="flex-1 gap-1.5">
        <Text numberOfLines={1} size="lg" weight="semibold">
          {vinyl.title}
        </Text>
        <Text numberOfLines={1} size="md" color="neutral-soft">
          {vinyl.artist}
          {vinyl.year ? ` · ${vinyl.year}` : ''}
        </Text>
      </View>
      <View className="items-end gap-1">
        {fromPrice ? <Text size="sm">{fromPrice}</Text> : null}
        {vinyl.shopCount > 0 ? (
          <Text size="xs" color="neutral-soft">
            {shops}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// Memoized row for the LegendList. Pair with a stable onPress (useCallback) in the screen.
export const VinylRow = memo(VinylRowBase);

// Approximate rendered height of a row (two text lines with spacing dominate the 56px cover, plus
// vertical padding). Fed to LegendList as `estimatedItemSize` so the first frame renders the right
// number of rows; the real measured sizes take over after layout.
export const VINYL_ROW_ESTIMATED_HEIGHT = 84;
