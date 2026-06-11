import '../global.css';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetProvider } from '@swmansion/react-native-bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { queryClient } from '../src/api/queryClient';
import { authClient } from '../src/auth/client';
import { audioEngine } from '../src/audio/engine';
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
        {/* BottomSheetProvider owns the portal that ModalBottomSheet renders through, so it wraps
            the whole app (high enough that modal sheets float over the navigator and the toasts). */}
        <BottomSheetProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="auto" />
            <RootNavigator />
            {/* Global toast host: mounted above the navigator so toasts float over every screen.
                Lives inside the gesture-handler + safe-area providers, which the toasts need for
                swipe-to-dismiss and top-inset positioning. */}
            <AppToaster />
          </QueryClientProvider>
        </BottomSheetProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Auth gate. Lives under the providers so it can read the better-auth session. The app is fully
// gated: without a session the user is redirected into the (auth) group, and the tab navigator
// only mounts once signed in. The tab shell owns the mini-player, so root-level screens like
// settings push cleanly OVER the tabs and the player without any z-index juggling.
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
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'simple_push',
        animationDuration: STACK_ANIMATION_DURATION,
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      {/* Settings is a sibling of the tab shell, not nested inside it, so pushing it slides a full
          screen OVER the tabs and the mini-player (both owned by the (tabs) layout). */}
      <Stack.Screen name="settings" />
    </Stack>
  );
}
