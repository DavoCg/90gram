import { useCallback } from 'react';
import { FlashList } from '@shopify/flash-list';
import { use$ } from '@legendapp/state/react';
import type { RecordDto } from '@getvinyls/api-client';
import { ActivityIndicator, Pressable, Text, View } from '../src/theme/uniwind';
import { useRecords } from '../src/api/hooks';
import { RecordRow } from '../src/components/RecordRow';
import { PlayerBar } from '../src/components/PlayerBar';
import { audioEngine } from '../src/audio/engine';
import { player$ } from '../src/audio/store';

export default function RecordsScreen() {
  const { data, isLoading, isError, refetch } = useRecords();
  const currentId = use$(player$.record)?.id;
  const status = use$(player$.status);

  const onPressRecord = useCallback((record: RecordDto) => {
    void audioEngine.playRecord(record);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: RecordDto }) => (
      <RecordRow
        record={item}
        isCurrent={item.id === currentId}
        isPlaying={status === 'playing'}
        onPress={onPressRecord}
      />
    ),
    [currentId, status, onPressRecord],
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator />
        <Text className="mt-3 text-muted">Loading records…</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-bg px-6">
        <Text className="text-center text-text">Could not reach the API.</Text>
        <Text className="text-center text-sm text-muted">
          Is it running? Check EXPO_PUBLIC_API_BASE_URL.
        </Text>
        <Pressable
          onPress={() => void refetch()}
          className="rounded-full bg-accent px-5 py-2"
        >
          <Text className="text-surface">Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <FlashList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        extraData={`${currentId ?? ''}:${status}`}
      />
      <PlayerBar />
    </View>
  );
}
