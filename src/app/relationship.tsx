import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { OtherActionComposer } from '@/components/OtherActionComposer';
import { getConsequenceArcs } from '@/engine/consequenceWeb';
import { playerAgeYears } from '@/engine/createWorld';
import { relationshipPortrait } from '@/engine/immersionWorld';
import { relationshipLoanBalance, relationshipNeed } from '@/engine/relationshipDepth';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Eyebrow, Heading, ProgressBar, SectionHeader, StatusPill } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

function ageOf(worldWeek: number, birthWeek: number): number {
  return Math.max(0, Math.floor((worldWeek - birthWeek) / 52));
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function weeksAgo(currentWeek: number, week: number): string {
  const elapsed = Math.max(0, currentWeek - week);
  if (elapsed === 0) return 'this week';
  if (elapsed === 1) return 'last week';
  if (elapsed < 52) return `${elapsed} weeks ago`;
  const years = Math.floor(elapsed / 52);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function relationshipLabel(kind: string): string {
  if (kind === 'spouse') return 'Spouse';
  if (kind === 'partner') return 'Partner';
  if (kind === 'parent') return 'Parent';
  if (kind === 'child') return 'Child';
  if (kind === 'sibling') return 'Sibling';
  if (kind === 'professional') return 'Professional connection';
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function relationshipTemperature(trust: number, affection: number, respect: number, resentment: number): { label: string; tone: 'success' | 'accent' | 'warning' | 'danger' } {
  const score = trust * 0.34 + affection * 0.38 + respect * 0.28 - resentment * 0.52;
  if (score >= 72) return { label: 'Close', tone: 'success' };
  if (score >= 52) return { label: 'Solid', tone: 'accent' };
  if (score >= 34) return { label: 'Distant', tone: 'warning' };
  return { label: 'Strained', tone: 'danger' };
}

export default function RelationshipScreen() {
  const { personId } = useLocalSearchParams<{ personId?: string }>();
  const { world } = useGame();
  const { colors } = useAppTheme();
  if (!world || !personId) return null;

  const actor = world.characters[world.playerCharacterId];
  const person = world.characters[personId];
  const relationship = Object.values(world.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(personId));
  if (!person || !relationship) {
    return <AppScreen><Pressable onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.secondary }]}><Text style={[styles.backText, { color: colors.text }]}>‹ People</Text></Pressable><Card><Heading size="small">That relationship is no longer available</Heading><Body secondary>The person or relationship could not be found in this save.</Body></Card></AppScreen>;
  }

  const age = playerAgeYears(world);
  const personAge = ageOf(world.calendar.week, person.birthWeek);
  const role = actor.parentIds.includes(person.id) ? 'parent' : actor.childIds.includes(person.id) ? 'child' : relationship.kind;
  const portrait = relationshipPortrait(world, person.id);
  const need = relationshipNeed(world, person.id);
  const temperature = relationshipTemperature(relationship.trust, relationship.affection, relationship.respect, relationship.resentment);
  const arcs = getConsequenceArcs(world, person.id);
  const memories = Object.values(world.memories)
    .filter((memory) => memory.participantIds.includes(actor.id) && memory.participantIds.includes(person.id))
    .sort((left, right) => right.week - left.week);
  const outstandingLoan = relationshipLoanBalance(world, person.id);
  const isPartner = ['partner', 'spouse'].includes(role) && actor.partnerId === person.id;
  const isFamily = ['parent', 'child', 'sibling', 'relative', 'partner', 'spouse'].includes(role);
  const isChild = role === 'child';
  const isParent = role === 'parent';
  const ownedBusinesses = Object.values(world.businesses).filter((business) => business.active && (business.ownerId ?? business.founderId) === actor.id && business.playerOwnershipBps > 0);
  const currentBusiness = ownedBusinesses[0];
  const targetEducation = Object.values(world.education).find((record) => record.characterId === person.id && ['school', 'higher', 'trade'].includes(record.status));

  return (
    <AppScreen>
      <Pressable onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.secondary }]}><Text style={[styles.backText, { color: colors.text }]}>‹ People</Text></Pressable>

      <View style={styles.header}>
        <View style={styles.row}><View style={{ flex: 1, gap: 4 }}><Eyebrow>{relationshipLabel(role).toUpperCase()} · AGE {personAge}</Eyebrow><Heading size="large">{person.firstName} {person.lastName}</Heading></View><StatusPill tone={temperature.tone}>{temperature.label}</StatusPill></View>
        <Body secondary>{portrait.currentLife}</Body>
      </View>

      <Card accent>
        <View style={styles.row}><View style={{ flex: 1, gap: 4 }}><Eyebrow>WHAT THIS RELATIONSHIP NEEDS</Eyebrow><Heading size="small">{need.title}</Heading></View><StatusPill tone={need.tone}>{weeksAgo(world.calendar.week, relationship.lastInteractionWeek)}</StatusPill></View>
        <Body>{need.detail}</Body>
      </Card>

      <Card>
        <View style={styles.metrics}>
          <View style={styles.metric}><View style={styles.row}><Body>Trust</Body><Body secondary>{Math.round(relationship.trust)}</Body></View><ProgressBar value={relationship.trust} /></View>
          <View style={styles.metric}><View style={styles.row}><Body>Affection</Body><Body secondary>{Math.round(relationship.affection)}</Body></View><ProgressBar value={relationship.affection} tone="legacy" /></View>
          <View style={styles.metric}><View style={styles.row}><Body>Respect</Body><Body secondary>{Math.round(relationship.respect)}</Body></View><ProgressBar value={relationship.respect} /></View>
          <View style={styles.metric}><View style={styles.row}><Body>Resentment</Body><Body secondary>{Math.round(relationship.resentment)}</Body></View><ProgressBar value={relationship.resentment} tone="danger" /></View>
        </View>
        <View style={styles.traits}>{portrait.traits.map((trait) => <StatusPill key={trait} tone="neutral">{trait}</StatusPill>)}</View>
      </Card>

      {arcs.length > 0 ? <View style={styles.section}>
        <SectionHeader title="What is unfolding" action={<StatusPill tone="warning">{arcs.length} active</StatusPill>} />
        {arcs.slice(0, 4).map((arc) => <Card key={arc.id}><View style={styles.row}><Heading size="small">{arc.category.replace('Arc · ', '').replace('Promise · ', '').replace('Obligation · ', '')}</Heading><StatusPill tone={arc.importance >= 82 ? 'danger' : 'warning'}>{arc.importance >= 82 ? 'Hot' : 'In motion'}</StatusPill></View><Body>{arc.narrative}</Body></Card>)}
      </View> : null}

      <View style={styles.section}>
        <SectionHeader title="Be in their life" />
        <Card><Body secondary>Relationships have more depth when you choose *how* to show up instead of repeatedly pressing the same generic button.</Body><View style={styles.actions}>
          <EngineActionButton title="Make a priority" action={{ verb: 'relationship.prioritize', targetIds: [person.id], parameters: {} }} tone="accent" style={styles.button} />
          <EngineActionButton title="Ask about their life" action={{ verb: 'relationship.check_in', targetIds: [person.id], parameters: {} }} style={styles.button} />
          <EngineActionButton title="One-on-one time" action={{ verb: 'relationship.one_on_one', targetIds: [person.id], parameters: { amountCents: 2500 } }} style={styles.button} />
          <EngineActionButton title="Real conversation" action={{ verb: 'relationship.deep_talk', targetIds: [person.id], parameters: {} }} style={styles.button} />
          <EngineActionButton title="Celebrate them" action={{ verb: 'relationship.celebrate', targetIds: [person.id], parameters: { amountCents: 7500 } }} style={styles.button} />
          <EngineActionButton title="Thoughtful gift" action={{ verb: 'relationship.gift', targetIds: [person.id], parameters: { amountCents: 20000 } }} style={styles.button} />
          <EngineActionButton title="Support their goal" action={{ verb: 'relationship.support_goal', targetIds: [person.id], parameters: {} }} style={styles.button} />
          {memories.some((memory) => memory.valence > 0.2 || memory.permanent) ? <EngineActionButton title="Reminisce" action={{ verb: 'relationship.reminisce', targetIds: [person.id], parameters: {} }} style={styles.button} /> : null}
        </View></Card>
      </View>

      {isPartner ? <View style={styles.section}>
        <SectionHeader title="The relationship itself" />
        <Card><Body secondary>Romance is allowed to become a whole story: shared experiences, expectations, repair, money, children, work pressure, and eventually succession can all touch it.</Body><View style={styles.actions}>
          <EngineActionButton title="Date night" action={{ verb: 'relationship.date_night', targetIds: [person.id], parameters: { amountCents: 12000 } }} tone="accent" style={styles.button} />
          {age >= 18 && personAge >= 18 ? <EngineActionButton title="Weekend away" action={{ verb: 'relationship.weekend_away', targetIds: [person.id], parameters: { amountCents: 95000 } }} style={styles.button} /> : null}
          <EngineActionButton title="Plan the future" action={{ verb: 'relationship.plan_future', targetIds: [person.id], parameters: {} }} style={styles.button} />
          {relationship.kind === 'partner' && age >= 18 ? <EngineActionButton title="Propose" action={{ verb: 'relationship.propose', targetIds: [person.id], parameters: {} }} tone="accent" style={styles.button} /> : null}
          <EngineActionButton title="Separate" action={{ verb: 'relationship.separate', targetIds: [person.id], parameters: {}, destructive: true }} tone="danger" style={styles.button} />
        </View></Card>
      </View> : null}

      <View style={styles.section}>
        <SectionHeader title="Repair, honesty & boundaries" />
        <Card><View style={styles.actions}>
          <EngineActionButton title="Apologize" action={{ verb: 'relationship.apologize', targetIds: [person.id], parameters: {} }} style={styles.button} />
          <EngineActionButton title="Forgive" action={{ verb: 'relationship.forgive', targetIds: [person.id], parameters: {} }} style={styles.button} />
          <EngineActionButton title="Set a boundary" action={{ verb: 'relationship.set_boundary', targetIds: [person.id], parameters: {} }} style={styles.button} />
        </View></Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Support, favors & money" action={outstandingLoan > 0 ? <StatusPill tone="warning">{money(outstandingLoan)} owed</StatusPill> : undefined} />
        <Card><Body secondary>Money and favors do not disappear after the tap. Loans, obligations, introductions, repayment friction, and returned favors become shared history.</Body><View style={styles.actions}>
          <EngineActionButton title="Ask a favor" action={{ verb: 'relationship.ask_favor', targetIds: [person.id], parameters: {} }} style={styles.button} />
          <EngineActionButton title="Lend $1,000" action={{ verb: 'relationship.lend_money', targetIds: [person.id], parameters: { amountCents: 100000 } }} style={styles.button} />
          {outstandingLoan > 0 ? <EngineActionButton title={`Ask for ${money(Math.min(outstandingLoan, 100000))}`} action={{ verb: 'relationship.collect_loan', targetIds: [person.id], parameters: { amountCents: Math.min(outstandingLoan, 100000) } }} tone="warning" style={styles.button} /> : null}
          <EngineActionButton title="Give $100" action={{ verb: 'relationship.transfer_cash', targetIds: [person.id], parameters: { amountCents: 10000 } }} style={styles.button} />
          {Object.values(world.relationships).some((item) => item.kind === 'professional' && item.characterIds.includes(actor.id) && !item.characterIds.includes(person.id)) ? <EngineActionButton title="Make an introduction" action={{ verb: 'relationship.introduce_network', targetIds: [person.id], parameters: {} }} style={styles.button} /> : null}
        </View></Card>
      </View>

      {isFamily ? <View style={styles.section}>
        <SectionHeader title="Family life" />
        <Card><View style={styles.actions}>
          <EngineActionButton title="Family dinner" action={{ verb: 'family.family_dinner', targetIds: [person.id], parameters: { amountCents: 12000 } }} style={styles.button} />
          <EngineActionButton title="Show up for their event" action={{ verb: 'family.attend_event', targetIds: [person.id], parameters: {} }} style={styles.button} />
          {isChild && targetEducation ? <EngineActionButton title="Help with school" action={{ verb: 'family.help_school', targetIds: [person.id], parameters: {} }} style={styles.button} /> : null}
          {isChild && personAge >= 10 ? <EngineActionButton title="Teach about money" action={{ verb: 'family.teach_money', targetIds: [person.id], parameters: {} }} style={styles.button} /> : null}
          {isChild && personAge < 25 ? <EngineActionButton title="Set expectations" action={{ verb: 'family.set_expectations', targetIds: [person.id], parameters: {} }} style={styles.button} /> : null}
          {(isParent || personAge >= 55 || person.health < 65) ? <EngineActionButton title="Help care for them" action={{ verb: 'family.caregiving', targetIds: [person.id], parameters: { amountCents: 20000 } }} style={styles.button} /> : null}
          {age >= 18 && personAge >= 16 ? <EngineActionButton title="Discuss inheritance" action={{ verb: 'family.discuss_inheritance', targetIds: [person.id], parameters: {} }} style={styles.button} /> : null}
          {age >= 18 && personAge >= 16 && currentBusiness ? <EngineActionButton title={`Invite to ${currentBusiness.name}`} action={{ verb: 'family.invite_business', targetIds: [person.id, currentBusiness.id], parameters: { businessId: currentBusiness.id } }} style={styles.button} /> : null}
          {age >= 18 && ['child', 'sibling', 'relative'].includes(role) ? <EngineActionButton title="Name preferred successor" action={{ verb: 'estate.designate_successor', targetIds: [person.id], parameters: {} }} tone="accent" style={styles.button} /> : null}
        </View></Card>
      </View> : null}

      <View style={styles.section}>
        <SectionHeader title="Shared history" action={<StatusPill tone="neutral">{memories.length}</StatusPill>} />
        {memories.length === 0 ? <Card><Body secondary>You have history in the ordinary sense, but nothing important enough has been written into long-term memory yet.</Body></Card> : memories.slice(0, 10).map((memory) => <Card key={memory.id}><View style={styles.row}><Heading size="small">{memory.category}</Heading><StatusPill tone={memory.unresolved ? 'warning' : memory.valence > 0.4 ? 'success' : 'neutral'}>{memory.unresolved ? 'Unfinished' : 'Remembered'}</StatusPill></View><Body>{memory.narrative}</Body><Eyebrow>{weeksAgo(world.calendar.week, memory.week).toUpperCase()} · IMPORTANCE {Math.round(memory.importance)}</Eyebrow></Card>)}
      </View>

      {age >= 8 ? <OtherActionComposer domains={['relationship', 'family', 'dynasty']} placeholder={`Do something else with ${person.firstName}…`} /> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', minHeight: 38, borderRadius: radius.pill, paddingHorizontal: 12, justifyContent: 'center', marginTop: 4 },
  backText: { fontSize: 13, fontWeight: '700' },
  header: { gap: 6, paddingTop: 4 },
  section: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  metrics: { gap: spacing.md },
  metric: { gap: 6 },
  traits: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  button: { flexGrow: 1, flexBasis: '46%' },
});
