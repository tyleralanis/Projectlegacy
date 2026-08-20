import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { OtherActionComposer } from '@/components/OtherActionComposer';
import { competency } from '@/engine/competencies';
import { formatMoney, holdingValueCents, netWorthCents } from '@/engine/money';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

function age(worldWeek: number, birthWeek: number): number {
  return Math.max(0, Math.floor((worldWeek - birthWeek) / 52));
}

export default function DynastyScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const heir = world.dynasty.activeHeirId ? world.characters[world.dynasty.activeHeirId] : undefined;
  const familyRelationships = Object.values(world.relationships)
    .filter((relationship) => relationship.characterIds.includes(actor.id) && ['child', 'sibling', 'relative', 'spouse', 'partner'].includes(relationship.kind))
    .map((relationship) => ({
      relationship,
      person: world.characters[relationship.characterIds.find((id) => id !== actor.id)!],
    }))
    .filter(({ person }) => person?.isAlive)
    .sort((left, right) => {
      const leftPriority = left.relationship.kind === 'child' ? 0 : left.relationship.kind === 'spouse' || left.relationship.kind === 'partner' ? 1 : 2;
      const rightPriority = right.relationship.kind === 'child' ? 0 : right.relationship.kind === 'spouse' || right.relationship.kind === 'partner' ? 1 : 2;
      return leftPriority - rightPriority || left.person.birthWeek - right.person.birthWeek;
    });
  const properties = Object.values(world.properties).filter((property) => property.ownerId === actor.id);
  const businesses = Object.values(world.businesses).filter((business) => business.active && (business.ownerId ?? business.founderId) === actor.id && business.playerOwnershipBps > 0);
  const holdings = Object.values(world.holdings).filter((holding) => holding.ownerId === actor.id);
  const dynastyMemories = Object.values(world.memories)
    .filter((memory) => memory.participantIds.includes(actor.id) && (memory.category.startsWith('Dynasty ·') || memory.category.toLowerCase().includes('inheritance') || memory.category.toLowerCase().includes('succession')))
    .sort((left, right) => right.week - left.week)
    .slice(0, 8);

  return (
    <AppScreen>
      <SubviewHeader eyebrow="More" title="Dynasty & succession" subtitle="Inheritance should transfer a complicated life, not just a number. Develop people before they inherit, make expectations explicit, move assets deliberately, and watch family relationships react to control and money." />

      <Card accent>
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 3 }}><Heading>{world.dynasty.familyName} legacy</Heading><Body secondary>Generation {world.dynasty.generation} · founded by {world.characters[world.dynasty.founderId]?.firstName ?? 'Unknown'}</Body></View>
          <StatusPill tone={heir?.isAlive ? 'success' : 'warning'}>{heir?.isAlive ? `${heir.firstName} preferred` : 'Open succession'}</StatusPill>
        </View>
        <View style={styles.stats}><Stat label="Net worth" value={formatMoney(netWorthCents(world), true)} tone="legacy" /><Stat label="Businesses" value={businesses.length.toString()} /><Stat label="Property" value={properties.length.toString()} /><Stat label="Invested" value={formatMoney(holdingValueCents(world, actor.id), true)} /></View>
        <Body secondary>The point is not merely deciding who gets the pile. The successor can be prepared—or completely unprepared—for the people, companies, debts, institutions, reputation, and unfinished conflicts attached to it.</Body>
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Family governance" />
        <Card>
          <Heading size="small">Put the difficult conversation on the calendar</Heading>
          <Body secondary>A family council improves shared context around ownership, care, expectations, control, and succession. It can reduce ambiguity without forcing everybody to agree.</Body>
          <EngineActionButton title="Hold family council" action={{ verb: 'dynasty.family_council', targetIds: [], parameters: {} }} tone="accent" />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Possible successors" action={<StatusPill>{familyRelationships.length}</StatusPill>} />
        {familyRelationships.length === 0 ? <Card><Body secondary>There is no living spouse, child, sibling, or close relative around the active character yet. Succession remains open until family exists.</Body></Card> : familyRelationships.map(({ relationship, person }) => {
          const leadership = competency(world, person.id, 'leadership');
          const management = competency(world, person.id, 'management');
          const finance = competency(world, person.id, 'finance');
          const negotiation = competency(world, person.id, 'negotiation');
          const readiness = (leadership + management + finance + negotiation) / 4;
          const selected = heir?.id === person.id;
          return <Card key={relationship.id} accent={selected}>
            <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{person.firstName} {person.lastName}</Heading><Body secondary>{relationship.kind} · age {age(world.calendar.week, person.birthWeek)} · trust {Math.round(relationship.trust)} · resentment {Math.round(relationship.resentment)}</Body></View><StatusPill tone={selected ? 'success' : readiness >= 65 ? 'accent' : 'neutral'}>{selected ? 'Preferred heir' : `Readiness ${Math.round(readiness)}`}</StatusPill></View>
            <View style={styles.stats}><Stat label="Leadership" value={Math.round(leadership).toString()} /><Stat label="Management" value={Math.round(management).toString()} /><Stat label="Finance" value={Math.round(finance).toString()} /><Stat label="Negotiation" value={Math.round(negotiation).toString()} /></View>
            <ProgressBar value={readiness} tone={readiness >= 70 ? 'success' : readiness >= 50 ? 'accent' : 'legacy'} />
            <View style={styles.actions}>
              {!selected ? <EngineActionButton title={`Choose ${person.firstName} as successor`} action={{ verb: 'estate.designate_successor', targetIds: [person.id], parameters: {} }} tone="accent" style={styles.actionButton} /> : null}
              <EngineActionButton title={`Develop ${person.firstName}`} action={{ verb: 'dynasty.train_heir', targetIds: [person.id], parameters: {} }} style={styles.actionButton} />
            </View>
          </Card>;
        })}
      </View>

      {heir?.isAlive ? <View style={styles.section}>
        <SectionHeader title={`Move assets toward ${heir.firstName}`} action={<StatusPill tone="warning">Irreversible transfers</StatusPill>} />
        <Card><Body secondary>Gifting before death can clarify control and test the next generation while you are still around to see what they do with it. Transfers are not pretend planning—they change ownership immediately.</Body></Card>
        {properties.map((property) => <Card key={property.id}><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{property.name}</Heading><Body secondary>{property.kind} · {formatMoney(property.valueCents, true)} value · {formatMoney(property.debtCents, true)} debt</Body></View><StatusPill>{formatMoney(property.valueCents - property.debtCents, true)} equity</StatusPill></View><EngineActionButton title={`Gift property to ${heir.firstName}`} action={{ verb: 'estate.gift_asset', targetIds: [property.id], parameters: { recipientId: heir.id }, destructive: true }} tone="danger" /></Card>)}
        {holdings.map((holding) => {
          const security = world.securities[holding.securityId];
          if (!security) return null;
          const value = Math.round(holding.unitsMilli * security.priceCents / 1000);
          return <Card key={holding.id}><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{security.name}</Heading><Body secondary>{security.symbol} · market position</Body></View><StatusPill>{formatMoney(value, true)}</StatusPill></View><EngineActionButton title={`Gift position to ${heir.firstName}`} action={{ verb: 'estate.gift_asset', targetIds: [holding.id], parameters: { recipientId: heir.id }, destructive: true }} tone="danger" /></Card>;
        })}
      </View> : null}

      {dynastyMemories.length > 0 ? <View style={styles.section}>
        <SectionHeader title="What the family remembers" />
        {dynastyMemories.map((memory) => <Card key={memory.id}><View style={styles.row}><Heading size="small">{memory.category.replace('Dynasty · ', '')}</Heading><StatusPill tone={memory.unresolved ? 'warning' : 'neutral'}>{memory.unresolved ? 'Still open' : `Week ${memory.week}`}</StatusPill></View><Body secondary>{memory.narrative}</Body></Card>)}
      </View> : null}

      <OtherActionComposer domains={['dynasty', 'family']} placeholder="Another succession, inheritance, or family-governance move…" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: { flexGrow: 1, flexBasis: 150 },
});
