import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { DetailScreen } from '@/components/DetailScreen';
import { useGame } from '@/state/GameProvider';
import { Body, Card, Eyebrow, Heading, PrimaryButton, StatusPill } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

export default function SavesScreen() {
  const { world, saves, checkpoints, busy, refreshSaveLibrary, switchSave, rollbackSave, deleteSave, renameCurrentSave, exportSave, importSave } = useGame();
  const { colors } = useAppTheme();
  const [name, setName] = useState(world?.metadata.displayName ?? '');
  useEffect(() => { void refreshSaveLibrary(); }, [refreshSaveLibrary]);
  if (!world) return null;
  return (
    <DetailScreen title="Save Library" eyebrow={`${saves.length} LOCAL SLOT${saves.length === 1 ? '' : 'S'} · 3 ROLLBACK GENERATIONS EACH`}>
      <Card accent><Heading size="small">Active slot</Heading><TextInput accessibilityLabel="Save slot name" value={name} onChangeText={setName} placeholder="Save name" placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} /><PrimaryButton title="Rename active slot" disabled={busy || !name.trim()} onPress={() => { void renameCurrentSave(name); }} /></Card>
      <View style={styles.actions}><PrimaryButton title="Export .legacy" disabled={busy} style={{ flex: 1 }} onPress={() => { void exportSave(); }} /><PrimaryButton title="Import .legacy" tone="neutral" disabled={busy} style={{ flex: 1 }} onPress={() => { void importSave(); }} /></View>
      <Eyebrow>SAVE SLOTS</Eyebrow>
      {saves.map((save) => <Card key={save.saveId}><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{save.displayName}</Heading><Body secondary>{save.playerName} · Generation {save.generation} · Week {save.week}</Body></View>{save.saveId === world.metadata.saveId ? <StatusPill tone="success">Active</StatusPill> : null}</View>{save.saveId !== world.metadata.saveId ? <PrimaryButton title="Open save" onPress={() => { void switchSave(save.saveId).then(() => setName(save.displayName)); }} /> : null}<PrimaryButton title="Delete slot" tone="danger" disabled={busy || saves.length <= 1} onPress={() => Alert.alert('Delete this save slot?', `${save.displayName} and its rollback generations will be permanently removed.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete slot', style: 'destructive', onPress: () => { void deleteSave(save.saveId); } }])} /></Card>)}
      <Eyebrow>ROLLBACK GENERATIONS · ACTIVE SLOT</Eyebrow>
      {checkpoints.map((checkpoint) => <Card key={checkpoint.id}><Heading size="small">Generation {checkpoint.generation} · Week {checkpoint.week}</Heading><Body secondary>{new Date(checkpoint.createdAt).toLocaleString()}</Body><PrimaryButton title="Roll back to this point" tone="neutral" onPress={() => Alert.alert('Roll back this save?', 'The current state will first become a recovery generation, so this rollback can itself be reversed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Roll back', onPress: () => { void rollbackSave(checkpoint.id); } }])} /></Card>)}
      {checkpoints.length === 0 ? <Card><Body secondary>Rollback generations appear automatically as this slot changes.</Body></Card> : null}
    </DetailScreen>
  );
}

const styles = StyleSheet.create({ input: { minHeight: 48, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 13, fontSize: 16 }, actions: { flexDirection: 'row', gap: spacing.sm }, row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md } });
