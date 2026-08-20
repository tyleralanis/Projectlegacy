import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { playerAgeYears } from '@/engine/createWorld';
import { formatMoney } from '@/engine/money';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

function eligibleOffices(age: number, politicalRep: number, approval: number) {
  const offices = [
    { name: 'Harborview Council', minAge: 18, rep: 15, approval: 0, cost: 250000 },
    { name: 'Mayor of Harborview', minAge: 21, rep: 35, approval: 25, cost: 2500000 },
    { name: 'Regional Assembly', minAge: 25, rep: 48, approval: 35, cost: 7500000 },
    { name: 'Governor', minAge: 30, rep: 60, approval: 42, cost: 25000000 },
    { name: 'National Assembly', minAge: 25, rep: 65, approval: 45, cost: 30000000 },
    { name: 'President', minAge: 35, rep: 78, approval: 52, cost: 120000000 },
  ];
  return offices.map((office) => ({ ...office, eligible: age >= office.minAge && politicalRep >= office.rep && approval >= office.approval }));
}

export default function PoliticsScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const age = playerAgeYears(world);
  const politics = world.politics[actor.id] ?? { characterId: actor.id, authority: 0, approval: 20 };
  const offices = eligibleOffices(age, actor.reputation.political, politics.approval);

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Work" title="Politics" subtitle="Approval is earned, lost, and sometimes accidentally torched. Public speaking, empathy, knowledge, money, reputation, and luck all matter." />
      <Card accent>
        <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{politics.office ?? politics.campaign?.office ?? 'Private citizen'}</Heading><Body secondary>{politics.campaign ? `${politics.campaign.weeksRemaining} weeks until election` : politics.office ? 'Currently in office' : 'No active campaign'}</Body></View><StatusPill tone={politics.approval >= 55 ? 'success' : politics.approval < 30 ? 'danger' : 'warning'}>{Math.round(politics.approval)}% approval</StatusPill></View>
        <ProgressBar value={politics.approval} tone={politics.approval >= 55 ? 'success' : politics.approval < 30 ? 'danger' : 'legacy'} />
        <View style={styles.stats}><Stat label="Political rep" value={Math.round(actor.reputation.political).toString()} /><Stat label="Charisma" value={Math.round(actor.charisma).toString()} /><Stat label="Knowledge" value={Math.round(actor.knowledge).toString()} /><Stat label="Authority" value={Math.round(politics.authority).toString()} /></View>
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Build approval" />
        <Card><Heading size="small">Press conference</Heading><Body secondary>High upside, high embarrassment potential. Weak public speaking can make this actively worse.</Body><EngineActionButton title="Hold press conference · $1,200" action={{ verb: 'politics.press_conference', targetIds: [], parameters: {} }} tone="accent" /></Card>
        <Card><Heading size="small">Town hall</Heading><Body secondary>Empathy and listening matter. Less flashy, more forgiving.</Body><EngineActionButton title="Host town hall · $450" action={{ verb: 'politics.town_hall', targetIds: [], parameters: {} }} tone="accent" /></Card>
        <Card><Heading size="small">Fundraiser</Heading><Body secondary>Charisma and business reputation drive the room. During a campaign, a good night also adds campaign cash.</Body><EngineActionButton title="Host fundraiser · $900" action={{ verb: 'politics.fundraiser', targetIds: [], parameters: {} }} tone="accent" /></Card>
        <Card><Heading size="small">Constituent work</Heading><Body secondary>Unsexy and cheap. Good empathy can build durable support one boring problem at a time.</Body><EngineActionButton title="Meet constituents · $150" action={{ verb: 'politics.constituent_work', targetIds: [], parameters: {} }} /></Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Eligible offices" />
        {offices.map((office) => (
          <Card key={office.name}>
            <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{office.name}</Heading><Body secondary>Age {office.minAge}+ · political rep {office.rep}+ · approval {office.approval}+ · campaign seed {formatMoney(office.cost, true)}</Body></View><StatusPill tone={office.eligible ? 'success' : 'warning'}>{office.eligible ? 'Eligible' : 'Locked'}</StatusPill></View>
            <EngineActionButton title={`Run for ${office.name}`} action={{ verb: 'politics.run_for_office', targetIds: [], parameters: { office: office.name, amountCents: office.cost } }} tone={office.eligible ? 'accent' : 'neutral'} />
          </Card>
        ))}
      </View>

      {politics.campaign ? <Card><SectionHeader title="Current campaign" action={<StatusPill tone="warning">{politics.campaign.weeksRemaining}W</StatusPill>} /><View style={styles.stats}><Stat label="Funds" value={formatMoney(politics.campaign.fundsCents, true)} /><Stat label="Support" value={Math.round(politics.campaign.support).toString()} /><Stat label="Opposition" value={Math.round(politics.campaign.opposition).toString()} /></View><EngineActionButton title="Add $1,000 to campaign" action={{ verb: 'politics.campaign_action', targetIds: [], parameters: { amountCents: 100000 } }} tone="accent" /></Card> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
});
