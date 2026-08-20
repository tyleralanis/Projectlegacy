import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { OtherActionComposer } from '@/components/OtherActionComposer';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Eyebrow, Heading, ProgressBar, SectionHeader, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

function relationshipStatus(trust: number, affection: number, resentment: number): string {
  const score = (trust + affection - resentment) / 2;
  return score >= 72 ? 'Close' : score >= 52 ? 'Steady' : score >= 32 ? 'Distant' : 'Strained';
}

export default function PeopleScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const relationships = Object.values(world.relationships)
    .filter((relationship) => relationship.characterIds.includes(actor.id))
    .map((relationship) => {
      const otherId = relationship.characterIds.find((id) => id !== actor.id)!;
      const kind = actor.parentIds.includes(otherId) ? 'parent' : actor.childIds.includes(otherId) ? 'child' : relationship.kind;
      return { relationship, person: world.characters[otherId], kind };
    })
    .filter((item) => item.person);

  return (
    <AppScreen>
      <View style={styles.header}><View style={{ alignSelf: 'stretch', gap: 4 }}><Eyebrow>YOUR WORLD</Eyebrow><Heading size="large">People</Heading><Body secondary>Persistent relationships, memories, obligations, and independent lives.</Body></View><StatusPill tone="accent">{relationships.length} close ties</StatusPill></View>

      <Card accent>
        <SectionHeader title={`${world.dynasty.familyName} family`} action={<StatusPill tone="warning">Generation {world.dynasty.generation}</StatusPill>} />
        <Body>{actor.parentIds.length} parents · {actor.childIds.length} children · {actor.partnerId ? 'Partnered' : 'No partner'}</Body>
        <Body secondary>The family timeline, ownership history, obligations, and resentments continue when the active character changes.</Body>
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Relationships" />
        {relationships.map(({ relationship, person, kind }) => (
          <Card key={relationship.id}>
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 3 }}><Heading size="small">{person.firstName} {person.lastName}</Heading><Body secondary>{kind} · {relationshipStatus(relationship.trust, relationship.affection, relationship.resentment)}</Body></View>
              <StatusPill tone={person.isAlive ? 'success' : 'neutral'}>{person.isAlive ? 'Living' : 'Archived'}</StatusPill>
            </View>
            <View style={styles.metrics}>
              <View style={styles.metric}><View style={styles.row}><Body>Trust</Body><Body secondary>{Math.round(relationship.trust)}</Body></View><ProgressBar value={relationship.trust} /></View>
              <View style={styles.metric}><View style={styles.row}><Body>Affection</Body><Body secondary>{Math.round(relationship.affection)}</Body></View><ProgressBar value={relationship.affection} tone="legacy" /></View>
              <View style={styles.metric}><View style={styles.row}><Body>Resentment</Body><Body secondary>{Math.round(relationship.resentment)}</Body></View><ProgressBar value={relationship.resentment} tone="danger" /></View>
            </View>
            <View style={styles.actions}>
              <EngineActionButton title="Reach out" action={{ verb: 'relationship.contact', targetIds: [person.id], parameters: {} }} style={{ flex: 1 }} />
              <EngineActionButton title="Spend time" action={{ verb: 'relationship.spend_time', targetIds: [person.id], parameters: {} }} tone="accent" style={{ flex: 1 }} />
              <EngineActionButton title="Give $100" action={{ verb: 'relationship.transfer_cash', targetIds: [person.id], parameters: { amountCents: 10_000 } }} style={{ flex: 1 }} />
              {!actor.partnerId && !person.partnerId && !['parent', 'child', 'sibling'].includes(relationship.kind) ? <EngineActionButton title="Ask out" action={{ verb: 'relationship.date', targetIds: [person.id], parameters: {} }} tone="accent" style={{ flex: 1 }} /> : null}
              {actor.partnerId === person.id && relationship.kind === 'partner' ? <EngineActionButton title="Propose" action={{ verb: 'relationship.propose', targetIds: [person.id], parameters: {} }} tone="accent" style={{ flex: 1 }} /> : null}
              {actor.partnerId === person.id ? <EngineActionButton title="Separate" action={{ verb: 'relationship.separate', targetIds: [person.id], parameters: {}, destructive: true }} tone="danger" style={{ flex: 1 }} /> : null}
            </View>
          </Card>
        ))}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Important memories" action={<StatusPill>{Object.keys(world.memories).length}</StatusPill>} />
        {Object.values(world.memories).length === 0 ? <Card><Body secondary>Important choices will create durable memories here. Routine transcripts are not retained.</Body></Card> : Object.values(world.memories).slice(0, 8).map((memory) => <Card key={memory.id}><Heading size="small">{memory.category}</Heading><Body>{memory.narrative}</Body><Eyebrow>IMPORTANCE {Math.round(memory.importance)} · {memory.visibility.toUpperCase()}</Eyebrow></Card>)}
      </View>

      <OtherActionComposer domains={['relationship', 'family', 'dynasty']} placeholder="Give my sibling money, choose an heir, or reach out to someone…" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, alignItems: 'flex-start', paddingTop: 8 },
  section: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  metrics: { gap: spacing.md },
  metric: { gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
