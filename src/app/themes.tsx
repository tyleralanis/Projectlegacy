import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import type { VisualThemeId } from '@/engine/types';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Eyebrow, Heading, PrimaryButton, StatusPill } from '@/ui/components';
import { THEME_PRESETS, radius, spacing, useAppTheme, type ThemePreset } from '@/ui/theme';

const motifGlyph: Record<ThemePreset['motif'], string> = {
  none: '◉', sakura: '✿', stars: '✦', forest: '❧', geometry: '◌',
};

export default function ThemesScreen() {
  const { world, updateSettings } = useGame();
  const { colors, theme } = useAppTheme();
  if (!world) return null;
  const selectedId: VisualThemeId = world.settings.visualTheme ?? 'classic';
  const effectsEnabled = world.settings.ambientThemeEffects ?? true;
  const accessibilitySuppressed = world.settings.reducedMotion || world.settings.highContrast;

  return (
    <AppScreen>
      <View style={styles.header}>
        <Eyebrow>APPEARANCE</Eyebrow>
        <Heading size="large">Themes</Heading>
        <Body secondary>Change the entire mood of Project Legacy without changing the simulation underneath it.</Body>
      </View>

      <Card accent>
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 4 }}>
            <Heading size="small">Ambient screen effects</Heading>
            <Body secondary>{theme.ambient.label}. {theme.ambient.detail}</Body>
          </View>
          <Switch
            accessibilityLabel="Ambient screen effects"
            value={effectsEnabled && !accessibilitySuppressed}
            disabled={accessibilitySuppressed || theme.ambient.kind === 'none'}
            onValueChange={(value) => { void updateSettings({ ambientThemeEffects: value }); }}
          />
        </View>
        {theme.ambient.kind === 'none' ? <Body secondary>Classic Legacy intentionally has no decorative motion.</Body> : null}
        {world.settings.reducedMotion ? <Body secondary>Reduced Motion is enabled, so decorative animation is suppressed automatically even if this toggle is saved on.</Body> : null}
        {world.settings.highContrast ? <Body secondary>High Contrast is enabled, so decorative animation is suppressed to keep the interface visually predictable.</Body> : null}
        {!accessibilitySuppressed && theme.ambient.kind !== 'none' ? <StatusPill tone={effectsEnabled ? 'success' : 'neutral'}>{effectsEnabled ? 'Screen ambience on' : 'Screen ambience off'}</StatusPill> : null}
      </Card>

      <View style={styles.section}>
        {THEME_PRESETS.map((preset) => <ThemeOption
          key={preset.id}
          preset={preset}
          selected={preset.id === selectedId}
          onSelect={() => { void updateSettings({ visualTheme: preset.id }); }}
        />)}
      </View>

      <Card>
        <Heading size="small">How the effects behave</Heading>
        <Body secondary>Ambient moments are intentionally rare: roughly one short scene every 3–4 minutes. They never block taps, never change outcomes, and stop automatically when Reduced Motion or High Contrast is active.</Body>
      </Card>
    </AppScreen>
  );
}

function ThemeOption({ preset, selected, onSelect }: { preset: ThemePreset; selected: boolean; onSelect(): void }) {
  const palette = preset.appearance === 'dark' && preset.dark ? preset.dark : preset.light;
  const previewPalette = preset.light;
  return (
    <Card style={selected ? styles.selectedCard : undefined}>
      <View style={[styles.preview, { backgroundColor: previewPalette.canvas, borderColor: previewPalette.border }]}>
        <View style={[styles.previewGlow, { backgroundColor: previewPalette.accentSoft }]} />
        <View style={styles.previewHeader}>
          <Text style={[styles.previewGlyph, { color: previewPalette.accent }]}>{motifGlyph[preset.motif]}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.previewEyebrow, { color: previewPalette.textSecondary }]}>FEBRUARY 28, 2028</Text>
            <Text style={[styles.previewName, { color: previewPalette.text }]}>Alex Mercer</Text>
          </View>
        </View>
        <View style={[styles.previewCard, { backgroundColor: previewPalette.surface, borderColor: previewPalette.border }]}>
          <View style={styles.previewStat}><Text style={[styles.previewValue, { color: previewPalette.text }]}>$1.96M</Text><Text style={[styles.previewLabel, { color: previewPalette.textSecondary }]}>Cash</Text></View>
          <View style={styles.previewStat}><Text style={[styles.previewValue, { color: previewPalette.legacy }]}>$3.29M</Text><Text style={[styles.previewLabel, { color: previewPalette.textSecondary }]}>Net worth</Text></View>
          <View style={styles.previewStat}><Text style={[styles.previewValue, { color: previewPalette.success }]}>Excellent</Text><Text style={[styles.previewLabel, { color: previewPalette.textSecondary }]}>Health</Text></View>
        </View>
        <View style={[styles.previewBarTrack, { backgroundColor: previewPalette.secondary }]}><View style={[styles.previewBarFill, { backgroundColor: previewPalette.accent }]} /></View>
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1, gap: 3 }}>
          <Heading>{preset.name}</Heading>
          <Body secondary>{preset.description}</Body>
        </View>
        {selected ? <StatusPill tone="success">Selected</StatusPill> : null}
      </View>
      <View style={styles.swatches}>
        {[palette.canvas, palette.surface, palette.accent, palette.legacy, palette.success].map((color, index) => <View key={`${preset.id}-${index}`} style={[styles.swatch, { backgroundColor: color, borderColor: palette.border }]} />)}
      </View>
      <View style={styles.effectRow}>
        <Text style={[styles.effectGlyph, { color: palette.accent }]}>{motifGlyph[preset.motif]}</Text>
        <View style={{ flex: 1, gap: 2 }}><Body>{preset.ambient.label}</Body><Body secondary>{preset.ambient.detail}</Body></View>
      </View>
      <PrimaryButton title={selected ? 'Using this theme' : `Use ${preset.name}`} tone={selected ? 'neutral' : 'accent'} disabled={selected} onPress={onSelect} />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, paddingTop: 8 },
  section: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  selectedCard: { borderWidth: 2 },
  preview: { minHeight: 170, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card, padding: 14, gap: 12, overflow: 'hidden' },
  previewGlow: { position: 'absolute', right: -40, top: -45, width: 150, height: 150, borderRadius: 75, opacity: 0.7 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewGlyph: { fontSize: 30, width: 34, textAlign: 'center' },
  previewEyebrow: { fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  previewName: { fontSize: 24, fontWeight: '700' },
  previewCard: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: 12, gap: 10 },
  previewStat: { flex: 1, gap: 2 },
  previewValue: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  previewLabel: { fontSize: 9, fontWeight: '600' },
  previewBarTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  previewBarFill: { width: '78%', height: '100%', borderRadius: 3 },
  swatches: { flexDirection: 'row', gap: 8 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  effectRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  effectGlyph: { width: 38, fontSize: 28, textAlign: 'center' },
});
