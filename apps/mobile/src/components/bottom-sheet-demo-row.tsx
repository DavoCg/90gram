import { useState } from 'react';
import { StyleSheet, View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModalBottomSheet } from '@swmansion/react-native-bottom-sheet';
import { View } from '../theme/uniwind';
import { useThemeColors } from '../theme/colors';
import { Text } from './text';
import { Button } from './button';

// Living demo for @swmansion/react-native-bottom-sheet. Shows a content-sized (dynamic height)
// modal sheet: the detents are [0, 'content'], so index 0 is the closed state and index 1 sizes
// the sheet to whatever its content measures. The in-sheet "Add line"/"Remove line" controls grow
// and shrink that content, so the sheet re-measures and the native sheet animates to the new height.
// This is a native sheet (Swift/Kotlin), so the open and resize animations are driven by the OS and
// match the platform; there is no JS-side duration/easing knob (only `animateIn` to toggle the very
// first appearance). Drag the sheet down (or hit Close) to dismiss.
export function BottomSheetDemoRow() {
  // 0 = closed, 1 = open at content height.
  const [index, setIndex] = useState(0);
  const [lines, setLines] = useState(1);
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

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
        onPress={() => setIndex(1)}
      />

      <ModalBottomSheet
        index={index}
        onIndexChange={setIndex}
        detents={[0, 'content']}
        scrimColor="rgba(0, 0, 0, 0.5)"
        surface={
          <RNView
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: colors.surface,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
              },
            ]}
          />
        }
      >
        <RNView style={{ padding: 20, paddingBottom: insets.bottom + 20, gap: 12 }}>
          {/* Grab handle */}
          <RNView
            style={{
              alignSelf: 'center',
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              marginBottom: 4,
            }}
          />
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
          <Button label="Close" variant="ghost" layout="flex" size="sm" onPress={() => setIndex(0)} />
        </RNView>
      </ModalBottomSheet>
    </View>
  );
}
