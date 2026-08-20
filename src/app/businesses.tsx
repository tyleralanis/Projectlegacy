import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { WORLD_CONTENT } from '@/content/worldContent';
import { formatMoney } from '@/engine/money';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

export default function BusinessesScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const businesses = Object.values(world.businesses).filter((business) => (business.ownerId ?? business.founderId) === actor.id && business.active && business.playerOwnershipBps > 0);
  const activeCareer = Object.values(world.careers).find((career) => career.characterId === actor.id && career.active);
  const ownerLed = businesses.filter((business) => !business.delegated);

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Work" title="Businesses" subtitle="Ownership is not free time. Run one yourself, or hire leadership before stacking companies on top of a career." />
      <Card accent>
        <View style={styles.stats}><Stat label="Companies" value={businesses.length.toString()} /><Stat label="Owner-led" value={ownerLed.length.toString()} /><Stat label="Day job" value={activeCareer ? 'Yes' : 'No'} /><Stat label="Business rep" value={Math.round(actor.reputation.business).toString()} /></View>
        {ownerLed.length > 0 && activeCareer ? <Body secondary>You are balancing a day job with an owner-led company. Starting another company is blocked until you delegate or leave the job.</Body> : null}
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Start something" />
        <Body secondary>Each sector behaves differently. Starting capital comes from your personal cash.</Body>
        <View style={styles.grid}>
          {WORLD_CONTENT.businessSectors.map((sector) => (
            <Card key={sector.id} style={styles.sectorCard}>
              <Heading size="small">{sector.name}</Heading>
              <Body secondary>Base capacity {sector.baseCapacity} · labor intensity {Math.round(sector.laborIntensity * 100)}%</Body>
              <EngineActionButton title={`Start with ${formatMoney(sector.startupCostCents, true)}`} action={{ verb: 'business.create', targetIds: [], parameters: { amountCents: sector.startupCostCents, sector: sector.name, name: `${actor.lastName} ${sector.name}` } }} tone="accent" />
            </Card>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Your companies" action={<StatusPill>{businesses.length}</StatusPill>} />
        {businesses.length === 0 ? <Card><Body secondary>No companies yet.</Body></Card> : businesses.map((business) => {
          const org = world.organizations[business.organizationId];
          const leader = org?.leaderId ? world.characters[org.leaderId] : undefined;
          const ceo = business.delegated && leader && leader.id !== actor.id ? leader : undefined;
          const overload = business.demand / Math.max(1, business.capacity);
          return (
            <Card key={business.id}>
              <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{business.name}</Heading><Body secondary>{business.sector} · {business.employees} employees · {business.delegated ? 'Professionally managed' : 'Owner-led'}</Body></View><StatusPill tone={business.cashCents > 0 ? 'success' : 'danger'}>{formatMoney(business.valuationCents, true)}</StatusPill></View>
              <View style={styles.stats}><Stat label="Weekly revenue" value={formatMoney(business.revenueWeeklyCents, true)} /><Stat label="Weekly cost" value={formatMoney(business.costWeeklyCents, true)} /><Stat label="Cash" value={formatMoney(business.cashCents, true)} tone={business.cashCents < 0 ? 'danger' : 'default'} /><Stat label="Ownership" value={`${(business.playerOwnershipBps / 100).toFixed(1)}%`} /></View>
              <View style={{ gap: 7 }}><View style={styles.row}><Body>Demand / capacity</Body><Body secondary>{Math.round(business.demand)} / {Math.round(business.capacity)}</Body></View><ProgressBar value={Math.min(100, overload * 70)} tone={overload > 1 ? 'danger' : 'success'} /></View>
              {ceo ? <Card accent><Heading size="small">CEO · {ceo.firstName} {ceo.lastName}</Heading><Body secondary>Management {Math.round((ceo.discipline + ceo.charisma + ceo.ambition) / 3)}/100 · business reputation {Math.round(ceo.reputation.business)}</Body></Card> : <EngineActionButton title="Headhunt & hire a CEO" action={{ verb: 'business.delegate', targetIds: [business.id], parameters: {} }} tone="accent" />}
              <View style={styles.actions}>
                <EngineActionButton title="Hire employee" action={{ verb: 'business.hire', targetIds: [business.id], parameters: { count: 1 } }} style={{ flex: 1 }} />
                <EngineActionButton title="Add $10k capital" action={{ verb: 'business.contribute_capital', targetIds: [business.id], parameters: { amountCents: 1_000_000 } }} style={{ flex: 1 }} />
                <EngineActionButton title="Borrow $25k" action={{ verb: 'business.borrow', targetIds: [business.id], parameters: { amountCents: 2_500_000 } }} style={{ flex: 1 }} />
              </View>
              <View style={styles.actions}>
                <EngineActionButton title="Value pricing" action={{ verb: 'business.set_price', targetIds: [business.id], parameters: { position: 'value' } }} style={{ flex: 1 }} />
                <EngineActionButton title="Market pricing" action={{ verb: 'business.set_price', targetIds: [business.id], parameters: { position: 'market' } }} style={{ flex: 1 }} />
                <EngineActionButton title="Premium pricing" action={{ verb: 'business.set_price', targetIds: [business.id], parameters: { position: 'premium' } }} style={{ flex: 1 }} />
              </View>
              <View style={styles.actions}>
                <EngineActionButton title="Marketing 5%" action={{ verb: 'business.advertise', targetIds: [business.id], parameters: { marketingBps: 500 } }} style={{ flex: 1 }} />
                <EngineActionButton title="Marketing 15%" action={{ verb: 'business.advertise', targetIds: [business.id], parameters: { marketingBps: 1500 } }} style={{ flex: 1 }} />
                <EngineActionButton title="Raise capital" action={{ verb: 'business.raise_capital', targetIds: [business.id], parameters: { equityBps: 1500 } }} style={{ flex: 1 }} />
              </View>
              <EngineActionButton title="Sell business" action={{ verb: 'business.sell', targetIds: [business.id], parameters: {}, destructive: true }} tone="danger" />
            </Card>
          );
        })}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grid: { gap: spacing.md },
  sectorCard: { gap: spacing.sm },
});
