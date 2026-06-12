import '../global.css';
import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
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

// Shared options for screens presented as native formSheets. `contentStyle` paints the sheet surface
// with the themed background so it matches the rest of the app behind the safe areas. `detents` defaults
// to `fitToContents` (the sheet is sized to, and re-animates with, its content), which is right for
// short, scroll-free content. Sheets that contain a ScrollView MUST pass fixed fractional detents
// instead: react-native-screens cannot measure a scroll container, so `fitToContents` mis-sizes it and
// the content overflows. Those sheets give the scroll view a known height to fill via a fixed detent.
type ScreenOptions = NonNullable<ComponentProps<typeof Stack.Screen>['options']>;
function sheetScreenOptions(
  background: string,
  detents: ScreenOptions['sheetAllowedDetents'] = 'fitToContents',
): ScreenOptions {
  return {
    presentation: 'formSheet',
    sheetAllowedDetents: detents,
    sheetGrabberVisible: true,
    sheetCornerRadius: 24,
    contentStyle: { backgroundColor: background },
    headerShown: false,
  };
}

export default function RootLayout() {
  // Backdrop behind the navigator and the bootsplash fade. Use the theme bg so it matches the
  // splash background and the screens, rather than a hardcoded black that would flash through.
  const colors = useThemeColors();

  // Paint the NATIVE root view (the OS window behind the React tree and the bootsplash) with the
  // themed background. Without this the window defaults to white, so BootSplash.hide({ fade: true })
  // cross-dissolves to white for a frame before React paints colors.bg, a white flash even in dark
  // mode. The native splash follows the SYSTEM scheme; the app's dark preference is JS-only, so the
  // window has no themed color of its own until we set it here. Keyed on bg so it tracks the toggle.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* KeyboardProvider feeds the native keyboard frame to react-native-keyboard-controller so
          screens can track the keyboard smoothly on the UI thread (used by sign-in). It wraps the
          app high up so any screen can opt in. */}
      <KeyboardProvider>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="auto" />
            <RootNavigator />
            {/* Global toast host: mounted above the navigator so toasts float over every screen.
                Lives inside the gesture-handler + safe-area providers, which the toasts need for
                swipe-to-dismiss and top-inset positioning. */}
            <AppToaster />
          </QueryClientProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

// Auth gate. Lives under the providers so it can read the better-auth session. The app is fully
// gated with Expo Router's declarative guards (Stack.Protected): the (auth) group is only navigable
// while signed out and the (tabs) + settings group only while signed in, and the router redirects to
// the first available screen whenever a guard flips, no hand-rolled router.replace needed. The tab
// shell owns the mini-player, so root-level screens like settings push cleanly OVER the tabs and the
// player without any z-index juggling.
function RootNavigator() {
  const { data: session, isPending } = authClient.useSession();
  const colors = useThemeColors();

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
  // back after the first screen. We only hold for the FIRST resolution; after that the guards below
  // keep the right group mounted across any later session change.
  const [authResolved, setAuthResolved] = useState(false);
  useEffect(() => {
    if (!isPending) setAuthResolved(true);
  }, [isPending]);

  // Fade the native bootsplash (react-native-bootsplash) out exactly ONCE, as soon as auth first
  // resolves (a ref guard so a later isPending refetch can never re-run it). Stack.Protected resolves
  // the correct group during render, so by the time we hide the splash we are already on the right
  // screen, with no async redirect frame to flash through.
  const splashHidden = useRef(false);
  useEffect(() => {
    if (splashHidden.current || !authResolved) return;
    splashHidden.current = true;
    void BootSplash.hide({ fade: true });
  }, [authResolved]);

  // Render nothing underneath until auth first resolves; the native bootsplash still covers the
  // screen. After that the navigator stays mounted (never blanks on a refetch).
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
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        {/* Settings is a sibling of the tab shell, not nested inside it, so pushing it slides a full
            screen OVER the tabs and the mini-player (both owned by the (tabs) layout). */}
        <Stack.Screen name="settings" />
        {/* Native formSheets (UISheetPresentationController on iOS). The demo uses `fitToContents`, so
            the sheet is sized to whatever its content measures and re-animates as the add/remove lines
            change, without a JS-driven sheet library. */}
        <Stack.Screen name="sheet-demo" options={sheetScreenOptions(colors.surface)} />
        {/* Currency holds a scrollable list, so it takes a fixed detent (not fitToContents) and fills
            it; see sheetScreenOptions. */}
        <Stack.Screen name="currency" options={sheetScreenOptions(colors.surface, [0.9])} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        {/* Signing out flips this guard on; fade in rather than slide so leaving the app feels like a
            dissolve, not a sideways push back to a previous screen. */}
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  );
}
