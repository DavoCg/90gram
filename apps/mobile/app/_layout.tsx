import '../global.css';
import { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Animated, { interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { queryClient } from '../src/api/queryClient';
import { audioEngine } from '../src/audio/engine';
import { NowPlaying } from '../src/components/NowPlaying';
import { initializeTheme } from '../src/theme/theme';

// Apply the persisted dark-mode preference before the first render to avoid a theme flash.
initializeTheme();

export default function RootLayout() {
  // Configure the audio session and lock-screen handlers once for the whole app.
  // Tear everything down (remove all subscriptions) on unmount.
  useEffect(() => {
    audioEngine.setupSession();
    return () => {
      void audioEngine.teardown();
    };
  }, []);

  // Shared motion values for the Now Playing surface, created here so the root can recede the
  // navigator (iOS card effect) while NowPlaying drives the same values from its gestures.
  // `expand` is the open/close morph (0 = mini, 1 = full); `drag` is the rigid pixel offset
  // while the open sheet is being dragged down to dismiss.
  const { height: H } = useWindowDimensions();
  const expand = useSharedValue(0);
  const drag = useSharedValue(0);

  // The whole app (tab navigator) scales down and rounds behind the player as it opens, and
  // comes back as the sheet is dragged down. `open` blends the morph with the live drag so the
  // page tracks the finger on the way out.
  const cardStyle = useAnimatedStyle(() => {
    const open = expand.value * (1 - Math.min(Math.max(drag.value / H, 0), 1));
    return {
      transform: [
        { scale: interpolate(open, [0, 1], [1, 0.92]) },
        { translateY: interpolate(open, [0, 1], [0, 12]) },
      ],
      // Constant ~38pt corners while presented (tracks open/close only, not the drag), matching
      // the player sheet's top corners.
      borderRadius: interpolate(expand.value, [0, 1], [0, 38]),
      borderCurve: 'continuous',
      opacity: interpolate(open, [0, 1], [1, 0.6]),
    };
  });

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <Animated.View style={[{ flex: 1, overflow: 'hidden' }, cardStyle]}>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                animationDuration: 200,
              }}
            >
              <Stack.Screen name="(tabs)" />
            </Stack>
          </Animated.View>
          {/* The Now Playing surface is mounted once here, above the tab navigator, so it can
              float as a mini-bar and expand to a full-screen player over the receding page. */}
          <NowPlaying expand={expand} drag={drag} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
