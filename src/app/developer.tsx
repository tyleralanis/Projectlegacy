import React, { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { DetailScreen } from '@/components/DetailScreen';
import { inspectNpcMemory } from '@/engine/developerTools';
import { useGame } from '@/state/GameProvider';
import { Body, Card, Eyebrow, Heading, PrimaryButton, StatusPill } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

export default function DeveloperScreen() {
  const { world, runDeveloper } = useGame();
  const { colors } = useAppTheme();
  const [years, setYears] = useState('10');
  const [money, setMoney] = useState('1000000');
  const [company, setCompany] = useState('QA Company');
  const [selectedNpc, setSelectedNpc] = useState<string | null>(null);
  const memories = useMemo(() => world && selectedNpc ? inspectNpcMemory(world, selectedNpc) : [], [selectedNpc, world]);
  if (!world) return null;
  if (!world.settings.developerUnlocked) return <DetailScreen title="Developer Menu" eyebrow="LOCKED"><Card><Body>This menu must be unlocked from More.</Body></Card></DetailScreen>;
  const actor = world.characters[world.playerCharacterId];
  const otherCharacters = Object.values(world.characters).filter((character) => character.id !== actor.id);
  return (
    <DetailScreen title="Simulation Lab" eyebrow="DEVELOPER MENU · CODE 1679">
      <Card accent><StatusPill tone="warning">QA only</StatusPill><Body secondary>Every tool changes only this fictional local world. Use save rollback generations to undo a test.</Body></Card>
      <Card><Heading size="small">Time and money</Heading><View style={styles.row}><TextInput accessibilityLabel="Years to jump" keyboardType="number-pad" value={years} onChangeText={setYears} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.secondary }]} /><PrimaryButton title="Jump age" style={{ flex: 1 }} onPress={() => { void runDeveloper({ kind: 'jump-age', years: Number(years) }); }} /></View><View style={styles.row}><TextInput accessibilityLabel="Dollars to inject" keyboardType="number-pad" value={money} onChangeText={setMoney} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.secondary }]} /><PrimaryButton title="Inject money" style={{ flex: 1 }} onPress={() => { void runDeveloper({ kind: 'inject-money', amountCents: Number(money) * 100 }); }} /></View></Card>
      <Card><Heading size="small">Business and economy</Heading><TextInput accessibilityLabel="Test company name" value={company} onChangeText={setCompany} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.secondary }]} /><PrimaryButton title="Create company" onPress={() => { void runDeveloper({ kind: 'create-company', name: company }); }} /><PrimaryButton title="Force recession" tone="neutral" onPress={() => { void runDeveloper({ kind: 'force-recession' }); }} /></Card>
      <Card><Heading size="small">Country</Heading>{Object.values(world.countries).map((country) => <PrimaryButton key={country.id} title={`${world.activeCountryId === country.id ? 'Current: ' : 'Move to '}${country.name}`} tone={world.activeCountryId === country.id ? 'neutral' : 'accent'} disabled={world.activeCountryId === country.id} onPress={() => { void runDeveloper({ kind: 'change-country', countryId: country.id }); }} />)}</Card>
      <Card><Heading size="small">Relationships and mortality</Heading><PrimaryButton title="Trigger divorce" tone="neutral" disabled={!actor.partnerId} onPress={() => { void runDeveloper({ kind: 'trigger-divorce' }); }} />{otherCharacters.map((character) => <PrimaryButton key={character.id} title={`Kill ${character.firstName} ${character.lastName}`} tone="danger" disabled={!character.isAlive} onPress={() => { void runDeveloper({ kind: 'kill-character', characterId: character.id }); }} />)}</Card>
      <Card><Heading size="small">Inspect NPC memory</Heading><View style={styles.wrap}>{otherCharacters.map((character) => <PrimaryButton key={character.id} title={character.firstName} tone={selectedNpc === character.id ? 'accent' : 'neutral'} onPress={() => setSelectedNpc(character.id)} />)}</View>{selectedNpc ? <><Eyebrow>{world.characters[selectedNpc].firstName.toUpperCase()} · {world.characters[selectedNpc].detailTier.toUpperCase()}</Eyebrow>{memories.length ? memories.map((memory) => <Body key={memory} secondary>• {memory}</Body>) : <Body secondary>No retained memories for this NPC.</Body>}</> : null}</Card>
      <Card><Eyebrow>PERFORMANCE BUDGET</Eyebrow><Body secondary>Full NPCs {Object.values(world.characters).filter((character) => character.detailTier === 'full').length}/{world.performance.fullNpcLimit} · Standard limit {world.performance.standardNpcLimit} · Statistical background population {world.background.population.toLocaleString()} · Memory budget {Object.keys(world.memories).length}/{world.performance.memoryLimit}</Body></Card>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: spacing.sm }, input: { flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, fontSize: 16 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm } });
