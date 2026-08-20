import React from 'react';
import { StyleSheet, View } from 'react-native';

import { MenuTile } from '@/components/MenuTile';
import { OtherActionComposer } from '@/components/OtherActionComposer';
import { formatMoney, holdingValueCents, netWorthCents } from '@/engine/money';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Eyebrow, Heading, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

export default function MoneyScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const properties = Object.values(world.properties).filter((property) => property.ownerId === actor.id);
  const liabilities = Object.values(world.liabilities).filter((liability) => liability.debtorId === actor.id);
  const worth = netWorthCents(world);
  const invested = holdingValueCents(world, actor.id);
  const retained = Object.values(world.organizations).filter((organization) => organization.kind === 'professional' && organization.memberIds.includes(actor.id));
  const recent = world.transactions.filter((transaction) => transaction.week > world.calendar.week - 52);
  const inflow = recent.filter((transaction) => transaction.amountCents > 0).reduce((total, transaction) => total + transaction.amountCents, 0);
  const outflow = recent.filter((transaction) => transaction.amountCents < 0).reduce((total, transaction) => total - transaction.amountCents, 0);

  return (
    <AppScreen>
      <View style={styles.header}><Eyebrow>THE MONEY DRAWER</Eyebrow><Heading size="large">Money</Heading><Body secondary>See the big picture here. Open the part you actually want to mess with.</Body></View>

      <Card accent>
        <View style={styles.stats}><Stat label="Cash" value={formatMoney(actor.cashCents, true)} tone={actor.cashCents < 0 ? 'danger' : 'default'} /><Stat label="Net worth" value={formatMoney(worth, true)} tone="legacy" /><Stat label="Invested" value={formatMoney(invested, true)} /><Stat label="Debt" value={formatMoney(liabilities.reduce((sum, item) => sum + item.principalCents, 0), true)} tone="danger" /></View>
      </Card>

      <MenuTile icon="📈" title="Investing" subtitle="Stocks, diversified funds, positions, market conditions, and eventually professional management." route="/investing" badge={formatMoney(invested, true)} />
      <MenuTile icon="🏠" title="Property" subtitle="Browse a market that changes every month or manage homes, rentals, commercial buildings, land, debt, tenants, and renovations." route="/property" badge={`${properties.length} owned`} />
      <MenuTile icon="🧑‍💼" title="Your team" subtitle="Wealth manager, attorney, tax advisor, security consultant, family office, and other expensive grown-up problems." route="/advisors" badge={`${retained.length} retained`} />

      <View style={styles.section}>
        <SectionHeader title="Last 52 weeks" action={<StatusPill tone={inflow >= outflow ? 'success' : 'warning'}>{inflow >= outflow ? 'Cash positive' : 'Cash negative'}</StatusPill>} />
        <Card><View style={styles.stats}><Stat label="Inflows" value={formatMoney(inflow, true)} tone="success" /><Stat label="Outflows" value={formatMoney(outflow, true)} tone="danger" /><Stat label="Net" value={formatMoney(inflow - outflow, true)} tone={inflow >= outflow ? 'success' : 'danger'} /></View><Body secondary>Asset price changes are not cash flow. A billionaire can still be annoyingly illiquid.</Body></Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Personal liabilities" action={<StatusPill>{liabilities.length}</StatusPill>} />
        {liabilities.length === 0 ? <Card><Body secondary>No personal liabilities recorded. Mortgages and company debt still live with their assets.</Body></Card> : liabilities.map((liability) => <Card key={liability.id}><View style={styles.row}><Heading size="small">{liability.kind}</Heading><StatusPill tone="danger">{formatMoney(liability.principalCents, true)}</StatusPill></View><Body secondary>{(liability.annualRateBps / 100).toFixed(2)}% annual rate · {formatMoney(liability.weeklyPaymentCents)} weekly payment</Body></Card>)}
      </View>

      <OtherActionComposer domains={['property', 'markets', 'business', 'legal', 'organization']} placeholder="Something money-related we didn't put in a menu…" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4, paddingTop: 8 },
  section: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
});
