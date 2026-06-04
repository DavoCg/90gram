import { ActivityIndicator, Image, Pressable, Text, View } from '../theme/uniwind';
import { audioEngine } from '../audio/engine';
import { usePlayerStore } from '../audio/store';
import { Visualizer } from './Visualizer';

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Bottom player surface. Reads narrow slices from the player store and drives the engine.
export function PlayerBar() {
  const record = usePlayerStore((s) => s.record);
  const status = usePlayerStore((s) => s.status);
  const positionSec = usePlayerStore((s) => s.positionSec);
  const durationSec = usePlayerStore((s) => s.durationSec);

  if (!record) return null;

  const progress = durationSec > 0 ? Math.min(positionSec / durationSec, 1) : 0;
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

      <View className="mt-3 flex-row items-center gap-2">
        <Text className="w-10 text-xs text-muted">{formatTime(positionSec)}</Text>
        <View className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
          <View
            className="h-1 rounded-full bg-accent"
            style={{ width: `${progress * 100}%` }}
          />
        </View>
        <Text className="w-10 text-right text-xs text-muted">{formatTime(durationSec)}</Text>
      </View>
    </View>
  );
}
