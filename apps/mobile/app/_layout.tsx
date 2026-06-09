import '../global.css';
import { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Animated, { interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { queryClient } from '../src/api/queryClient';
import { authClient } from '../src/auth/client';
import { audioEngine } from '../src/audio/engine';
import { NowPlaying } from '../src/components/NowPlaying';
import { AppToaster } from '../src/components/toast';
import { STACK_ANIMATION_DURATION } from '../src/theme/motion';
import { ActivityIndicator, View } from '../src/theme/uniwind';
import { initializeTheme } from '../src/theme/theme';

// Apply the persisted dark-mode preference before the first render to avoid a theme flash.
initializeTheme();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <RootNavigator />
          {/* Global toast host: mounted above the navigator so toasts float over every screen.
              Lives inside the gesture-handler + safe-area providers, which sonner-native needs. */}
          <AppToaster />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Auth gate + Now Playing host. Lives under the providers so it can read the better-auth session.
// The app is fully gated: without a session the user is redirected into the (auth) group, and the
// tab navigator (and the global mini-player) only mount once signed in.
function RootNavigator() {
  const { data: session, isPending } = authClient.useSession();
  const segments = useSegments();
  const router = useRouter();

  // Configure the audio session and lock-screen handlers once for the whole app.
  // Tear everything down (remove all subscriptions) on unmount.
  useEffect(() => {
    audioEngine.setupSession();
    return () => {
      void audioEngine.teardown();
    };
  }, []);

  // Redirect on auth state: out to sign-in when signed out, back into the app once signed in.
  useEffect(() => {
    if (isPending) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [session, isPending, segments, router]);

  // The mini-player floats above the whole navigator, so route changes inside it (tabs, settings)
  // do not layer it on their own. Settings is a full-cover screen, so we lift the navigator above
  // the player while it is open (see the z-index below) rather than hiding it.
  const onSettings = segments[0] === 'settings';

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

  // While the persisted session is restored from SecureStore, show a neutral splash so we never
  // flash the sign-in screen for an already-authenticated user (or vice versa).
  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      {/* Settings is a full-cover screen, so lift the navigator above the floating mini-player
          while it is open. Raising the navigator's z-index (rather than unmounting the player)
          keeps the player mounted and its state intact; it just paints behind the settings page. */}
      <Animated.View style={[{ flex: 1, overflow: 'hidden', zIndex: onSettings ? 1 : 0 }, cardStyle]}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'simple_push',
            animationDuration: STACK_ANIMATION_DURATION,
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          {/* Settings is a root screen (not inside (tabs)) so it slides in from the right ON TOP
              of the tab bar via the Stack's simple_push animation, covering the bottom tabs. */}
          <Stack.Screen name="settings" />
        </Stack>
      </Animated.View>
      {/* The Now Playing surface mounts above the tab navigator, but only once signed in: it can
          float as a mini-bar and expand to a full-screen player over the receding page. It stays
          mounted on the settings screen but paints behind it (see the navigator z-index above). */}
      {session ? <NowPlaying expand={expand} drag={drag} /> : null}
    </>
  );
}
