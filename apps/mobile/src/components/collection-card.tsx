import { memo } from 'react';
import { Disc3 } from 'lucide-react-native';
import type { CollectionDto } from '@getvinyls/api-client';
import { Image, View } from '../theme/uniwind';
import { PressableScale } from './pressable-scale';
import { Text } from './text';
import { useThemeColors } from '../theme/colors';

// The 2x2 cover mosaic for a collection. Fills missing slots with a surface tile so the grid stays
// square. With no covers at all it shows a single placeholder with a disc icon.
function CoverMosaic({ urls, size }: { urls: string[]; size: number }) {
  const colors = useThemeColors();
  const half = size / 2;

  if (urls.length === 0) {
    return (
      <View
        className="items-center justify-center bg-surface-2 curve-continuous"
        style={{ width: size, height: size, borderRadius: 10 }}
      >
        <Disc3 color={colors.muted} size={size * 0.4} />
      </View>
    );
  }

  // Always render four tiles (pad with nulls) so a 1- or 2-cover collection still reads as a grid.
  const tiles = [urls[0] ?? null, urls[1] ?? null, urls[2] ?? null, urls[3] ?? null];
  return (
    <View
      className="flex-row flex-wrap overflow-hidden bg-surface-2 curve-continuous"
      style={{ width: size, height: size, borderRadius: 10 }}
    >
      {tiles.map((uri, i) =>
        uri ? (
          <Image
            // The grid is positional and fixed-length, so the index is a stable key here.
            key={i}
            source={{ uri }}
            recyclingKey={uri}
            contentFit="cover"
            style={{ width: half, height: half }}
          />
        ) : (
          <View key={i} className="bg-surface-2" style={{ width: half, height: half }} />
        ),
      )}
    </View>
  );
}

export interface CollectionCardProps {
  collection: CollectionDto;
  onPress: (id: string) => void;
  // Mosaic side length; the card sizes to fit it.
  size?: number;
}

// A saved-group card: a square cover mosaic with the name and record count beneath. Used in the
// horizontal collections rail on profiles.
function CollectionCardBase({ collection, onPress, size = 150 }: CollectionCardProps) {
  const count =
    collection.vinylCount === 1 ? '1 record' : `${collection.vinylCount} records`;
  return (
    <PressableScale onPress={() => onPress(collection.id)} style={{ width: size }}>
      <CoverMosaic urls={collection.coverArtUrls} size={size} />
      <Text numberOfLines={1} weight="semibold" className="mt-2">
        {collection.name}
      </Text>
      <Text size="sm" color="neutral-soft">
        {count}
      </Text>
    </PressableScale>
  );
}

export const CollectionCard = memo(CollectionCardBase);
