import { memo } from 'react';
import type { RecordDto } from '@getvinyls/api-client';
import { Image, Pressable, Text, View } from '../theme/uniwind';

export interface RecordRowProps {
  record: RecordDto;
  isCurrent: boolean;
  isPlaying: boolean;
  onPress: (record: RecordDto) => void;
}

function formatPrice(price: number | null, currency: string | null): string | null {
  if (price === null) return null;
  return `${currency ?? ''}${currency ? ' ' : ''}${price.toFixed(2)}`.trim();
}

function RecordRowBase({ record, isCurrent, isPlaying, onPress }: RecordRowProps) {
  const price = formatPrice(record.price, record.currency);
  return (
    <Pressable
      onPress={() => onPress(record)}
      className={`flex-row items-center gap-3 px-4 py-3 ${isCurrent ? 'bg-surface-2' : 'bg-bg'}`}
    >
      <Image
        source={record.coverArtUrl ? { uri: record.coverArtUrl } : undefined}
        className="h-14 w-14 rounded-md bg-surface-2"
      />
      <View className="flex-1">
        <Text numberOfLines={1} className="text-base font-semibold text-text">
          {record.title}
        </Text>
        <Text numberOfLines={1} className="text-sm text-muted">
          {record.artist}
          {record.year ? ` · ${record.year}` : ''}
        </Text>
      </View>
      <View className="items-end gap-1">
        {price ? <Text className="text-sm text-text">{price}</Text> : null}
        <Text className="text-xs text-accent">
          {isCurrent && isPlaying ? '❚❚ Playing' : '▶ Preview'}
        </Text>
      </View>
    </Pressable>
  );
}

// Memoized row for the FlashList. Pair with a stable onPress (useCallback) in the screen.
export const RecordRow = memo(RecordRowBase);
