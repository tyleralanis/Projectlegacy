import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing, useAppTheme } from './theme';

import { getActiveEvent } from '@/engine/simulation';
import { useGame } from '@/state/GameProvider';


export function AppScreen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const { colors } = useAppTheme();
  const content = scroll ? (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>{children}</ScrollView>
  ) : (
    <View style={styles.scrollContent}>{children}</View>
  );
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      {content}
      <TimeTray />
    </SafeAreaView>
  );
}

export function Card({ children, style, accent = false }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; accent?: boolean }) {
  const { colors } = useAppTheme();
  return <View style={[styles.card, { backgroundColor: accent ? colors.accentSoft : colors.surface, borderColor: colors.border, shadowColor: colors.shadow }, style]}>{children}</View>;
}

export function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  const { colors } = useAppTheme();
  return <Text accessibilityRole="text" style={[styles.eyebrow, { color: color ?? colors.textSecondary }]}>{children}</Text>;
}

export function Heading({ children, size = 'medium', style }: { children: React.ReactNode; size?: 'large' | 'medium' | 'small'; style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();
  return <Text accessibilityRole="header" style={[styles.heading, size === 'large' && styles.headingLarge, size === 'small' && styles.headingSmall, { color: colors.text }, style as never]}>{children}</Text>;
}

export function Body({ children, secondary = false, style }: { children: React.ReactNode; secondary?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();
  return <Text style={[styles.body, { color: secondary ? colors.textSecondary : colors.text }, style as never]}>{children}</Text>;
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return <View style={styles.sectionHeader}><Heading size="small">{title}</Heading>{action}</View>;
}

export function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'success' | 'danger' | 'legacy' }) {
  const { colors } = useAppTheme();
  const color = tone === 'success' ? colors.success : tone === 'danger' ? colors.danger : tone === 'legacy' ? colors.legacy : colors.text;
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

export function StatusPill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'warning' }) {
  const { colors } = useAppTheme();
  const foreground = tone === 'accent' ? colors.accent : tone === 'success' ? colors.success : tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : colors.textSecondary;
  return <View style={[styles.pill, { borderColor: foreground }]}><Text style={[styles.pillText, { color: foreground }]}>{children}</Text></View>;
}

export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'success' | 'danger' | 'legacy' }) {
  const { colors } = useAppTheme();
  const foreground = tone === 'success' ? colors.success : tone === 'danger' ? colors.danger : tone === 'legacy' ? colors.legacy : colors.accent;
  return <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: foreground }]} /></View>;
}

export function PrimaryButton({ title, tone = 'accent', disabled, style, ...props }: PressableProps & { title: string; tone?: 'accent' | 'danger' | 'neutral'; style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();
  const background = tone === 'danger' ? colors.danger : tone === 'neutral' ? colors.secondary : colors.accent;
  const foreground = tone === 'neutral' ? colors.text : '#FFFFFF';
  return (
    <Pressable accessibilityRole="button" disabled={disabled} style={({ pressed }) => [styles.button, { backgroundColor: background, opacity: disabled ? 0.45 : pressed ? 0.78 : 1 }, style]} {...props}>
      <Text style={[styles.buttonText, { color: foreground }]}>{title}</Text>
    </Pressable>
  );
}

export function LoadingScreen() {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.loading, { backgroundColor: colors.canvas }]}>
      <LinearGradient colors={[colors.accent, colors.legacy]} style={styles.loadingMark} />
      <Heading size="large">Project Legacy</Heading>
      <ActivityIndicator color={colors.accent} />
      <Body secondary>Opening your local world…</Body>
    </View>
  );
}

export function NoticeBanner() {
  const { error, message, clearNotice } = useGame();
  const { colors } = useAppTheme();
  const text = error ?? message;
  if (!text) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${error ? 'Error' : 'Notice'}: ${text}. Tap to dismiss.`} onPress={clearNotice} style={[styles.notice, { backgroundColor: error ? colors.danger : colors.accent, shadowColor: colors.shadow }]}>
      <Text style={styles.noticeText}>{text}</Text>
      <Text style={styles.noticeDismiss}>Dismiss</Text>
    </Pressable>
  );
}

const timeOptions = [
  { label: '1W', weeks: 1 },
  { label: '1M', weeks: 4 },
  { label: '3M', weeks: 13 },
  { label: '6M', weeks: 26 },
  { label: '1Y', weeks: 52 },
] as const;

function TimeTray() {
  const { world, busy, advance, activityFor } = useGame();
  const { colors } = useAppTheme();
  if (!world) return null;
  const activeEvent = getActiveEvent(world);
  const onAdvance = (label: string, weeks: number) => {
    const activity = activityFor(weeks);
    if (weeks >= 26) {
      Alert.alert(
        `${activity} activity ahead`,
        `${label} will process every weekly obligation. Major decisions still interrupt; routine choices follow your standing focuses and policies.`,
        [{ text: 'Cancel', style: 'cancel' }, { text: `Advance ${label}`, onPress: () => { void advance(weeks); } }],
      );
    } else void advance(weeks);
  };
  return (
    <View style={[styles.timeTray, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow }]}>
      <View style={styles.timeTrayHeader}>
        <Eyebrow>ADVANCE TIME</Eyebrow>
        {activeEvent ? <StatusPill tone="warning">Decision waiting</StatusPill> : <StatusPill tone="neutral">Weekly engine</StatusPill>}
      </View>
      <View style={styles.timeButtons}>
        {timeOptions.map((option) => (
          <Pressable
            key={option.label}
            accessibilityRole="button"
            accessibilityLabel={`Advance ${option.label}, ${activityFor(option.weeks).toLowerCase()} activity`}
            disabled={busy || Boolean(activeEvent)}
            onPress={() => onAdvance(option.label, option.weeks)}
            style={({ pressed }) => [styles.timeButton, { borderColor: colors.border, backgroundColor: pressed ? colors.accentSoft : colors.secondary, opacity: busy || activeEvent ? 0.38 : 1 }]}
          >
            <Text style={[styles.timeButtonText, { color: colors.text }]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 132, gap: 16 },
  card: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12, shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  eyebrow: { fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 1.3 },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.35 },
  headingLarge: { fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  headingSmall: { fontSize: 17, lineHeight: 22, letterSpacing: -0.15 },
  body: { fontSize: 15, lineHeight: 21 },
  sectionHeader: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  stat: { flex: 1, minWidth: 78, gap: 2 },
  statValue: { fontSize: 20, lineHeight: 25, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  pill: { minHeight: 25, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, justifyContent: 'center', alignSelf: 'flex-start' },
  pillText: { fontSize: 11, lineHeight: 15, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  button: { minHeight: 46, borderRadius: radius.md, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  loadingMark: { width: 42, height: 42, borderRadius: 14, transform: [{ rotate: '45deg' }] },
  notice: { marginHorizontal: 20, marginTop: 8, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', gap: 12, alignItems: 'center', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  noticeText: { flex: 1, color: '#FFFFFF', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  noticeDismiss: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', opacity: 0.85 },
  timeTray: { position: 'absolute', left: 12, right: 12, bottom: 4, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 10, gap: 8, shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  timeTrayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  timeButtons: { flexDirection: 'row', gap: 7 },
  timeButton: { flex: 1, minHeight: 44, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  timeButtonText: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
