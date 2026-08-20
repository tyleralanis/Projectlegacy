import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { hasGymMembership } from '@/engine/supplementalDepth';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

export default function WellnessScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const gymMember = hasGymMembership(world);

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Life" title="Health & wellness" subtitle="Small choices stack up. Some cost money, some cost time, and some are good places to meet people." />
      <Card accent>
        <View style={styles.stats}><Stat label="Health" value={Math.round(actor.health).toString()} tone="success" /><Stat label="Fitness" value={Math.round(actor.fitness).toString()} /><Stat label="Mood" value={Math.round(actor.mood).toString()} /><Stat label="Stress" value={Math.round(actor.stress).toString()} tone={actor.stress > 70 ? 'danger' : 'default'} /></View>
        <View style={styles.metric}><View style={styles.row}><Body>Overall health</Body><Body secondary>{Math.round(actor.health)}/100</Body></View><ProgressBar value={actor.health} tone="success" /></View>
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Move your body" />
        <Card><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🏃 Go for a run</Heading><Body secondary>Free. Good for fitness, health, mood, and stress.</Body></View><StatusPill tone="success">Free</StatusPill></View><EngineActionButton title="Go for a run" action={{ verb: 'health.run', targetIds: [], parameters: {} }} tone="accent" /></Card>
        <Card>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🏋️ Harbor Athletic Club</Heading><Body secondary>{gymMember ? 'Your annual membership covers visits. Renewals happen when a year passes.' : 'Use a $25 day pass, or join for $780/year if you plan to make a habit of it.'}</Body></View><StatusPill tone={gymMember ? 'success' : 'neutral'}>{gymMember ? 'Member' : '$25/visit'}</StatusPill></View>
          <View style={styles.actions}><EngineActionButton title={gymMember ? 'Work out' : 'Buy day pass'} action={{ verb: 'health.gym', targetIds: [], parameters: {} }} tone="accent" style={{ flex: 1 }} />{!gymMember ? <EngineActionButton title="Join · $780/yr" action={{ verb: 'health.join_gym', targetIds: [], parameters: {} }} style={{ flex: 1 }} /> : null}</View>
        </Card>
        <Card><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🧘 Group class</Heading><Body secondary>Yoga, spin, boxing, or whatever is on the schedule. It costs $38 and has a real chance of putting a new acquaintance in your People tab.</Body></View><StatusPill>$38</StatusPill></View><EngineActionButton title="Take a group class" action={{ verb: 'health.group_class', targetIds: [], parameters: {} }} tone="accent" /></Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Headspace" />
        <Card><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🛋️ Therapy</Heading><Body secondary>Costs more, but it can meaningfully reduce stress and improve mood.</Body></View><StatusPill>$180</StatusPill></View><EngineActionButton title="Go to therapy" action={{ verb: 'health.therapy', targetIds: [], parameters: {} }} tone="accent" /></Card>
        <Card><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🌲 Get outside</Heading><Body secondary>Free decompression. A good low-stakes reset when life is getting noisy.</Body></View><StatusPill tone="success">Free</StatusPill></View><EngineActionButton title="Get outside" action={{ verb: 'health.outdoors', targetIds: [], parameters: {} }} /></Card>
      </View>

      <Card><Heading size="small">Wellness is social too</Heading><Body secondary>Classes and gym visits can create acquaintances instead of only changing stat bars. Those people persist in the same world and can later become friends, dates, coworkers, or something messier.</Body></Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  metric: { gap: 7 },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
