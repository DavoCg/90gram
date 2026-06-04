import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';
import { View } from '../theme/uniwind';
import { useVisualizer } from '../audio/useVisualizer';

const BAR_COUNT = 24;
const MIN_HEIGHT = 4;
const MAX_HEIGHT = 52;

function Bar({
  bars,
  index,
  color,
}: {
  bars: SharedValue<number[]>;
  index: number;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const value = bars.value[index] ?? 0;
    return { height: MIN_HEIGHT + value * (MAX_HEIGHT - MIN_HEIGHT) };
  });
  return <Animated.View style={[{ width: 4, borderRadius: 2, backgroundColor: color }, style]} />;
}

// Spectrum visualizer driven by the AnalyserNode via Reanimated shared values.
export function Visualizer() {
  const bars = useVisualizer(BAR_COUNT);
  const accent = useCSSVariable('--color-accent');
  const color = typeof accent === 'string' && accent.length > 0 ? accent : '#e879f9';

  return (
    <View className="h-14 flex-row items-end justify-center gap-1">
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <Bar key={i} bars={bars} index={i} color={color} />
      ))}
    </View>
  );
}
