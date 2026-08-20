import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { formatMoney, holdingValueCents } from '@/engine/money';
import { getTrackMemory } from '@/engine/trackDepth';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

const strategies = [
  { id: 'index', label: 'Index', detail: 'Broad diversification and low decision load.' },
  { id: 'value', label: 'Value', detail: 'Favor quality and price discipline.' },
  { id: 'growth', label: 'Growth', detail: 'Accept more volatility for stronger upside.' },
  { id: 'income', label: 'Income', detail: 'Prioritize distributions and steadier cash yield.' },
  { id: 'concentrated', label: 'Concentrated', detail: 'Let a few researched ideas matter more.' },
  { id: 'speculative', label: 'Speculative', detail: 'Accept major drawdown risk for asymmetric upside.' },
] as const;

export default function InvestingScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const holdings = Object.values(world.holdings).filter((holding) => holding.ownerId === actor.id);
  const invested = holdingValueCents(world, actor.id);
  const hasManager = Object.values(world.organizations).some((organization) => organization.kind === 'professional' && organization.memberIds.includes(actor.id) && organization.name.toLowerCase().includes('wealth manager'));
  const strategyMemory = getTrackMemory(world, 'Track · Investing strategy');
  const strategyId = strategyMemory?.split(':')[0];
  const strategy = strategies.find((item) => item.id === strategyId);
  const rebalanceMemory = getTrackMemory(world, 'Investing · Last rebalance');

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Money" title="Investing" subtitle="A portfolio can be an entire life path now: build a philosophy, research companies, concentrate or diversify, change your mind, and live with what the market does afterward." />
      <Card accent>
        <View style={styles.stats}><Stat label="Cash" value={formatMoney(actor.cashCents, true)} /><Stat label="Invested" value={formatMoney(invested, true)} tone="legacy" /><Stat label="Market" value={world.economy.marketIndex.toFixed(1)} /><Stat label="Regime" value={world.economy.regime} /></View>
        <Body secondary>Policy rate {(world.economy.policyRate * 100).toFixed(1)}% · inflation {(world.economy.inflation * 100).toFixed(1)}%. No fixed historical price path means there is no guaranteed memorized strategy.</Body>
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Your investing philosophy" action={<StatusPill tone={strategy ? 'accent' : 'neutral'}>{strategy?.label ?? 'Not chosen'}</StatusPill>} />
        <Card>
          <Body secondary>{strategy ? strategyMemory?.slice((strategyId?.length ?? 0) + 1) : 'Choose the kind of investor this character is trying to be. It does not automate guaranteed returns; it gives future decisions a coherent strategy and adds long-term identity to the track.'}</Body>
          <View style={styles.actions}>
            {strategies.map((option) => <EngineActionButton key={option.id} title={option.label} action={{ verb: 'markets.set_strategy', targetIds: [], parameters: { strategy: option.id } }} tone={strategyId === option.id ? 'accent' : 'neutral'} style={styles.smallButton} />)}
          </View>
          {holdings.length >= 2 ? <EngineActionButton title="Rebalance current positions" action={{ verb: 'markets.rebalance', targetIds: [], parameters: {} }} tone="accent" /> : null}
          {rebalanceMemory ? <Body secondary>{rebalanceMemory}</Body> : null}
        </Card>
      </View>

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
          const thesis = getTrackMemory(world, `Investing · ${security.symbol} thesis`);
          return (
            <Card key={security.id}>
              <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{security.symbol} · {security.name}</Heading><Body secondary>{security.sector} · quality {Math.round(security.quality)} · volatility {Math.round(security.volatility)}</Body></View><StatusPill tone={holding ? 'success' : 'neutral'}>{holding ? formatMoney(value, true) : formatMoney(security.priceCents)}</StatusPill></View>
              <Body secondary>Dividend yield {(security.dividendYieldBps / 100).toFixed(2)}% · current price {formatMoney(security.priceCents)}.</Body>
              {thesis ? <Card accent><Heading size="small">Your current thesis</Heading><Body secondary>{thesis}</Body></Card> : null}
              <View style={styles.actions}>
                <EngineActionButton title="Research" action={{ verb: 'markets.research', targetIds: [security.id], parameters: {} }} tone="accent" style={styles.smallButton} />
                <EngineActionButton title="Buy $500" action={{ verb: 'markets.buy', targetIds: [security.id], parameters: { amountCents: 50_000 } }} style={styles.smallButton} />
                <EngineActionButton title="Buy $5,000" action={{ verb: 'markets.buy', targetIds: [security.id], parameters: { amountCents: 500_000 } }} style={styles.smallButton} />
                {holding ? <EngineActionButton title="Sell position" action={{ verb: 'markets.sell', targetIds: [security.id], parameters: { amountCents: value } }} tone="danger" style={styles.smallButton} /> : null}
              </View>
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
  smallButton: { flexGrow: 1, flexBasis: 120 },
});
