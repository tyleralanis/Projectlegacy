import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { OtherActionComposer } from '@/components/OtherActionComposer';
import { developmentPrioritiesForAge } from '@/engine/ageProgression';
import { playerAgeYears } from '@/engine/createWorld';
import { hasGymMembership } from '@/engine/supplementalDepthBridge';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

export default function WellnessScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const age = playerAgeYears(world);
  const gymMember = age >= 16 && hasGymMembership(world);
  const priorities = developmentPrioritiesForAge(age);
  const activeHealthIssues = Object.values(world.memories)
    .filter((memory) => memory.participantIds.includes(actor.id) && memory.unresolved && memory.category.startsWith('Health ·'))
    .sort((left, right) => right.importance - left.importance);
  const sportsInjury = activeHealthIssues.find((memory) => memory.category.startsWith('Health · Sports injury'));

  if (age < 5) {
    return (
      <AppScreen>
        <SubviewHeader eyebrow="Life" title="Health & development" subtitle="At this age, adults handle the health decisions. You are busy growing." />
        <Card accent>
          <View style={styles.stats}><Stat label="Health" value={Math.round(actor.health).toString()} tone="success" /><Stat label="Mood" value={Math.round(actor.mood).toString()} /></View>
          <ProgressBar value={actor.health} tone="success" />
        </Card>
        <View style={styles.section}>
          <SectionHeader title="Right now" />
          {priorities.map((priority) => <Card key={priority.title}><Heading size="small">{priority.title}</Heading><Body secondary>{priority.detail}</Body></Card>)}
        </View>
        <Card><Heading size="small">Caregivers handle the rest</Heading><Body secondary>Food, sleep, checkups, safety, and medical care are their job for now.</Body></Card>
      </AppScreen>
    );
  }

  if (age < 8) {
    return (
      <AppScreen>
        <SubviewHeader eyebrow="Life" title="Health & development" subtitle="Play, movement, sleep, and steady growth." />
        <Card accent><View style={styles.stats}><Stat label="Health" value={Math.round(actor.health).toString()} tone="success" /><Stat label="Fitness" value={Math.round(actor.fitness).toString()} /><Stat label="Mood" value={Math.round(actor.mood).toString()} /></View></Card>
        <View style={styles.section}>
          <SectionHeader title="Growing up" />
          {priorities.map((priority) => <Card key={priority.title}><Heading size="small">{priority.title}</Heading><Body secondary>{priority.detail}</Body></Card>)}
        </View>
        <Card><Heading size="small">🌲 Play outside</Heading><Body secondary>Move, explore, and burn some energy.</Body><EngineActionButton title="Go outside" action={{ verb: 'health.outdoors', targetIds: [], parameters: {} }} tone="accent" /></Card>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Life" title="Health & wellness" subtitle={age < 12 ? 'Movement, sleep, health, and growing well.' : 'Fitness, recovery, stress, and health.'} />
      <Card accent>
        <View style={styles.stats}><Stat label="Health" value={Math.round(actor.health).toString()} tone="success" /><Stat label="Fitness" value={Math.round(actor.fitness).toString()} /><Stat label="Mood" value={Math.round(actor.mood).toString()} /><Stat label="Stress" value={Math.round(actor.stress).toString()} tone={actor.stress > 70 ? 'danger' : 'default'} /></View>
        <View style={styles.metric}><View style={styles.row}><Body>Overall health</Body><Body secondary>{Math.round(actor.health)}/100</Body></View><ProgressBar value={actor.health} tone="success" /></View>
      </Card>

      {activeHealthIssues.length > 0 ? <View style={styles.section}>
        <SectionHeader title="Active health issue" action={<StatusPill tone="warning">{activeHealthIssues.length}</StatusPill>} />
        {activeHealthIssues.slice(0, 3).map((issue) => <Card key={issue.id} accent>
          <View style={styles.row}><Heading size="small">{issue.category.replace('Health · ', '')}</Heading><StatusPill tone={issue.importance >= 75 ? 'danger' : 'warning'}>{Math.round(issue.importance)}</StatusPill></View>
          <Body secondary>{issue.narrative}</Body>
        </Card>)}
        <View style={styles.actions}>
          <EngineActionButton title="Do rehab" action={{ verb: 'health.rehab', targetIds: [], parameters: {} }} tone="accent" style={styles.actionButton} />
          {sportsInjury ? <EngineActionButton title="Protect recovery" action={{ verb: 'sports.recover', targetIds: [], parameters: {} }} style={styles.actionButton} /> : null}
        </View>
      </View> : null}

      {age >= 12 ? <View style={styles.section}>
        <SectionHeader title="Recovery" />
        <Card><Heading size="small">😴 Sleep</Heading><Body secondary>Protect sleep and bring stress down.</Body><EngineActionButton title="Prioritize sleep" action={{ verb: 'health.sleep', targetIds: [], parameters: {} }} tone="accent" /></Card>
        <Card><Heading size="small">🥗 Eat better this week</Heading><Body secondary>Plan better food for about $120.</Body><EngineActionButton title="Plan nutrition · $120" action={{ verb: 'health.nutrition', targetIds: [], parameters: { amountCents: 12_000 } }} /></Card>
        <Card><Heading size="small">🩺 Checkup</Heading><Body secondary>Stay ahead of problems.</Body><EngineActionButton title="Get checkup · $250" action={{ verb: 'health.checkup', targetIds: [], parameters: { amountCents: 25_000 } }} /></Card>
        {age >= 16 ? <Card><Heading size="small">🛌 Recovery week</Heading><Body secondary>Back off work and reset.</Body><EngineActionButton title="Take a recovery week" action={{ verb: 'health.rest_week', targetIds: [], parameters: {} }} /></Card> : null}
      </View> : null}

      <View style={styles.section}>
        <SectionHeader title="Move" />
        <Card><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🏃 Go for a run</Heading><Body secondary>Free. Good for fitness and stress.</Body></View><StatusPill tone="success">Free</StatusPill></View><EngineActionButton title="Go for a run" action={{ verb: 'health.run', targetIds: [], parameters: {} }} tone="accent" /></Card>
        {age >= 16 ? <Card>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🏋️ Harbor Athletic Club</Heading><Body secondary>{gymMember ? '$780/year. Visits included.' : '$25 day pass or $780/year.'}</Body></View><StatusPill tone={gymMember ? 'success' : 'neutral'}>{gymMember ? 'Member' : '$25/visit'}</StatusPill></View>
          <View style={styles.actions}>
            <EngineActionButton title={gymMember ? 'Work out' : 'Buy day pass'} action={{ verb: 'health.gym', targetIds: [], parameters: {} }} tone="accent" style={styles.actionButton} />
            {!gymMember ? <EngineActionButton title="Join · $780/yr" action={{ verb: 'health.join_gym', targetIds: [], parameters: {} }} style={styles.actionButton} /> : <EngineActionButton title="Cancel renewal" action={{ verb: 'health.cancel_gym_membership', targetIds: [], parameters: {} }} tone="danger" style={styles.actionButton} />}
          </View>
        </Card> : null}
        {age >= 12 ? <Card><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🧘 Group class</Heading><Body secondary>Yoga, spin, boxing, or whatever is scheduled.</Body></View><StatusPill>$38</StatusPill></View><EngineActionButton title="Take a group class" action={{ verb: 'health.group_class', targetIds: [], parameters: {} }} tone="accent" /></Card> : null}
        <Card><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🌲 Get outside</Heading><Body secondary>Free. Clear your head.</Body></View><StatusPill tone="success">Free</StatusPill></View><EngineActionButton title="Get outside" action={{ verb: 'health.outdoors', targetIds: [], parameters: {} }} /></Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Headspace" />
        <Card><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🛋️ Therapy</Heading><Body secondary>Reduce stress and work through things.</Body></View><StatusPill>$180</StatusPill></View><EngineActionButton title="Go to therapy" action={{ verb: 'health.therapy', targetIds: [], parameters: {} }} tone="accent" /></Card>
      </View>

      {age >= 12 ? <OtherActionComposer domains={['health']} placeholder="Something else for health or recovery…" /> : null}
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
