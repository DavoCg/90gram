import { ActivityIndicator, View } from '../theme/uniwind';

// The spinner shown at the bottom of an infinite list while the next page loads. Renders nothing
// when idle so it does not add space to the list.
export function ListFooterLoader({ loading }: { loading: boolean }) {
  if (!loading) return null;
  return (
    <View className="items-center py-6">
      <ActivityIndicator />
    </View>
  );
}
