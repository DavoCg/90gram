import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { View } from '../src/theme/uniwind';
import { Text } from '../src/components/text';
import { Button } from '../src/components/button';

// Living demo for the native formSheet presentation (configured in app/_layout.tsx with
// `sheetAllowedDetents: 'fitToContents'`). The in-sheet "Add line"/"Remove line" controls grow and
// shrink the content, so the OS re-measures and animates the sheet to the new height. This is a
// native sheet (UISheetPresentationController on iOS), so the open and resize animations are driven
// by the platform; drag it down (or hit Close) to dismiss. Replaces the old @swmansion bottom sheet.
export default function SheetDemoScreen() {
  const [lines, setLines] = useState(1);
  const insets = useSafeAreaInsets();

  return (
    <View className="bg-surface px-5 pt-5" style={{ paddingBottom: insets.bottom + 20, gap: 12 }}>
      <Text size="lg" weight="semibold">
        Dynamic content
      </Text>
      {Array.from({ length: lines }, (_, i) => (
        <Text key={i} color="neutral-soft">
          Line {i + 1}: the sheet is sized to its content, so this block sets the height.
        </Text>
      ))}
      <View className="mt-1 flex-row gap-3">
        <Button
          label="Add line"
          variant="soft"
          color="accent"
          layout="flex"
          size="sm"
          onPress={() => setLines((n) => n + 1)}
        />
        <Button
          label="Remove line"
          variant="soft"
          color="neutral"
          layout="flex"
          size="sm"
          disabled={lines <= 1}
          onPress={() => setLines((n) => Math.max(1, n - 1))}
        />
      </View>
      <Button label="Close" variant="ghost" layout="flex" size="sm" onPress={() => router.back()} />
    </View>
  );
}
