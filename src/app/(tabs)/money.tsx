import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { OtherActionComposer } from '@/components/OtherActionComposer';
import { formatMoney, holdingValueCents, netWorthCents } from '@/engine/money';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Eyebrow, Heading, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

export default function MoneyScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const properties = Object.values(world.properties).filter((property) => property.ownerId === actor.id);
  const holdings = Object.values(world.holdings).filter((holding) => holding.ownerId === actor.id);
  const liabilities = Object.values(world.liabilities).filter((liability) => liability.debtorId === actor.id);
  const recent = world.transactions.filter((transaction) => transaction.week > world.calendar.week - 52);
  const inflow = recent.filter((transaction) => transaction.amountCents > 0).reduce((total, transaction) => total + transaction.amountCents, 0);
  const outflow = recent.filter((transaction) => transaction.amountCents < 0).reduce((total, transaction) => total - transaction.amountCents, 0);
  const worth = netWorthCents(world);

  return (
    <AppScreen>
      <View style={styles.header}><View style={{ alignSelf: 'stretch', gap: 4 }}><Eyebrow>OWNERSHIP & LIQUIDITY</Eyebrow><Heading size="large">Money</Heading><Body secondary>Cash, cash flow, debt, ownership, and net worth remain separate.</Body></View><StatusPill tone={actor.cashCents >= 0 ? 'success' : 'danger'}>{actor.cashCents >= 0 ? 'Liquid' : 'Cash deficit'}</StatusPill></View>

      <Card accent>
        <View style={styles.stats}><Stat label="Cash" value={formatMoney(actor.cashCents, true)} tone={actor.cashCents < 0 ? 'danger' : 'default'} /><Stat label="Net worth" value={formatMoney(worth, true)} tone="legacy" /><Stat label="Investments" value={formatMoney(holdingValueCents(world, actor.id), true)} /><Stat label="Debt" value={formatMoney(liabilities.reduce((total, item) => total + item.principalCents, 0), true)} tone="danger" /></View>
        <View style={styles.metric}><View style={styles.row}><Body>Liquidity within net worth</Body><Body secondary>{worth > 0 ? `${Math.max(0, Math.round(actor.cashCents / worth * 100))}%` : '—'}</Body></View><ProgressBar value={worth > 0 ? actor.cashCents / worth * 100 : 0} tone="legacy" /></View>
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Trailing 52 weeks" />
        <Card><View style={styles.stats}><Stat label="Inflows" value={formatMoney(inflow, true)} tone="success" /><Stat label="Outflows" value={formatMoney(outflow, true)} tone="danger" /><Stat label="Net cash flow" value={formatMoney(inflow - outflow, true)} tone={inflow >= outflow ? 'success' : 'danger'} /></View><Body secondary>These are recorded cash transactions, not changes in asset market values.</Body></Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Property" action={<StatusPill>{properties.length}</StatusPill>} />
        {properties.length === 0 ? (
          <Card><Heading size="small">No property yet</Heading><Body secondary>A Harborview starter property currently requires an $16,000 down payment. Financing still creates weekly interest and costs.</Body><EngineActionButton title="Buy $80k starter property" action={{ verb: 'property.buy', targetIds: [], parameters: { valueCents: 8_000_000, amountCents: 1_600_000, name: 'Harborview starter condo' } }} tone="accent" /></Card>
        ) : properties.map((property) => {
          const equity = property.valueCents - property.debtCents;
          return (
            <Card key={property.id}>
              <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{property.name}</Heading><Body secondary>{property.kind} · {property.occupancy} · {property.managed ? 'managed' : 'self-managed'}</Body></View><StatusPill tone={equity >= 0 ? 'success' : 'danger'}>{formatMoney(equity, true)} equity</StatusPill></View>
              <View style={styles.stats}><Stat label="Value" value={formatMoney(property.valueCents, true)} tone="legacy" /><Stat label="Debt" value={formatMoney(property.debtCents, true)} tone="danger" /><Stat label="Weekly rent" value={formatMoney(property.weeklyRentCents)} /><Stat label="Condition" value={Math.round(property.condition).toString()} /></View>
              <View style={styles.actions}>{property.occupancy !== 'tenant' ? <EngineActionButton title="Rent out" action={{ verb: 'property.rent_out', targetIds: [property.id], parameters: {} }} tone="accent" style={{ flex: 1 }} /> : <EngineActionButton title="Raise rent 5%" action={{ verb: 'property.set_rent', targetIds: [property.id], parameters: { weeklyRentCents: Math.round(property.weeklyRentCents * 1.05) } }} style={{ flex: 1 }} />}<EngineActionButton title="Renovate" action={{ verb: 'property.renovate', targetIds: [property.id], parameters: { amountCents: Math.round(property.valueCents * 0.02) } }} style={{ flex: 1 }} /><EngineActionButton title="Refinance" action={{ verb: 'property.refinance', targetIds: [property.id], parameters: {} }} style={{ flex: 1 }} /></View>
            </Card>
          );
        })}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Generated market" action={<StatusPill tone="accent">{world.economy.regime}</StatusPill>} />
        <Card>
          <View style={styles.stats}><Stat label="Market index" value={world.economy.marketIndex.toFixed(1)} /><Stat label="Policy rate" value={`${(world.economy.policyRate * 100).toFixed(1)}%`} /><Stat label="Inflation" value={`${(world.economy.inflation * 100).toFixed(1)}%`} /></View>
          <EngineActionButton title="Invest $500 in diversified fund" action={{ verb: 'markets.allocate', targetIds: [], parameters: { amountCents: 50_000 } }} tone="accent" />
        </Card>
        {Object.values(world.securities).map((security) => {
          const holding = holdings.find((item) => item.securityId === security.id);
          const value = holding ? Math.round(holding.unitsMilli * security.priceCents / 1000) : 0;
          return (
            <Card key={security.id}>
              <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{security.symbol} · {security.name}</Heading><Body secondary>{security.sector} · quality {Math.round(security.quality)} · volatility {Math.round(security.volatility)}</Body></View><StatusPill tone={holding ? 'success' : 'neutral'}>{holding ? formatMoney(value, true) : formatMoney(security.priceCents)}</StatusPill></View>
              <View style={styles.actions}><EngineActionButton title="Buy $500" action={{ verb: 'markets.buy', targetIds: [security.id], parameters: { amountCents: 50_000 } }} style={{ flex: 1 }} />{holding ? <EngineActionButton title="Sell position" action={{ verb: 'markets.sell', targetIds: [security.id], parameters: { amountCents: value } }} tone="danger" style={{ flex: 1 }} /> : null}</View>
            </Card>
          );
        })}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Liabilities" action={<StatusPill>{liabilities.length}</StatusPill>} />
        {liabilities.length === 0 ? <Card><Body secondary>No personal liabilities are recorded. Property and business debt remain attached to those assets.</Body></Card> : liabilities.map((liability) => <Card key={liability.id}><View style={styles.row}><Heading size="small">{liability.kind}</Heading><StatusPill tone="danger">{formatMoney(liability.principalCents, true)}</StatusPill></View><Body secondary>{(liability.annualRateBps / 100).toFixed(2)}% annual rate · {formatMoney(liability.weeklyPaymentCents)} weekly payment</Body></Card>)}
      </View>

      <OtherActionComposer domains={['property', 'markets', 'business', 'legal']} placeholder="Refinance a property, invest cash, sell shares, or fund a business…" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, alignItems: 'flex-start', paddingTop: 8 },
  section: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  metric: { gap: 7 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
