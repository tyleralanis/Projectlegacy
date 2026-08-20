import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { OtherActionComposer } from '@/components/OtherActionComposer';
import { hasGymMembership } from '@/engine/supplementalDepthBridge';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

export default function WellnessScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const gymMember = hasGymMembership(world);
  const activeHealthIssues = Object.values(world.memories)
    .filter((memory) => memory.participantIds.includes(actor.id) && memory.unresolved && memory.category.startsWith('Health ·'))
    .sort((left, right) => right.importance - left.importance);
  const sportsInjury = activeHealthIssues.find((memory) => memory.category.startsWith('Health · Sports injury'));

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Life" title="Health & wellness" subtitle="Health is a resource with a history now. Sleep, stress, recovery, prevention, injury, age, money, and the pace of the rest of your life can all change what the body will tolerate." />
      <Card accent>
        <View style={styles.stats}><Stat label="Health" value={Math.round(actor.health).toString()} tone="success" /><Stat label="Fitness" value={Math.round(actor.fitness).toString()} /><Stat label="Mood" value={Math.round(actor.mood).toString()} /><Stat label="Stress" value={Math.round(actor.stress).toString()} tone={actor.stress > 70 ? 'danger' : 'default'} /></View>
        <View style={styles.metric}><View style={styles.row}><Body>Overall health</Body><Body secondary>{Math.round(actor.health)}/100</Body></View><ProgressBar value={actor.health} tone="success" /></View>
      </Card>

      {activeHealthIssues.length > 0 ? <View style={styles.section}>
        <SectionHeader title="Active health story" action={<StatusPill tone="warning">{activeHealthIssues.length} active</StatusPill>} />
        {activeHealthIssues.slice(0, 3).map((issue) => <Card key={issue.id} accent>
          <View style={styles.row}><Heading size="small">{issue.category.replace('Health · ', '')}</Heading><StatusPill tone={issue.importance >= 75 ? 'danger' : 'warning'}>{Math.round(issue.importance)} pressure</StatusPill></View>
          <Body secondary>{issue.narrative}</Body>
        </Card>)}
        <View style={styles.actions}>
          <EngineActionButton title="Do rehab" action={{ verb: 'health.rehab', targetIds: [], parameters: {} }} tone="accent" style={styles.actionButton} />
          {sportsInjury ? <EngineActionButton title="Protect recovery" action={{ verb: 'sports.recover', targetIds: [], parameters: {} }} style={styles.actionButton} /> : null}
        </View>
      </View> : null}

      <View style={styles.section}>
        <SectionHeader title="Recovery & prevention" />
        <Card><Heading size="small">😴 Protect sleep</Heading><Body secondary>Recovery is not free. Protecting sleep gives stress, mood, and health a little room instead of borrowing endlessly from tomorrow.</Body><EngineActionButton title="Prioritize sleep" action={{ verb: 'health.sleep', targetIds: [], parameters: {} }} tone="accent" /></Card>
        <Card><Heading size="small">🥗 Eat deliberately</Heading><Body secondary>A planned week of better food costs about $120. The effect is intentionally modest; consistency matters more than one heroic salad.</Body><EngineActionButton title="Plan nutrition · $120" action={{ verb: 'health.nutrition', targetIds: [], parameters: { amountCents: 12_000 } }} /></Card>
        <Card><Heading size="small">🩺 Preventive checkup</Heading><Body secondary>Age, stress, and ordinary risk become easier to manage when the character actually monitors them instead of waiting for a crisis event.</Body><EngineActionButton title="Get checkup · $250" action={{ verb: 'health.checkup', targetIds: [], parameters: { amountCents: 25_000 } }} /></Card>
        <Card><Heading size="small">🛌 Recovery week</Heading><Body secondary>Deliberately trade a little work momentum for a larger stress reset. This is useful precisely because the time system makes overwork consequential.</Body><EngineActionButton title="Take a recovery week" action={{ verb: 'health.rest_week', targetIds: [], parameters: {} }} /></Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Move your body" />
        <Card><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🏃 Go for a run</Heading><Body secondary>Free. Good for fitness, health, mood, and stress.</Body></View><StatusPill tone="success">Free</StatusPill></View><EngineActionButton title="Go for a run" action={{ verb: 'health.run', targetIds: [], parameters: {} }} tone="accent" /></Card>
        <Card>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🏋️ Harbor Athletic Club</Heading><Body secondary>{gymMember ? 'Your membership covers visits while it remains active.' : 'Use a $25 day pass, or join for $780/year if you plan to make a habit of it.'}</Body></View><StatusPill tone={gymMember ? 'success' : 'neutral'}>{gymMember ? 'Member' : '$25/visit'}</StatusPill></View>
          <View style={styles.actions}><EngineActionButton title={gymMember ? 'Work out' : 'Buy day pass'} action={{ verb: 'health.gym', targetIds: [], parameters: {} }} tone="accent" style={styles.actionButton} />{!gymMember ? <EngineActionButton title="Join · $780/yr" action={{ verb: 'health.join_gym', targetIds: [], parameters: {} }} style={styles.actionButton} /> : null}</View>
        </Card>
        <Card><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🧘 Group class</Heading><Body secondary>Yoga, spin, boxing, or whatever is on the schedule. It costs $38 and can put a new acquaintance in your People tab.</Body></View><StatusPill>$38</StatusPill></View><EngineActionButton title="Take a group class" action={{ verb: 'health.group_class', targetIds: [], parameters: {} }} tone="accent" /></Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Headspace" />
        <Card><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🛋️ Therapy</Heading><Body secondary>Costs more, but it can meaningfully reduce stress and improve mood.</Body></View><StatusPill>$180</StatusPill></View><EngineActionButton title="Go to therapy" action={{ verb: 'health.therapy', targetIds: [], parameters: {} }} tone="accent" /></Card>
        <Card><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🌲 Get outside</Heading><Body secondary>Free decompression. A good low-stakes reset when life is getting noisy.</Body></View><StatusPill tone="success">Free</StatusPill></View><EngineActionButton title="Get outside" action={{ verb: 'health.outdoors', targetIds: [], parameters: {} }} /></Card>
      </View>

      <Card><Heading size="small">The body is connected to everything else</Heading><Body secondary>Workload, sports, aging, money, sleep, stress, and recovery now share one health story. Being rich or successful does not grant infinite physical capacity.</Body></Card>
      <OtherActionComposer domains={['health']} placeholder="Something else for health or recovery…" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  metric: { gap: 7 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: { flexGrow: 1, flexBasis: 130 },
});
