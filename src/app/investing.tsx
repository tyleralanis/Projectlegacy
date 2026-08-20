import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { competency, effectiveInvestingCompetence } from '@/engine/competencies';
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
  const privateDealMemory = Object.values(world.memories).find((memory) => memory.category === 'Opportunity · Private deal flow' && memory.participantIds.includes(actor.id));
  const investingSkill = competency(world, actor.id, 'investing');
  const financeSkill = competency(world, actor.id, 'finance');
  const effectiveSkill = effectiveInvestingCompetence(world, actor.id);
  const privateHoldings = holdings.filter((holding) => world.securities[holding.securityId]?.sector === 'Private Markets');
  const publicSecurities = Object.values(world.securities).filter((security) => security.sector !== 'Private Markets');

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Money" title="Investing" subtitle="Capital allocation is a skill, a network, a temperament, and eventually an institution. Public markets are only the beginning once wealth and relationships create access." />
      <Card accent>
        <View style={styles.stats}><Stat label="Cash" value={formatMoney(actor.cashCents, true)} /><Stat label="Invested" value={formatMoney(invested, true)} tone="legacy" /><Stat label="Investing skill" value={Math.round(investingSkill).toString()} /><Stat label="Decision quality" value={Math.round(effectiveSkill).toString()} /></View>
        <View style={styles.stats}><Stat label="Finance" value={Math.round(financeSkill).toString()} /><Stat label="Market" value={world.economy.marketIndex.toFixed(1)} /><Stat label="Regime" value={world.economy.regime} /><Stat label="Policy rate" value={`${(world.economy.policyRate * 100).toFixed(1)}%`} /></View>
        <Body secondary>Inflation {(world.economy.inflation * 100).toFixed(1)}%. Research and actual investing build competence over time. A credential or large balance does not automatically make the character a good allocator.</Body>
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

      {privateDealMemory ? <View style={styles.section}>
        <SectionHeader title="Private market access" action={<StatusPill tone={privateDealMemory.unresolved ? 'legacy' : 'success'}>{privateDealMemory.unresolved ? 'Deal open' : 'Network active'}</StatusPill>} />
        <Card accent>
          <Heading size="small">Access came from people, not a menu unlock</Heading>
          <Body secondary>{privateDealMemory.narrative}</Body>
          {privateDealMemory.unresolved ? <View style={styles.actions}><EngineActionButton title="Invest $25,000" action={{ verb: 'markets.private_deal', targetIds: [], parameters: { amountCents: 2_500_000 } }} tone="accent" style={styles.smallButton} /><EngineActionButton title="Invest $100,000" action={{ verb: 'markets.private_deal', targetIds: [], parameters: { amountCents: 10_000_000 } }} style={styles.smallButton} /></View> : null}
        </Card>
        {privateHoldings.map((holding) => {
          const security = world.securities[holding.securityId];
          const value = Math.round(holding.unitsMilli * security.priceCents / 1000);
          return <Card key={holding.id}><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{security.name}</Heading><Body secondary>Private Markets · illiquid relationship-driven position</Body></View><StatusPill tone="legacy">{formatMoney(value, true)}</StatusPill></View><Body secondary>Quality {Math.round(security.quality)} · risk {Math.round(security.volatility)}. Private access increases the universe of things you can own; it does not remove the possibility that the deal is bad.</Body></Card>;
        })}
      </View> : null}

      <View style={styles.section}>
        <SectionHeader title="Quick allocation" />
        <Card><Heading size="small">Broad market fund</Heading><Body secondary>A simple diversified allocation when you do not want every dollar to depend on your stock-picking skill.</Body><View style={styles.actions}><EngineActionButton title="Invest $500" action={{ verb: 'markets.allocate', targetIds: [], parameters: { amountCents: 50_000 } }} tone="accent" style={{ flex: 1 }} /><EngineActionButton title="Invest $5,000" action={{ verb: 'markets.allocate', targetIds: [], parameters: { amountCents: 500_000 } }} tone="accent" style={{ flex: 1 }} /></View></Card>
        <Card><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🧑‍💼 Wealth manager</Heading><Body secondary>{hasManager ? 'Professional help now reduces some of the administrative burden of wealth. You still own the decisions and the outcome.' : 'Always available to ask for; not always affordable. First-year retainer is $48,000.'}</Body></View><StatusPill tone={hasManager ? 'success' : 'neutral'}>{hasManager ? 'Retained' : '$48k/yr'}</StatusPill></View>{!hasManager ? <EngineActionButton title="Hire wealth manager" action={{ verb: 'markets.hire_wealth_manager', targetIds: [], parameters: { amountCents: 4_800_000 } }} tone="accent" /> : null}</Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Public market" action={<StatusPill>{publicSecurities.length}</StatusPill>} />
        {publicSecurities.map((security) => {
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