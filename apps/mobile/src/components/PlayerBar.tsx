import { use$ } from '@legendapp/state/react';
import { ActivityIndicator, Image, Pressable, Text, View } from '../theme/uniwind';
import { audioEngine } from '../audio/engine';
import { player$ } from '../audio/store';
import { SeekBar } from './SeekBar';
import { Visualizer } from './Visualizer';

// Bottom player surface. Reads narrow slices from the Legend State observable and drives
// the engine. use$ subscribes only to the fields this component reads.
export function PlayerBar() {
  const record = use$(player$.record);
  const status = use$(player$.status);
  const positionSec = use$(player$.positionSec);
  const durationSec = use$(player$.durationSec);

  if (!record) return null;

  const isPlaying = status === 'playing';
  const isLoading = status === 'loading';

  return (
    <View className="border-t border-border bg-surface px-4 pb-8 pt-3">
      <Visualizer />

      <View className="mt-2 flex-row items-center gap-3">
        <Image
          source={record.coverArtUrl ? { uri: record.coverArtUrl } : undefined}
          className="h-12 w-12 rounded-md bg-surface-2"
        />
        <View className="flex-1">
          <Text numberOfLines={1} className="text-base font-semibold text-text">
            {record.title}
          </Text>
          <Text numberOfLines={1} className="text-sm text-muted">
            {record.artist}
          </Text>
        </View>
        <Pressable
          onPress={() => void audioEngine.toggle()}
          disabled={isLoading}
          className="h-12 w-12 items-center justify-center rounded-full bg-accent"
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-lg text-surface">{isPlaying ? '❚❚' : '▶'}</Text>
          )}
        </Pressable>
      </View>

      <SeekBar
        positionSec={positionSec}
        durationSec={durationSec}
        onSeek={(seconds) => audioEngine.seek(seconds)}
      />
    </View>
  );
}
