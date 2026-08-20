import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { competency } from '@/engine/competencies';
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
  const politicalSkill = competency(world, actor.id, 'politics');
  const communication = competency(world, actor.id, 'communication');
  const negotiation = competency(world, actor.id, 'negotiation');
  const leadership = competency(world, actor.id, 'leadership');
  const staff = Object.values(world.relationships)
    .filter((relationship) => relationship.kind === 'professional' && relationship.characterIds.includes(actor.id))
    .map((relationship) => ({ relationship, person: world.characters[relationship.characterIds.find((id) => id !== actor.id)!] }))
    .filter(({ person }) => person?.isAlive && competency(world, person.id, 'politics') >= 65)
    .slice(0, 5);

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Work" title="Politics" subtitle="Fame can get attention. Money can buy reach. Neither guarantees political competence. Coalitions, staff, institutions, negotiation, communication, public trust, and governing skill decide what happens after the microphone turns on." />
      <Card accent>
        <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{politics.office ?? politics.campaign?.office ?? 'Private citizen'}</Heading><Body secondary>{politics.campaign ? `${politics.campaign.weeksRemaining} weeks until election` : politics.office ? 'Currently in office' : 'No active campaign'}</Body></View><StatusPill tone={politics.approval >= 55 ? 'success' : politics.approval < 30 ? 'danger' : 'warning'}>{Math.round(politics.approval)}% approval</StatusPill></View>
        <ProgressBar value={politics.approval} tone={politics.approval >= 55 ? 'success' : politics.approval < 30 ? 'danger' : 'legacy'} />
        <View style={styles.stats}><Stat label="Political skill" value={Math.round(politicalSkill).toString()} /><Stat label="Communication" value={Math.round(communication).toString()} /><Stat label="Negotiation" value={Math.round(negotiation).toString()} /><Stat label="Leadership" value={Math.round(leadership).toString()} /></View>
        <View style={styles.stats}><Stat label="Political rep" value={Math.round(actor.reputation.political).toString()} /><Stat label="Approval" value={`${Math.round(politics.approval)}%`} /><Stat label="Authority" value={Math.round(politics.authority).toString()} /><Stat label="Senior staff" value={staff.length.toString()} /></View>
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Build an actual political operation" />
        <Card><Heading size="small">🤝 Build a coalition</Heading><Body secondary>Coalitions are different from raw approval. Political judgment and negotiation have to turn people with different incentives into support that can survive disagreement.</Body><EngineActionButton title="Work the coalition" action={{ verb: 'politics.build_coalition', targetIds: [], parameters: {} }} tone="accent" /></Card>
        <Card><Heading size="small">🧠 Recruit serious staff</Heading><Body secondary>A strong operator becomes a persistent NPC in your orbit instead of a faceless +5 campaign bonus. Staff can eventually become trusted, indispensable, ambitious, resentful, or powerful themselves.</Body><EngineActionButton title="Recruit senior staff · $3,500" action={{ verb: 'politics.recruit_staff', targetIds: [], parameters: { amountCents: 350000 } }} tone="accent" /></Card>
        {staff.map(({ relationship, person }) => <Card key={relationship.id}><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{person.firstName} {person.lastName}</Heading><Body secondary>Political skill {Math.round(competency(world, person.id, 'politics'))} · trust {Math.round(relationship.trust)} · respect {Math.round(relationship.respect)} · resentment {Math.round(relationship.resentment)}</Body></View><StatusPill tone={relationship.resentment >= 45 ? 'warning' : relationship.trust >= 65 ? 'success' : 'accent'}>{relationship.resentment >= 45 ? 'Friction' : relationship.trust >= 65 ? 'Trusted' : 'Staff'}</StatusPill></View></Card>)}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Public work" />
        <Card><Heading size="small">🎙️ Press conference</Heading><Body secondary>High upside, high embarrassment potential. Communication skill now matters separately from raw charisma.</Body><EngineActionButton title="Hold press conference · $1,200" action={{ verb: 'politics.press_conference', targetIds: [], parameters: {} }} tone="accent" /></Card>
        <Card><Heading size="small">🏫 Town hall</Heading><Body secondary>Empathy and political judgment matter. Less flashy, more forgiving, and useful for understanding what voters actually care about.</Body><EngineActionButton title="Host town hall · $450" action={{ verb: 'politics.town_hall', targetIds: [], parameters: {} }} tone="accent" /></Card>
        <Card><Heading size="small">🥂 Fundraiser</Heading><Body secondary>Communication, business reputation, and network drive the room. During a campaign, a good night also adds campaign cash.</Body><EngineActionButton title="Host fundraiser · $900" action={{ verb: 'politics.fundraiser', targetIds: [], parameters: {} }} tone="accent" /></Card>
        <Card><Heading size="small">🤝 Constituent work</Heading><Body secondary>Unsexy and cheap. Good empathy and political skill can build durable support one boring problem at a time.</Body><EngineActionButton title="Meet constituents · $150" action={{ verb: 'politics.constituent_work', targetIds: [], parameters: {} }} /></Card>
      </View>

      {politics.office ? <View style={styles.section}>
        <SectionHeader title="Govern, not just campaign" />
        <Card><Heading size="small">Use the authority you won</Heading><Body secondary>Governing can raise or destroy approval because institutions and public opinion react to the choices. Winning office is the beginning of a different game, not a victory screen.</Body><EngineActionButton title="Push a policy priority" action={{ verb: 'politics.policy_action', targetIds: [], parameters: {} }} tone="accent" /></Card>
      </View> : null}

      <View style={styles.section}>
        <SectionHeader title="Office ladder" />
        {offices.map((office) => (
          <Card key={office.name}>
            <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{office.name}</Heading><Body secondary>Age {office.minAge}+ · political rep {office.rep}+ · approval {office.approval}+ · campaign seed {formatMoney(office.cost, true)}</Body></View><StatusPill tone={office.eligible ? 'success' : 'warning'}>{office.eligible ? 'Eligible' : 'Locked'}</StatusPill></View>
            {office.eligible ? <EngineActionButton title={`Run for ${office.name}`} action={{ verb: 'politics.run_for_office', targetIds: [], parameters: { office: office.name, amountCents: office.cost } }} tone="accent" /> : <Body secondary>Build the missing age, reputation, or public support before this office becomes a real option. The engine also validates the ladder rather than trusting the button.</Body>}
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