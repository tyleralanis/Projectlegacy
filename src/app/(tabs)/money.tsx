import React from 'react';
import { StyleSheet, View } from 'react-native';

import { MenuTile } from '@/components/MenuTile';
import { OtherActionComposer } from '@/components/OtherActionComposer';
import { playerAgeYears } from '@/engine/createWorld';
import { formatMoney, holdingValueCents, netWorthCents } from '@/engine/money';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Eyebrow, Heading, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

export default function MoneyScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const age = playerAgeYears(world);
  const properties = Object.values(world.properties).filter((property) => property.ownerId === actor.id);
  const liabilities = Object.values(world.liabilities).filter((liability) => liability.debtorId === actor.id);
  const worth = netWorthCents(world);
  const invested = holdingValueCents(world, actor.id);
  const retained = Object.values(world.organizations).filter((organization) => organization.kind === 'professional' && organization.memberIds.includes(actor.id));
  const recent = world.transactions.filter((transaction) => transaction.week > world.calendar.week - 52);
  const inflow = recent.filter((transaction) => transaction.amountCents > 0).reduce((total, transaction) => total + transaction.amountCents, 0);
  const outflow = recent.filter((transaction) => transaction.amountCents < 0).reduce((total, transaction) => total - transaction.amountCents, 0);
  const parents = actor.parentIds.map((id) => world.characters[id]).filter((person) => person?.isAlive);
  const familyCash = parents.reduce((total, person) => total + Math.max(0, person.cashCents), 0);
  const familyTone = familyCash >= 25_000_000 ? 'Comfortable' : familyCash >= 5_000_000 ? 'Stable' : familyCash >= 1_000_000 ? 'Tight' : 'Strained';

  if (age < 14) {
    return (
      <AppScreen>
        <View style={styles.header}><Eyebrow>MONEY IS MOSTLY A PARENT PROBLEM</Eyebrow><Heading size="large">Money</Heading><Body secondary>You do not have much financial control yet, but the household you grow up in still shapes stress, opportunity, school choices, and what “normal” feels like.</Body></View>
        <Card accent><View style={styles.stats}><Stat label="Your cash" value={formatMoney(actor.cashCents, true)} /><Stat label="Family situation" value={familyTone} tone={familyTone === 'Strained' ? 'danger' : familyTone === 'Comfortable' ? 'success' : 'default'} /><Stat label="Parents around" value={parents.length.toString()} /></View></Card>
        <Card><Heading size="small">🏡 The household matters</Heading><Body secondary>Parents earn, spend, and feel economic pressure in the background now. A strong household can create options later; a strained one can create stress long before you ever see a mortgage application.</Body></Card>
        <Card><Heading size="small">🪙 Your own money will start small</Heading><Body secondary>Teen work, gifts, and later career income become yours. Investing, property, debt, and expensive advisors stay out of the way until they make sense.</Body></Card>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <View style={styles.header}><Eyebrow>{age < 18 ? 'YOUR FIRST MONEY' : 'THE MONEY DRAWER'}</Eyebrow><Heading size="large">Money</Heading><Body secondary>{age < 18 ? 'You can earn and save now. The bigger financial machinery opens as adulthood arrives.' : 'See the big picture here. Open the part you actually want to mess with.'}</Body></View>

      <Card accent>
        <View style={styles.stats}><Stat label="Cash" value={formatMoney(actor.cashCents, true)} tone={actor.cashCents < 0 ? 'danger' : 'default'} /><Stat label="Net worth" value={formatMoney(worth, true)} tone="legacy" /><Stat label="Invested" value={formatMoney(invested, true)} /><Stat label="Debt" value={formatMoney(liabilities.reduce((sum, item) => sum + item.principalCents, 0), true)} tone="danger" /></View>
      </Card>

      {age >= 18 ? <>
        <MenuTile icon="📈" title="Investing" subtitle="Stocks, diversified funds, positions, market conditions, and eventually professional management." route="/investing" badge={formatMoney(invested, true)} />
        <MenuTile icon="🏠" title="Property" subtitle="Browse a market that changes every month or manage homes, rentals, commercial buildings, land, debt, tenants, and renovations." route="/property" badge={`${properties.length} owned`} />
        <MenuTile icon="🧑‍💼" title="Your team" subtitle="Wealth manager, attorney, tax advisor, security consultant, family office, and other expensive grown-up problems." route="/advisors" badge={`${retained.length} retained`} />
      </> : <Card><Heading size="small">Adult finance is still locked</Heading><Body secondary>For now, cash, work, school, and family circumstance are the main story. Property, investing, borrowing, and professional advisors open at 18.</Body><StatusPill tone="accent">{18 - age} year{18 - age === 1 ? '' : 's'} to go</StatusPill></Card>}

      <View style={styles.section}>
        <SectionHeader title="Last 52 weeks" action={<StatusPill tone={inflow >= outflow ? 'success' : 'warning'}>{inflow >= outflow ? 'Cash positive' : 'Cash negative'}</StatusPill>} />
        <Card><View style={styles.stats}><Stat label="Inflows" value={formatMoney(inflow, true)} tone="success" /><Stat label="Outflows" value={formatMoney(outflow, true)} tone="danger" /><Stat label="Net" value={formatMoney(inflow - outflow, true)} tone={inflow >= outflow ? 'success' : 'danger'} /></View>{age >= 18 ? <Body secondary>Asset price changes are not cash flow. A billionaire can still be annoyingly illiquid.</Body> : <Body secondary>At this age, earning your own money is more important than pretending you have a family office.</Body>}</Card>
      </View>

      {age >= 18 ? <View style={styles.section}>
        <SectionHeader title="Personal liabilities" action={<StatusPill>{liabilities.length}</StatusPill>} />
        {liabilities.length === 0 ? <Card><Body secondary>No personal liabilities recorded. Mortgages and company debt still live with their assets.</Body></Card> : liabilities.map((liability) => <Card key={liability.id}><View style={styles.row}><Heading size="small">{liability.kind}</Heading><StatusPill tone="danger">{formatMoney(liability.principalCents, true)}</StatusPill></View><Body secondary>{(liability.annualRateBps / 100).toFixed(2)}% annual rate · {formatMoney(liability.weeklyPaymentCents)} weekly payment</Body></Card>)}
      </View> : null}

      {age >= 18 ? <OtherActionComposer domains={['property', 'markets', 'business', 'legal', 'organization']} placeholder="Something money-related we did not put in a menu…" /> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4, paddingTop: 8 },
  section: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
});
