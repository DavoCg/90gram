import { View } from '../../src/theme/uniwind';
import { AppHeader } from '../../src/components/AppHeader';

export default function RadioScreen() {
  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Radio" showBack={false} />
    </View>
  );
}
