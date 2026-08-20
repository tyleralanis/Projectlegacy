import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useGame } from '@/state/GameProvider';
import { useAppTheme, type AmbientEffectKind } from '@/ui/theme';

const nativeDriver = Platform.OS !== 'web';
const AMBIENT_MIN_DELAY_MS = 180_000;
const AMBIENT_VARIANCE_MS = 60_000;
const BURST_DURATION_MS = 13_000;

export function ThemeBackdrop() {
  const { theme, colors } = useAppTheme();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[...theme.backgroundGradient]} style={StyleSheet.absoluteFill} />
      {theme.motif === 'sakura' ? <>
        <Text style={[styles.sakuraLarge, { color: colors.accent }]}>✿</Text>
        <Text style={[styles.sakuraSmall, { color: colors.accent }]}>✿</Text>
      </> : null}
      {theme.motif === 'stars' ? <>
        <Text style={[styles.starField, { color: colors.accent }]}>·  ✦    ·       ·   ✧</Text>
        <View style={[styles.midnightGlow, { backgroundColor: colors.accentSoft }]} />
      </> : null}
      {theme.motif === 'forest' ? <>
        <View style={[styles.forestHillOne, { backgroundColor: colors.accentSoft }]} />
        <View style={[styles.forestHillTwo, { backgroundColor: colors.secondary }]} />
        <Text style={[styles.forestSprig, { color: colors.accent }]}>❧</Text>
      </> : null}
      {theme.motif === 'geometry' ? <>
        <View style={[styles.geometryOne, { borderColor: colors.accentSoft }]} />
        <View style={[styles.geometryTwo, { borderColor: colors.secondary }]} />
      </> : null}
    </View>
  );
}

export function ThemeAmbientLayer() {
  const { world } = useGame();
  const { theme } = useAppTheme();
  const enabled = Boolean(world)
    && (world?.settings.ambientThemeEffects ?? true)
    && !world?.settings.reducedMotion
    && !world?.settings.highContrast
    && theme.ambient.kind !== 'none';

  if (!enabled) return null;
  return <AmbientScheduler key={theme.id} kind={theme.ambient.kind} />;
}

function AmbientScheduler({ kind }: { kind: AmbientEffectKind }) {
  const [burst, setBurst] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    let nextTimer: ReturnType<typeof setTimeout> | undefined;
    let endTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const schedule = () => {
      const delay = AMBIENT_MIN_DELAY_MS + Math.floor(Math.random() * AMBIENT_VARIANCE_MS);
      nextTimer = setTimeout(() => {
        if (disposed) return;
        setBurst((value) => value + 1);
        setActive(true);
        endTimer = setTimeout(() => {
          if (disposed) return;
          setActive(false);
          schedule();
        }, BURST_DURATION_MS);
      }, delay);
    };

    schedule();
    return () => {
      disposed = true;
      if (nextTimer) clearTimeout(nextTimer);
      if (endTimer) clearTimeout(endTimer);
    };
  }, []);

  if (!active) return null;
  return <AmbientBurst key={burst} kind={kind} sequence={burst} />;
}

function AmbientBurst({ kind, sequence }: { kind: AmbientEffectKind; sequence: number }) {
  const { width, height } = useWindowDimensions();
  if (kind === 'petals') return <PetalBurst width={width} height={height} />;
  if (kind === 'shooting-star') return <ShootingStar width={width} />;
  if (kind === 'forest-wildlife') return <ForestVisitor width={width} sequence={sequence} />;
  if (kind === 'soft-glow') return <SoftGlow width={width} height={height} />;
  return null;
}

function PetalBurst({ width, height }: { width: number; height: number }) {
  const petals = useMemo(() => Array.from({ length: 11 }, (_, index) => ({
    index,
    left: ((index * 83 + 37) % 100) / 100 * Math.max(1, width - 28),
    duration: 7_800 + (index % 4) * 900,
    delay: (index % 6) * 520,
    scale: 0.7 + (index % 3) * 0.18,
  })), [width]);
  return <View pointerEvents="none" style={styles.ambientLayer}>{petals.map((petal) => <Petal key={petal.index} {...petal} height={height} />)}</View>;
}

function Petal({ left, duration, delay, scale, height }: { left: number; duration: number; delay: number; scale: number; height: number }) {
  const { colors } = useAppTheme();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver });
    animation.start();
    return () => animation.stop();
  }, [delay, duration, progress]);
  return <Animated.View style={[
    styles.petal,
    {
      left,
      backgroundColor: colors.accent,
      opacity: progress.interpolate({ inputRange: [0, 0.08, 0.82, 1], outputRange: [0, 0.58, 0.48, 0] }),
      transform: [
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-35, height + 90] }) },
        { translateX: progress.interpolate({ inputRange: [0, 0.4, 0.72, 1], outputRange: [0, 34, -18, 22] }) },
        { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '430deg'] }) },
        { scale },
      ],
    },
  ]} />;
}

