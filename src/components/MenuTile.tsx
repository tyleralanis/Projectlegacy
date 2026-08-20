import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Heading, StatusPill } from '@/ui/components';
import { spacing, useAppTheme } from '@/ui/theme';

export function MenuTile({ icon, title, subtitle, route, badge }: { icon: string; title: string; subtitle: string; route: string; badge?: string }) {
  const { colors } = useAppTheme();
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(route as never)} style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.76 : 1 }]}>
      <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}><Text style={styles.iconText}>{icon}</Text></View>
      <View style={styles.copy}><View style={styles.titleRow}><Heading size="small">{title}</Heading>{badge ? <StatusPill tone="accent">{badge}</StatusPill> : null}</View><Body secondary>{subtitle}</Body></View>
      <Text style={[styles.chevron, { color: colors.accent }]}>›</Text>
    </Pressable>
  );
}

export function SubviewHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.header}>
      <View style={{ gap: 4 }}><Text style={[styles.eyebrow, { color: colors.textSecondary }]}>{eyebrow.toUpperCase()}</Text><Heading size="large">{title}</Heading>{subtitle ? <Body secondary>{subtitle}</Body> : null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { minHeight: 92, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 25 },
  copy: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chevron: { fontSize: 34, fontWeight: '300', marginLeft: 2 },
  header: { gap: spacing.md, paddingTop: 6, paddingBottom: 4 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
});
