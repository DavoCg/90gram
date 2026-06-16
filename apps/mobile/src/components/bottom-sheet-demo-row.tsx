import { useState } from 'react';
import { View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from '../theme/uniwind';
import { BottomSheet } from './bottom-sheet';
import { Text } from './text';
import { Button } from './button';

// Living demo for the shared BottomSheet (built on @lodev09/react-native-true-sheet). Shows a
// content-sized (dynamic height) sheet: the detent is 'auto', so the sheet sizes to whatever its
// content measures. The in-sheet "Add line"/"Remove line" controls grow and shrink that content, so
// the sheet re-measures and the native sheet animates to the new height. This is a native sheet
// (Swift/Kotlin), so the open and resize animations are driven by the OS and match the platform.
// Drag the sheet down (or hit Close) to dismiss.
export function BottomSheetDemoRow() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState(1);
  const insets = useSafeAreaInsets();

  return (
    <View className="px-4 py-3.5">
      <Text weight="semibold">Bottom sheet</Text>
      <Text size="sm" color="neutral-soft" className="mt-0.5 mb-3">
        Open a content-sized sheet, then add or remove lines to watch it resize
      </Text>
      <Button
        label="Open sheet"
        variant="soft"
        color="accent"
        layout="flex"
        size="sm"
        onPress={() => setOpen(true)}
      />

      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <RNView style={{ padding: 20, paddingBottom: insets.bottom + 20, gap: 12 }}>
          <Text size="lg" weight="semibold">
            Dynamic content
          </Text>
          {Array.from({ length: lines }, (_, i) => (
            <Text key={i} color="neutral-soft">
              Line {i + 1}: the sheet is sized to its content, so this block sets the height.
            </Text>
          ))}
          <RNView style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
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
          </RNView>
          <Button
            label="Close"
            variant="ghost"
            layout="flex"
            size="sm"
            onPress={() => setOpen(false)}
          />
        </RNView>
      </BottomSheet>
    </View>
  );
}
