import type { LegacyAICapabilities } from '@project-legacy/legacy-ai';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, TextInput, View } from 'react-native';

import PRODUCT from '../../../config/product.json';

import { OtherActionComposer } from '@/components/OtherActionComposer';
import { formatMoney } from '@/engine/money';
import { getLegacyAICapabilities } from '@/services/intentService';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Eyebrow, Heading, PrimaryButton, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

export default function MoreScreen() {
  const { world, busy, exportSave, importSave, deleteAllData, updateSettings, newLife } = useGame();
  const { colors } = useAppTheme();
  const [capabilities, setCapabilities] = useState<LegacyAICapabilities | null>(null);
  const [firstName, setFirstName] = useState('Alex');
  const [lastName, setLastName] = useState('Mercer');
  const [seed, setSeed] = useState('legacy-new-life');
  const [developerCode, setDeveloperCode] = useState('');
  useEffect(() => { void getLegacyAICapabilities().then(setCapabilities); }, []);
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const cases = Object.values(world.legalCases).filter((legalCase) => legalCase.characterId === actor.id);
  const exposures = Object.values(world.exposures).filter((exposure) => exposure.characterId === actor.id);

  const confirmNewLife = (startAgeYears: number) => {
    Alert.alert('Start a new local world?', 'The current save stays on this device until you delete it. The new world becomes the active save.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start life', onPress: () => { void newLife({ firstName, lastName, seed: seed || `legacy-${Date.now()}`, startAgeYears }); } },
    ]);
  };

  return (
    <AppScreen>
      <View style={styles.header}><View style={{ alignSelf: 'stretch', gap: 4 }}><Eyebrow>WORLD & DEVICE</Eyebrow><Heading size="large">More</Heading><Body secondary>Dynasty, health, law, organizations, saves, accessibility, and local intelligence.</Body></View><StatusPill tone="accent">v{PRODUCT.version}</StatusPill></View>

      <View style={styles.section}>
        <SectionHeader title="Dynasty" />
        <Card accent>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{world.dynasty.familyName} legacy</Heading><Body secondary>Founded by {world.characters[world.dynasty.founderId]?.firstName} · Generation {world.dynasty.generation}</Body></View><StatusPill tone="warning">{world.dynasty.activeHeirId ? `${world.characters[world.dynasty.activeHeirId]?.firstName} preferred` : 'Open succession'}</StatusPill></View>
          <View style={styles.stats}><Stat label="Family records" value={world.dynasty.notableHistory.length.toString()} /><Stat label="Living family" value={Object.values(world.characters).filter((character) => character.isAlive && character.lastName === world.dynasty.familyName).length.toString()} /><Stat label="Current cash" value={formatMoney(actor.cashCents, true)} /></View>
          {world.dynasty.notableHistory.slice(-5).map((history) => <Body key={history} secondary>• {history}</Body>)}
          <PrimaryButton title="Open dynasty & succession" onPress={() => router.push('/dynasty' as never)} />
        </Card>
        <View style={styles.actions}><PrimaryButton title="World History" style={{ flex: 1 }} onPress={() => router.push('/history' as never)} /><PrimaryButton title="Search & Pins" tone="neutral" style={{ flex: 1 }} onPress={() => router.push('/search' as never)} /></View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Legal exposure" action={<StatusPill tone={exposures.some((exposure) => !exposure.resolved) ? 'warning' : 'success'}>{cases.length} cases · {exposures.length} records</StatusPill>} />
        {exposures.length === 0 ? <Card><Body secondary>No evidence or misconduct exposure is recorded for the active character.</Body></Card> : exposures.map((exposure) => <Card key={exposure.id}><View style={styles.row}><Heading size="small">{exposure.category.replaceAll('.', ' ')}</Heading><StatusPill tone={exposure.discovered ? 'danger' : 'warning'}>{exposure.discovered ? 'Discovered' : 'Hidden exposure'}</StatusPill></View><Body secondary>Evidence {Math.round(exposure.evidence)} · severity {Math.round(exposure.severity)} · created week {exposure.createdWeek}</Body></Card>)}
      </View>

      <View style={styles.section}>
        <SectionHeader title="On-device intelligence" />
        <Card>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">LegacyAI</Heading><Body secondary>{capabilities?.moduleVersion ?? 'Checking local capability…'}</Body></View><StatusPill tone={capabilities?.enhancedAvailable ? 'success' : 'neutral'}>{capabilities?.enhancedAvailable ? 'Enhanced ready' : 'Baseline ready'}</StatusPill></View>
          <Body secondary>{capabilities?.enhancedAvailable ? 'Apple Foundation Models is available on this device. Requests remain local.' : capabilities?.enhancedReason ?? 'The deterministic baseline works without Apple Intelligence.'}</Body>
          <SettingRow label="Enhanced local language" detail="Use Apple Foundation Models when available; fall back silently." value={world.settings.enhancedAIEnabled} onChange={(value) => { void updateSettings({ enhancedAIEnabled: value }); }} />
          <Body secondary>The module receives only bounded current context. It has no save-database handle, network fallback, account, or hosted endpoint.</Body>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Accessibility & feedback" />
        <Card>
          <SettingRow label="Haptic feedback" detail="Mark completed advances and major events." value={world.settings.hapticsEnabled} onChange={(value) => { void updateSettings({ hapticsEnabled: value }); }} />
          <SettingRow label="Reduced motion" detail="Keep transitions and decorative movement minimal." value={world.settings.reducedMotion} onChange={(value) => { void updateSettings({ reducedMotion: value }); }} />
          <SettingRow label="High contrast" detail="Strengthen text, border, status, and control contrast in light or dark mode." value={world.settings.highContrast} onChange={(value) => { void updateSettings({ highContrast: value }); }} />
          <SettingRow label="Qualitative risk" detail="Hide exact secret probabilities and show advisor-style guidance." value={world.settings.qualitativeRiskOnly} onChange={(value) => { void updateSettings({ qualitativeRiskOnly: value }); }} />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Local save ownership" />
        <Card>
          <Body secondary>SQLite is authoritative on iOS. Export creates a checksummed, compressed .legacy package. Import validates and migrates before it becomes active.</Body>
          <View style={styles.actions}><PrimaryButton title="Export to Files" disabled={busy} onPress={() => { void exportSave(); }} style={{ flex: 1 }} /><PrimaryButton title="Import save" tone="neutral" disabled={busy} onPress={() => { void importSave(); }} style={{ flex: 1 }} /></View>
          <PrimaryButton title="Open save slots & rollback" tone="neutral" onPress={() => router.push('/saves' as never)} />
          <PrimaryButton title="Delete all local data" tone="danger" disabled={busy} onPress={() => Alert.alert('Delete all local data?', 'This permanently removes every local save, recovery checkpoint, event journal, and diagnostic record. Export first if you may want it later.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete everything', style: 'destructive', onPress: () => { void deleteAllData(); } }])} />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Updates & diagnostics" />
        <Card>
          <PrimaryButton title="Over-the-air updates" onPress={() => router.push('/updates' as never)} />
          {world.settings.developerUnlocked ? <><PrimaryButton title="Simulation developer menu" tone="neutral" onPress={() => router.push('/developer' as never)} /><PrimaryButton title="AI interpreter log" tone="neutral" onPress={() => router.push('/interpreter-log' as never)} /></> : <><Body secondary>Enter the project QA code to reveal simulation controls and interpreter diagnostics.</Body><View style={styles.actions}><TextInput accessibilityLabel="Developer menu code" secureTextEntry keyboardType="number-pad" value={developerCode} onChangeText={setDeveloperCode} placeholder="Developer code" placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, backgroundColor: colors.secondary, borderColor: colors.border }]} /><PrimaryButton title="Unlock" disabled={developerCode.length !== 4} onPress={() => { if (developerCode === '1679') { void updateSettings({ developerUnlocked: true }).then(() => router.push('/developer' as never)); } else Alert.alert('Code not recognized', 'The developer menu remains locked.'); }} /></View></>}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Begin another life" />
        <Card>
          <View style={styles.actions}><TextInput accessibilityLabel="First name" value={firstName} onChangeText={setFirstName} placeholder="First name" placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, backgroundColor: colors.secondary, borderColor: colors.border }]} /><TextInput accessibilityLabel="Last name" value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, backgroundColor: colors.secondary, borderColor: colors.border }]} /></View>
          <TextInput accessibilityLabel="World seed" value={seed} onChangeText={setSeed} autoCapitalize="none" placeholder="World seed" placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, backgroundColor: colors.secondary, borderColor: colors.border }]} />
          <View style={styles.actions}><PrimaryButton title="Begin at birth" tone="neutral" style={{ flex: 1 }} onPress={() => confirmNewLife(0)} /><PrimaryButton title="Begin at 18" style={{ flex: 1 }} onPress={() => confirmNewLife(18)} /></View>
        </Card>
      </View>

      <OtherActionComposer domains={['legal', 'organization', 'dynasty', 'geopolitics']} placeholder="Hire counsel, choose a successor, fund an organization, or attempt an abstract power path…" />

      <Card><Eyebrow>PRIVACY</Eyebrow><Body secondary>No account. No developer cloud save. No hosted AI. No save-content analytics. Core gameplay never waits for network reachability.</Body></Card>
    </AppScreen>
  );
}

function SettingRow({ label, detail, value, onChange }: { label: string; detail: string; value: boolean; onChange(value: boolean): void }) {
  return <View style={styles.setting}><View style={{ flex: 1, gap: 2 }}><Body>{label}</Body><Body secondary>{detail}</Body></View><Switch accessibilityLabel={label} value={value} onValueChange={onChange} /></View>;
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, alignItems: 'flex-start', paddingTop: 8 },
  section: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  setting: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  input: { minHeight: 48, flex: 1, minWidth: 130, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 13, fontSize: 15 },
});
