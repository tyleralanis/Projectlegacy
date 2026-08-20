import React from 'react';
import { StyleSheet, View } from 'react-native';

import { SubviewHeader } from '@/components/MenuTile';
import { getDeepTimeBudget, opportunityCostReport } from '@/engine/timeSystem';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

function statusCopy(status: ReturnType<typeof getDeepTimeBudget>['status']) {
  if (status === 'unsustainable') return { tone: 'danger' as const, label: 'Unsustainable', detail: 'The week is borrowing from health, performance, relationships, or all three. Something has to be delegated, dropped, or deliberately allowed to suffer.' };
  if (status === 'overloaded') return { tone: 'warning' as const, label: 'Overloaded', detail: 'The commitments do not all fit. Your standing priorities decide what gets protected first.' };
  if (status === 'busy') return { tone: 'accent' as const, label: 'Busy', detail: 'Everything technically fits, but there is not much slack for illness, conflict, opportunity, or surprise.' };
  return { tone: 'success' as const, label: 'Open', detail: 'There is room for recovery, relationships, unexpected opportunities, and new ambitions.' };
}

export default function TimeScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const budget = getDeepTimeBudget(world);
  const report = opportunityCostReport(world);
  const state = statusCopy(budget.status);

  return (
    <AppScreen>
      <SubviewHeader eyebrow="The currency underneath everything" title="Your week" subtitle="Money can buy back time. Delegation can buy back time. Skill can make work more efficient. But the week itself never becomes infinite." />

      <Card accent>
        <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{budget.committedHours}h committed</Heading><Body secondary>{budget.capacityHours}h is roughly sustainable for your current age, health, and stress.</Body></View><StatusPill tone={state.tone}>{state.label}</StatusPill></View>
        <ProgressBar value={Math.min(100, budget.loadRatio * 100)} tone={budget.status === 'unsustainable' ? 'danger' : budget.status === 'overloaded' ? 'legacy' : 'success'} />
        <View style={styles.stats}><Stat label="Free" value={`${budget.freeHours}h`} /><Stat label="Overload" value={`${budget.overloadHours}h`} tone={budget.overloadHours > 0 ? 'danger' : 'success'} /><Stat label="Priorities" value={`${actor.focuses.length}/3`} /></View>
        <Body secondary>{state.detail}</Body>
      </Card>

      <Card>
        <SectionHeader title={report.headline} />
        <Body>{report.detail}</Body>
        <View style={styles.chips}>{report.protectedAreas.map((focus) => <StatusPill key={focus} tone="success">Protect {focus}</StatusPill>)}{report.exposedAreas.slice(0, 6).map((area) => <StatusPill key={area} tone="warning">Exposed: {area}</StatusPill>)}</View>
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Where the week goes" />
        {budget.commitments.map((commitment) => <Card key={commitment.id}>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{commitment.label}</Heading><Body secondary>{commitment.detail}</Body></View><StatusPill tone={commitment.hours >= 35 ? 'warning' : commitment.hours >= 15 ? 'accent' : 'neutral'}>{commitment.hours}h</StatusPill></View>
        </Card>)}
      </View>

      <Card><Heading size="small">What actually buys time back</Heading><Body secondary>Hiring a CEO, property manager, advisor, professional staff, or family office can reduce recurring burden. Better management skill can make owner-operated companies less chaotic. Reduced job hours create space but cost income or advancement. Choosing one priority often means accepting that another part of life will move slower.</Body></Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
