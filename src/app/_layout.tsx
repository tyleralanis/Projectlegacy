import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

import { stageUpdateWithoutBlocking } from '@/services/updateService';
import { GameProvider, useGame } from '@/state/GameProvider';
import { LoadingScreen, NoticeBanner } from '@/ui/components';
import { ThemeAmbientLayer } from '@/ui/ThemeAtmosphere';
import { useAppTheme } from '@/ui/theme';

void SplashScreen.preventAutoHideAsync();

function AppNavigator() {
  const { ready, world, updateSettings } = useGame();
  const { dark, colors } = useAppTheme();
  const updateChecked = useRef(false);
  const navigationTheme = useMemo(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.accent,
        background: colors.canvas,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [colors, dark]);

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
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <ThemeAmbientLayer />
      <NoticeBanner />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="event" options={{ presentation: 'modal', gestureEnabled: false }} />
        <Stack.Screen name="history" />
        <Stack.Screen name="search" />
        <Stack.Screen name="saves" />
        <Stack.Screen name="developer" />
        <Stack.Screen name="updates" />
        <Stack.Screen name="interpreter-log" />
        <Stack.Screen name="themes" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return <GameProvider><AppNavigator /></GameProvider>;
}
