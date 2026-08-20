import type { LegacyAICapabilities } from '@project-legacy/legacy-ai';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, TextInput, View } from 'react-native';

import PRODUCT from '../../../config/product.json';

import { EngineActionButton } from '@/components/EngineActionButton';
import { OtherActionComposer } from '@/components/OtherActionComposer';
import { formatMoney } from '@/engine/money';
import { getLegacyAICapabilities } from '@/services/intentService';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Eyebrow, Heading, PrimaryButton, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

function qualitative(value: number): string {
  if (value >= 75) return 'Very high';
  if (value >= 55) return 'High';
  if (value >= 35) return 'Moderate';
  if (value >= 18) return 'Low';
  return 'Very low';
}

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
  const activeCases = cases.filter((legalCase) => legalCase.stage !== 'resolved');
  const exposures = Object.values(world.exposures).filter((exposure) => exposure.characterId === actor.id);
  const openExposures = exposures.filter((exposure) => !exposure.resolved);

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
        <SectionHeader title="Legal" action={<StatusPill tone={activeCases.length > 0 ? 'danger' : openExposures.length > 0 ? 'warning' : 'success'}>{activeCases.length} active · {openExposures.length} exposure{openExposures.length === 1 ? '' : 's'}</StatusPill>} />
        {activeCases.length === 0 && openExposures.length === 0 ? <Card><Heading size="small">Nothing active</Heading><Body secondary>No unresolved legal exposure or active case is recorded for the current character.</Body></Card> : null}

        {activeCases.map((legalCase) => {
          const exposure = world.exposures[legalCase.exposureId];
          const riskText = world.settings.qualitativeRiskOnly ? qualitative(legalCase.risk) : `${Math.round(legalCase.risk)}/100`;
          const update = Object.values(world.memories).find((memory) => memory.category === `Legal · Case update · ${legalCase.id}`);
          return <Card key={legalCase.id} accent>
            <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">Active {legalCase.stage}</Heading><Body secondary>{exposure?.category.replaceAll('.', ' ') ?? 'Legal matter'}</Body></View><StatusPill tone={legalCase.risk >= 70 ? 'danger' : legalCase.risk >= 45 ? 'warning' : 'accent'}>{riskText} risk</StatusPill></View>
            <View style={styles.stats}><Stat label="Stage" value={legalCase.stage} /><Stat label="Counsel" value={`${Math.round(legalCase.counselQuality)}/100`} /><Stat label="Evidence" value={world.settings.qualitativeRiskOnly ? qualitative(exposure?.evidence ?? 0) : `${Math.round(exposure?.evidence ?? 0)}/100`} /><Stat label="Severity" value={world.settings.qualitativeRiskOnly ? qualitative(exposure?.severity ?? 0) : `${Math.round(exposure?.severity ?? 0)}/100`} /></View>
            <ProgressBar value={legalCase.risk} tone={legalCase.risk >= 70 ? 'danger' : 'legacy'} />
            {update ? <Body secondary>{update.narrative}</Body> : <Body secondary>The matter will now progress on recurring quarterly checks. Evidence, severity, counsel, prior legal choices, cost, and uncertainty all continue to matter after the first event.</Body>}
            <View style={styles.actions}>
              <EngineActionButton title="Strengthen counsel · $15k" action={{ verb: 'legal.hire_counsel', targetIds: [legalCase.id], parameters: { amountCents: 1_500_000 } }} tone="accent" style={styles.actionButton} />
              <EngineActionButton title="Cooperate" action={{ verb: 'legal.cooperate', targetIds: [legalCase.id], parameters: {} }} style={styles.actionButton} />
              <EngineActionButton title="Contest" action={{ verb: 'legal.contest', targetIds: [legalCase.id], parameters: {} }} style={styles.actionButton} />
            </View>
            <Body secondary>Premium counsel can create ongoing case costs. A legal action changes the risk trajectory; it does not erase the underlying evidence.</Body>
          </Card>;
        })}

        {cases.filter((legalCase) => legalCase.stage === 'resolved').slice(-3).map((legalCase) => <Card key={legalCase.id}>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">Resolved matter</Heading><Body secondary>{world.exposures[legalCase.exposureId]?.category.replaceAll('.', ' ') ?? 'Legal case'}</Body></View><StatusPill tone={legalCase.outcome === 'convicted' ? 'danger' : legalCase.outcome === 'settled' ? 'warning' : 'success'}>{legalCase.outcome ?? 'resolved'}</StatusPill></View>
          <Body secondary>The case is over, but the financial, reputation, relationship, political, and historical consequences remain in the world.</Body>
        </Card>)}

        {openExposures.filter((exposure) => !exposure.discovered).map((exposure) => <Card key={exposure.id}>
          <View style={styles.row}><Heading size="small">Unresolved exposure</Heading><StatusPill tone="warning">Not discovered</StatusPill></View>
          <Body secondary>{exposure.category.replaceAll('.', ' ')}</Body>
          <Body secondary>{world.settings.qualitativeRiskOnly ? `Evidence appears ${qualitative(exposure.evidence).toLowerCase()} and discoverability appears ${qualitative(exposure.discoverability).toLowerCase()}.` : `Evidence ${Math.round(exposure.evidence)} · severity ${Math.round(exposure.severity)} · discoverability ${Math.round(exposure.discoverability)} · created week ${exposure.createdWeek}.`}</Body>
          <Body secondary>Old exposure remains in the simulation even when nobody is currently investigating it. Time does not automatically wipe the record clean.</Body>
        </Card>)}
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
  actionButton: { flexGrow: 1, flexBasis: 130 },
  input: { minHeight: 48, flex: 1, minWidth: 130, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 13, fontSize: 15 },
});
