import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, ProgressBar, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

function label(group: string) {
  if (group === 'family') return 'Family';
  if (group === 'friends') return 'Friends';
  if (group === 'dating') return 'Dating & partner';
  if (group === 'acquaintances') return 'Acquaintances';
  return 'Professional & other';
}

export default function RelationshipsScreen() {
  const params = useLocalSearchParams<{ group?: string }>();
  const group = params.group ?? 'friends';
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const rows = Object.values(world.relationships).filter((relationship) => relationship.characterIds.includes(actor.id)).map((relationship) => {
    const otherId = relationship.characterIds.find((id) => id !== actor.id)!;
    const person = world.characters[otherId];
    const kind = actor.parentIds.includes(otherId) ? 'parent' : actor.childIds.includes(otherId) ? 'child' : relationship.kind;
    return { relationship, person, kind };
  }).filter(({ person, relationship, kind }) => {
    if (!person) return false;
    if (group === 'family') return ['parent', 'child', 'sibling', 'relative'].includes(kind);
    if (group === 'friends') return relationship.kind === 'friend';
    if (group === 'dating') return ['partner', 'spouse'].includes(relationship.kind) || actor.partnerId === person.id;
    if (group === 'acquaintances') return relationship.kind === 'acquaintance';
    return ['professional', 'rival'].includes(relationship.kind);
  });

  return (
    <AppScreen>
      <SubviewHeader eyebrow="People" title={label(group)} subtitle="People remember what you do. Relationships can warm up, cool off, turn romantic, become professional, or follow the family for generations." />
      {rows.length === 0 ? <Card accent><Heading size="small">Nobody here yet</Heading><Body secondary>Your life has not put anyone in this circle yet. School, work, classes, organizations, dating, and random events can change that.</Body></Card> : rows.map(({ relationship, person, kind }) => (
        <Card key={relationship.id}>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{person.firstName} {person.lastName}</Heading><Body secondary>{kind}</Body></View><StatusPill tone={person.isAlive ? 'success' : 'neutral'}>{person.isAlive ? 'Around' : 'Remembered'}</StatusPill></View>
          <View style={styles.metric}><View style={styles.row}><Body>Trust</Body><Body secondary>{Math.round(relationship.trust)}</Body></View><ProgressBar value={relationship.trust} /></View>
          <View style={styles.metric}><View style={styles.row}><Body>Affection</Body><Body secondary>{Math.round(relationship.affection)}</Body></View><ProgressBar value={relationship.affection} tone="legacy" /></View>
          <View style={styles.actions}>
            <EngineActionButton title="Reach out" action={{ verb: 'relationship.contact', targetIds: [person.id], parameters: {} }} style={{ flex: 1 }} />
            <EngineActionButton title="Spend time" action={{ verb: 'relationship.spend_time', targetIds: [person.id], parameters: {} }} tone="accent" style={{ flex: 1 }} />
            {!actor.partnerId && !person.partnerId && !['parent', 'child', 'sibling', 'relative'].includes(kind) ? <EngineActionButton title="Ask out" action={{ verb: 'relationship.date', targetIds: [person.id], parameters: {} }} tone="accent" style={{ flex: 1 }} /> : null}
            {actor.partnerId === person.id && relationship.kind === 'partner' ? <EngineActionButton title="Propose" action={{ verb: 'relationship.propose', targetIds: [person.id], parameters: {} }} tone="accent" style={{ flex: 1 }} /> : null}
          </View>
        </Card>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, metric: { gap: 6 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm } });
