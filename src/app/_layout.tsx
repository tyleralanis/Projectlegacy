import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import { stageUpdateWithoutBlocking } from '@/services/updateService';
import { GameProvider, useGame } from '@/state/GameProvider';
import { LoadingScreen, NoticeBanner } from '@/ui/components';

void SplashScreen.preventAutoHideAsync();

function AppNavigator() {
  const { ready, world, updateSettings } = useGame();
  const colorScheme = useColorScheme();
  const updateChecked = useRef(false);
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  useEffect(() => {
    if (!ready || !world) return;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (enabled && !world.settings.reducedMotion) void updateSettings({ reducedMotion: true });
    });
    if (world.settings.autoDownloadUpdates && !updateChecked.current) {
      updateChecked.current = true;
      void stageUpdateWithoutBlocking();
    }
  }, [ready, updateSettings, world]);
  if (!ready) return <LoadingScreen />;
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <NoticeBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="event" options={{ presentation: 'modal', gestureEnabled: false }} />
        <Stack.Screen name="history" />
        <Stack.Screen name="search" />
        <Stack.Screen name="saves" />
        <Stack.Screen name="developer" />
        <Stack.Screen name="updates" />
        <Stack.Screen name="interpreter-log" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return <GameProvider><AppNavigator /></GameProvider>;
}
