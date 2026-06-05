import { memo } from 'react';
import type { VinylSummaryDto } from '@getvinyls/api-client';
import { Image, Pressable, Text, View } from '../theme/uniwind';

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
      <Image
        source={vinyl.coverArtUrl ? { uri: vinyl.coverArtUrl } : undefined}
        className="h-14 w-14 rounded-md bg-surface-2"
      />
      <View className="flex-1">
        <Text numberOfLines={1} className="text-base font-semibold text-text">
          {vinyl.title}
        </Text>
        <Text numberOfLines={1} className="text-sm text-muted">
          {vinyl.artist}
          {vinyl.year ? ` · ${vinyl.year}` : ''}
        </Text>
        {genre ? (
          <View className="mt-1 self-start rounded-full bg-surface-2 px-2 py-0.5">
            <Text className="text-xs text-muted">{genre}</Text>
          </View>
        ) : null}
      </View>
      <View className="items-end gap-1">
        {fromPrice ? <Text className="text-sm text-text">{fromPrice}</Text> : null}
        {vinyl.shopCount > 0 ? <Text className="text-xs text-muted">{shops}</Text> : null}
        <Text className="text-xs text-accent">
          {isCurrent && isPlaying ? '❚❚ Playing' : '▶ Preview'}
        </Text>
      </View>
    </Pressable>
  );
}

// Memoized row for the FlashList. Pair with a stable onPress (useCallback) in the screen.
export const VinylRow = memo(VinylRowBase);
