import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { formatMoney, holdingValueCents } from '@/engine/money';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

export default function InvestingScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const holdings = Object.values(world.holdings).filter((holding) => holding.ownerId === actor.id);
  const invested = holdingValueCents(world, actor.id);
  const hasManager = Object.values(world.organizations).some((organization) => organization.kind === 'professional' && organization.memberIds.includes(actor.id) && organization.name.toLowerCase().includes('wealth manager'));

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Money" title="Investing" subtitle="Markets move whether you watch them or not. Build positions yourself or eventually pay someone to help manage the mess." />
      <Card accent>
        <View style={styles.stats}><Stat label="Cash" value={formatMoney(actor.cashCents, true)} /><Stat label="Invested" value={formatMoney(invested, true)} tone="legacy" /><Stat label="Market" value={world.economy.marketIndex.toFixed(1)} /><Stat label="Regime" value={world.economy.regime} /></View>
        <Body secondary>Policy rate {(world.economy.policyRate * 100).toFixed(1)}% · inflation {(world.economy.inflation * 100).toFixed(1)}%. No fixed historical price path means there is no guaranteed memorized strategy.</Body>
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Quick allocation" />
        <Card><Heading size="small">Broad market fund</Heading><Body secondary>A simple diversified allocation when you do not want to pick individual companies.</Body><View style={styles.actions}><EngineActionButton title="Invest $500" action={{ verb: 'markets.allocate', targetIds: [], parameters: { amountCents: 50_000 } }} tone="accent" style={{ flex: 1 }} /><EngineActionButton title="Invest $5,000" action={{ verb: 'markets.allocate', targetIds: [], parameters: { amountCents: 500_000 } }} tone="accent" style={{ flex: 1 }} /></View></Card>
        <Card><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🧑‍💼 Wealth manager</Heading><Body secondary>{hasManager ? 'You already have professional portfolio help.' : 'Always available to ask for; not always affordable. First-year retainer is $48,000.'}</Body></View><StatusPill tone={hasManager ? 'success' : 'neutral'}>{hasManager ? 'Retained' : '$48k/yr'}</StatusPill></View>{!hasManager ? <EngineActionButton title="Hire wealth manager" action={{ verb: 'markets.hire_wealth_manager', targetIds: [], parameters: { amountCents: 4_800_000 } }} tone="accent" /> : null}</Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Public market" action={<StatusPill>{Object.keys(world.securities).length}</StatusPill>} />
        {Object.values(world.securities).map((security) => {
          const holding = holdings.find((item) => item.securityId === security.id);
          const value = holding ? Math.round(holding.unitsMilli * security.priceCents / 1000) : 0;
          return (
            <Card key={security.id}>
              <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{security.symbol} · {security.name}</Heading><Body secondary>{security.sector} · quality {Math.round(security.quality)} · volatility {Math.round(security.volatility)}</Body></View><StatusPill tone={holding ? 'success' : 'neutral'}>{holding ? formatMoney(value, true) : formatMoney(security.priceCents)}</StatusPill></View>
              <Body secondary>Dividend yield {(security.dividendYieldBps / 100).toFixed(2)}% · current price {formatMoney(security.priceCents)}.</Body>
              <View style={styles.actions}><EngineActionButton title="Buy $500" action={{ verb: 'markets.buy', targetIds: [security.id], parameters: { amountCents: 50_000 } }} style={{ flex: 1 }} /><EngineActionButton title="Buy $5,000" action={{ verb: 'markets.buy', targetIds: [security.id], parameters: { amountCents: 500_000 } }} style={{ flex: 1 }} />{holding ? <EngineActionButton title="Sell position" action={{ verb: 'markets.sell', targetIds: [security.id], parameters: { amountCents: value } }} tone="danger" style={{ flex: 1 }} /> : null}</View>
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