function ShootingStar({ width }: { width: number }) {
  const { colors } = useAppTheme();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration: 4_600, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver });
    animation.start();
    return () => animation.stop();
  }, [progress]);
  return <View pointerEvents="none" style={styles.ambientLayer}><Animated.View style={[
    styles.shootingStar,
    {
      backgroundColor: colors.accent,
      opacity: progress.interpolate({ inputRange: [0, 0.12, 0.8, 1], outputRange: [0, 0.72, 0.5, 0] }),
      transform: [
        { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [width + 120, -180] }) },
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [80, 290] }) },
        { rotate: '-18deg' },
      ],
    },
  ]} /></View>;
}

function ForestVisitor({ width, sequence }: { width: number; sequence: number }) {
  const [progress] = useState(() => new Animated.Value(0));
  const bird = sequence % 3 === 0;
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration: bird ? 7_000 : 9_000, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver });
    animation.start();
    return () => animation.stop();
  }, [bird, progress]);
  return <View pointerEvents="none" style={styles.ambientLayer}><Animated.Text style={[
    styles.wildlife,
    { bottom: bird ? 190 : 86, fontSize: bird ? 26 : 34, opacity: progress.interpolate({ inputRange: [0, 0.08, 0.9, 1], outputRange: [0, 0.72, 0.72, 0] }), transform: [
      { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-70, width + 70] }) },
      { translateY: progress.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: [0, bird ? -18 : -2, bird ? 5 : -5, 0] }) },
      { scaleX: -1 },
    ] },
  ]}>{bird ? '🐦' : '🦊'}</Animated.Text></View>;
}

function SoftGlow({ width, height }: { width: number; height: number }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration: 6_500, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver });
    animation.start();
    return () => animation.stop();
  }, [progress]);
  return <View pointerEvents="none" style={styles.ambientLayer}><Animated.View style={[
    styles.softGlow,
    { height: height * 1.25, opacity: progress.interpolate({ inputRange: [0, 0.2, 0.75, 1], outputRange: [0, 0.1, 0.1, 0] }), transform: [
      { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-180, width + 180] }) },
      { rotate: '14deg' },
    ] },
  ]} /></View>;
}

const styles = StyleSheet.create({
  ambientLayer: { ...StyleSheet.absoluteFill, zIndex: 80, overflow: 'hidden' },
  petal: { position: 'absolute', top: -30, width: 11, height: 18, borderRadius: 10 },
  shootingStar: { position: 'absolute', top: 0, left: -110, width: 105, height: 2, borderRadius: 2, shadowOpacity: 0.5, shadowRadius: 8 },
  wildlife: { position: 'absolute', left: 0 },
  softGlow: { position: 'absolute', top: -120, left: -110, width: 115, backgroundColor: '#FFFFFF', borderRadius: 60 },
  sakuraLarge: { position: 'absolute', right: 18, top: 20, fontSize: 78, opacity: 0.07, transform: [{ rotate: '12deg' }] },
  sakuraSmall: { position: 'absolute', left: 10, top: '56%', fontSize: 42, opacity: 0.055, transform: [{ rotate: '-20deg' }] },
  starField: { position: 'absolute', right: 18, top: 24, fontSize: 18, letterSpacing: 7, opacity: 0.18 },
  midnightGlow: { position: 'absolute', right: -80, top: 100, width: 220, height: 220, borderRadius: 110, opacity: 0.16 },
  forestHillOne: { position: 'absolute', right: -90, top: 80, width: 280, height: 170, borderRadius: 140, opacity: 0.28, transform: [{ rotate: '-10deg' }] },
  forestHillTwo: { position: 'absolute', left: -120, bottom: 120, width: 320, height: 180, borderRadius: 160, opacity: 0.22 },
  forestSprig: { position: 'absolute', right: 20, bottom: 150, fontSize: 62, opacity: 0.09, transform: [{ rotate: '-25deg' }] },
  geometryOne: { position: 'absolute', right: -80, top: 100, width: 220, height: 220, borderRadius: 110, borderWidth: 34, opacity: 0.44 },
  geometryTwo: { position: 'absolute', left: -70, bottom: 130, width: 160, height: 160, borderRadius: 80, borderWidth: 24, opacity: 0.34 },
});
