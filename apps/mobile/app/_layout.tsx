import '../global.css';
import { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetProvider } from '@swmansion/react-native-bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import BootSplash from 'react-native-bootsplash';
import { queryClient } from '../src/api/queryClient';
import { authClient } from '../src/auth/client';
import { audioEngine } from '../src/audio/engine';
import { AppToaster } from '../src/components/toast';
import { useThemeColors } from '../src/theme/colors';
import { STACK_ANIMATION_DURATION } from '../src/theme/motion';
import { initializeTheme } from '../src/theme/theme';

// Apply the persisted dark-mode preference before the first render to avoid a theme flash.
initializeTheme();

export default function RootLayout() {
  // Backdrop behind the navigator and the bootsplash fade. Use the theme bg so it matches the
  // splash background and the screens, rather than a hardcoded black that would flash through.
  const colors = useThemeColors();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* KeyboardProvider feeds the native keyboard frame to react-native-keyboard-controller so
          screens can track the keyboard smoothly on the UI thread (used by sign-in). It wraps the
          app high up so any screen can opt in. */}
      <KeyboardProvider>
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
      </KeyboardProvider>
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

  // Whether the auth state has resolved at least once. better-auth's useSession flips isPending back
  // to true on its background refetches (the expo client reads the cached session, then re-fetches),
  // so we must NOT gate rendering on isPending directly: doing so unmounts the navigator on every
  // refetch and momentarily reveals the splash-colored backdrop, which reads as the splash flashing
  // back after the first screen. We only hold for the FIRST resolution; once auth is known, the
  // redirect effect below keeps the right screen mounted across any later session change.
  const [authResolved, setAuthResolved] = useState(false);
  useEffect(() => {
    if (!isPending) setAuthResolved(true);
  }, [isPending]);

  // Redirect on auth state: out to sign-in when signed out, back into the app once signed in.
  const inAuthGroup = segments[0] === '(auth)';
  useEffect(() => {
    if (!authResolved) return;
    if (!session && !inAuthGroup) {
      router.replace('/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [session, authResolved, inAuthGroup, router]);

  // Keep the native bootsplash (react-native-bootsplash) on screen until auth has resolved AND the
  // redirect above has landed us on the correct group, then fade it out exactly ONCE (a ref guard so
  // a later isPending refetch can never re-run this). Gating on "on the correct screen" means the
  // splash also covers the brief signed-out (tabs) -> sign-in redirect, so we never flash the wrong
  // screen for an already-authenticated user nor the tabs for a signed-out one.
  const splashHidden = useRef(false);
  const onCorrectScreen = session ? !inAuthGroup : inAuthGroup;
  useEffect(() => {
    if (splashHidden.current || !authResolved || !onCorrectScreen) return;
    splashHidden.current = true;
    void BootSplash.hide({ fade: true });
  }, [authResolved, onCorrectScreen]);

  // Render nothing underneath until auth first resolves; the native bootsplash still covers the
  // screen. After that we always render the navigator (never blank on a refetch).
  if (!authResolved) {
    return null;
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
      {/* Signing out navigates here; fade in rather than slide so leaving the app feels like a
          dissolve, not a sideways push back to a previous screen. */}
      <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      {/* Settings is a sibling of the tab shell, not nested inside it, so pushing it slides a full
          screen OVER the tabs and the mini-player (both owned by the (tabs) layout). */}
      <Stack.Screen name="settings" />
    </Stack>
  );
}
