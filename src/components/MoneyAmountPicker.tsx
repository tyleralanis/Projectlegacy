import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatMoney } from '@/engine/money';
import { Body } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

interface MoneyAmountPickerProps {
  maxCents: number;
  valueCents: number;
  onChange: (valueCents: number) => void;
  label?: string;
  remainingLabel?: string;
}

function clampCents(value: number, maximum: number): number {
  return Math.max(0, Math.min(Math.max(0, Math.round(maximum)), Math.round(Number.isFinite(value) ? value : 0)));
}

function draftFromCents(cents: number): string {
  return Math.round(cents / 100).toLocaleString('en-US');
}

function centsFromDraft(value: string): number | null {
  const normalized = value.replace(/[^0-9.]/g, '');
  if (!normalized) return null;
  const dollars = Number(normalized);
  return Number.isFinite(dollars) ? Math.round(dollars * 100) : null;
}

export function MoneyAmountPicker({
  maxCents,
  valueCents,
  onChange,
  label = 'Amount',
  remainingLabel = 'Cash remaining',
}: MoneyAmountPickerProps) {
  const { colors } = useAppTheme();
  const maximum = Math.max(0, Math.round(maxCents));
  const value = clampCents(valueCents, maximum);
  const [trackWidth, setTrackWidth] = useState(1);
  const [draft, setDraft] = useState(() => draftFromCents(value));
  const percentage = maximum > 0 ? value / maximum : 0;
  const percentageLabel = Math.round(percentage * 100);

  useEffect(() => {
    setDraft(draftFromCents(value));
  }, [value]);

  const shortcuts = useMemo(() => [10, 25, 50, 100] as const, []);
  const updateFromX = (x: number) => {
    if (maximum <= 0) return;
    const next = clampCents(maximum * Math.max(0, Math.min(1, x / Math.max(1, trackWidth))), maximum);
    onChange(next);
  };
  const commitDraft = (text: string) => {
    const parsed = centsFromDraft(text);
    if (parsed === null) {
      setDraft(draftFromCents(value));
      return;
    }
    const next = clampCents(parsed, maximum);
    onChange(next);
    setDraft(draftFromCents(next));
  };

  return (
    <View style={styles.root}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryCell}>
          <Body secondary>Available liquidity</Body>
          <Text style={[styles.value, { color: colors.text }]}>{formatMoney(maximum, true)}</Text>
        </View>
        <View style={[styles.summaryCell, styles.summaryRight]}>
          <Body secondary>{label}</Body>
          <Text style={[styles.value, { color: colors.accent }]}>{formatMoney(value, true)}</Text>
        </View>
      </View>

      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${label}: ${formatMoney(value, true)} of ${formatMoney(maximum, true)} available`}
        accessibilityValue={{ min: 0, max: 100, now: percentageLabel, text: `${percentageLabel}%` }}
        onLayout={(event) => setTrackWidth(Math.max(1, event.nativeEvent.layout.width))}
        onStartShouldSetResponder={() => maximum > 0}
        onMoveShouldSetResponder={() => maximum > 0}
        onResponderGrant={(event) => updateFromX(event.nativeEvent.locationX)}
        onResponderMove={(event) => updateFromX(event.nativeEvent.locationX)}
        style={[styles.track, { backgroundColor: colors.secondary, borderColor: colors.border }]}
      >
        <View style={[styles.fill, { width: `${percentage * 100}%`, backgroundColor: colors.accent }]} />
        <View style={[styles.thumb, { left: `${percentage * 100}%`, backgroundColor: colors.surface, borderColor: colors.accent, shadowColor: colors.shadow }]} />
      </View>

      <View style={styles.shortcutRow}>
        {shortcuts.map((percent) => (
          <Pressable
            key={percent}
            accessibilityRole="button"
            accessibilityLabel={`Use ${percent === 100 ? 'maximum' : `${percent} percent`} of available liquidity`}
            disabled={maximum <= 0}
            onPress={() => onChange(clampCents(maximum * percent / 100, maximum))}
            style={({ pressed }) => [
              styles.shortcut,
              {
                backgroundColor: percentageLabel === percent ? colors.accentSoft : colors.secondary,
                borderColor: colors.border,
                opacity: maximum <= 0 ? 0.45 : pressed ? 0.75 : 1,
              },
            ]}
          >
            <Text style={[styles.shortcutText, { color: colors.text }]}>{percent === 100 ? 'Max' : `${percent}%`}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.entryRow}>
        <View style={[styles.inputShell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.currencyMark, { color: colors.textSecondary }]}>$</Text>
          <TextInput
            accessibilityLabel={`${label} in dollars`}
            value={draft}
            onChangeText={(text) => {
              setDraft(text);
              const parsed = centsFromDraft(text);
              if (parsed !== null) onChange(clampCents(parsed, maximum));
            }}
            onBlur={() => commitDraft(draft)}
            keyboardType="decimal-pad"
            returnKeyType="done"
            selectTextOnFocus
            style={[styles.input, { color: colors.text }]}
          />
        </View>
        <View style={styles.remaining}>
          <Body secondary>{remainingLabel}</Body>
          <Text style={[styles.remainingValue, { color: colors.text }]}>{formatMoney(Math.max(0, maximum - value), true)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  summaryCell: { flex: 1, gap: 2 },
  summaryRight: { alignItems: 'flex-end' },
  value: { fontSize: 18, lineHeight: 23, fontWeight: '800', fontVariant: ['tabular-nums'] },
  track: { height: 30, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', overflow: 'visible' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.pill, opacity: 0.34 },
  thumb: { position: 'absolute', width: 26, height: 26, marginLeft: -13, borderRadius: 13, borderWidth: 3, shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  shortcutRow: { flexDirection: 'row', gap: spacing.sm },
  shortcut: { flex: 1, minHeight: 38, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  shortcutText: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  entryRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch' },
  inputShell: { flex: 1.15, minHeight: 48, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  currencyMark: { fontSize: 16, fontWeight: '700', marginRight: 2 },
  input: { flex: 1, minHeight: 44, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  remaining: { flex: 1, justifyContent: 'center', alignItems: 'flex-end', gap: 2 },
  remainingValue: { fontSize: 14, lineHeight: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
