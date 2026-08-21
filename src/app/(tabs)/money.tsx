import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { MenuTile } from '@/components/MenuTile';
import { OtherActionComposer } from '@/components/OtherActionComposer';
import { playerAgeYears } from '@/engine/createWorld';
import { lifestyleProfile } from '@/engine/lifeSystemsDepth';
import { formatMoney, holdingValueCents, netWorthCents, personalAssetValueCents } from '@/engine/money';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Eyebrow, Heading, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

const lifestyles = [
  { id: 'frugal', label: 'Frugal', weeklyCostCents: 0 },
  { id: 'comfortable', label: 'Comfortable', weeklyCostCents: 35_000 },
  { id: 'luxury', label: 'Luxury', weeklyCostCents: 150_000 },
  { id: 'opulent', label: 'Opulent', weeklyCostCents: 600_000 },
] as const;

export default function MoneyScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const age = playerAgeYears(world);
  const properties = Object.values(world.properties).filter((property) => property.ownerId === actor.id);
  const liabilities = Object.values(world.liabilities).filter((liability) => liability.debtorId === actor.id);
  const worth = netWorthCents(world);
  const invested = holdingValueCents(world, actor.id);
  const personalAssets = personalAssetValueCents(world, actor.id);
  const assetCount = Object.values(world.personalAssets ?? {}).filter((asset) => asset.ownerId === actor.id).length;
  const retained = Object.values(world.organizations).filter((organization) => organization.kind === 'professional' && organization.memberIds.includes(actor.id));
  const recent = world.transactions.filter((transaction) => transaction.week > world.calendar.week - 52);
  const inflow = recent.filter((transaction) => transaction.amountCents > 0).reduce((total, transaction) => total + transaction.amountCents, 0);
  const outflow = recent.filter((transaction) => transaction.amountCents < 0).reduce((total, transaction) => total - transaction.amountCents, 0);
  const parents = actor.parentIds.map((id) => world.characters[id]).filter((person) => person?.isAlive);
  const familyCash = parents.reduce((total, person) => total + Math.max(0, person.cashCents), 0);
  const familyTone = familyCash >= 25_000_000 ? 'Comfortable' : familyCash >= 5_000_000 ? 'Stable' : familyCash >= 1_000_000 ? 'Tight' : 'Strained';
  const lifestyle = lifestyleProfile(world);
  const familyOffice = retained.find((organization) => /family office/i.test(organization.name));

  if (age < 14) {
    return (
      <AppScreen>
        <View style={styles.header}><Eyebrow>MONEY IS MOSTLY A PARENT PROBLEM</Eyebrow><Heading size="large">Money</Heading><Body secondary>Your household still controls most of the money.</Body></View>
        <Card accent><View style={styles.stats}><Stat label="Your cash" value={formatMoney(actor.cashCents, true)} /><Stat label="Family situation" value={familyTone} tone={familyTone === 'Strained' ? 'danger' : familyTone === 'Comfortable' ? 'success' : 'default'} /><Stat label="Parents around" value={parents.length.toString()} /></View></Card>
        <Card><Heading size="small">🏡 The household matters</Heading><Body secondary>Parents earn, spend, and deal with economic pressure in the background.</Body></Card>
        <Card><Heading size="small">🪙 Your money comes later</Heading><Body secondary>Teen work and gifts come first. Investing and property wait until adulthood.</Body></Card>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <View style={styles.header}><Eyebrow>{age < 18 ? 'YOUR FIRST MONEY' : 'MONEY'}</Eyebrow><Heading size="large">Money</Heading><Body secondary>{age < 18 ? 'Earn, save, and build some independence.' : 'Cash, assets, debt, and the way you choose to live.'}</Body></View>

      <Card accent>
        <View style={styles.stats}><Stat label="Cash" value={formatMoney(actor.cashCents, true)} tone={actor.cashCents < 0 ? 'danger' : 'default'} /><Stat label="Net worth" value={formatMoney(worth, true)} tone="legacy" /><Stat label="Invested" value={formatMoney(invested, true)} /><Stat label="Personal assets" value={formatMoney(personalAssets, true)} /><Stat label="Debt" value={formatMoney(liabilities.reduce((sum, item) => sum + item.principalCents, 0), true)} tone="danger" /></View>
      </Card>

      {age >= 15 ? <MenuTile icon={age < 18 ? '🚗' : '✈️'} title={age < 18 ? 'Licenses & cars' : 'Lifestyle & luxury'} subtitle={age < 18 ? 'Driver training, cars, and aviation school.' : 'Cars, planes, collectibles, jewelry, and charitable giving.'} route="/luxury" badge={assetCount > 0 ? `${assetCount} owned` : age < 18 ? 'Start here' : 'Browse'} /> : null}

      {age >= 18 ? <>
        <MenuTile icon="📈" title="Investing" subtitle="Public markets, private deals, and professional management." route="/investing" badge={formatMoney(invested, true)} />
        <MenuTile icon="🏠" title="Property" subtitle="Homes, rentals, commercial property, debt, managers, and development." route="/property" badge={`${properties.length} owned`} />
        <MenuTile icon="🧑‍💼" title="Your team" subtitle="Wealth manager, attorney, tax advisor, and family office." route="/advisors" badge={familyOffice ? 'Family office' : `${retained.length} retained`} />

        <View style={styles.section}>
          <SectionHeader title="How are you living?" action={<StatusPill tone={lifestyle.posture === 'opulent' ? 'warning' : lifestyle.posture === 'frugal' ? 'success' : 'accent'}>{lifestyle.label}</StatusPill>} />
          <Card>
            <Body secondary>Extra lifestyle spend: {formatMoney(lifestyle.weeklyCostCents, true)}/week.</Body>
            <View style={styles.actions}>{lifestyles.map((option) => <EngineActionButton key={option.id} title={`${option.label}${option.weeklyCostCents > 0 ? ` · ${formatMoney(option.weeklyCostCents, true)}/wk` : ''}`} action={{ verb: 'wealth.set_lifestyle', targetIds: [], parameters: { posture: option.id } }} tone={lifestyle.posture === option.id ? 'accent' : 'neutral'} style={styles.actionButton} />)}</View>
          </Card>
        </View>
      </> : <Card><Heading size="small">Adult finance is still locked</Heading><Body secondary>Property, investing, borrowing, and professional advisors open at 18.</Body><StatusPill tone="accent">{18 - age} year{18 - age === 1 ? '' : 's'} to go</StatusPill></Card>}

      <View style={styles.section}>
        <SectionHeader title="Last 52 weeks" action={<StatusPill tone={inflow >= outflow ? 'success' : 'warning'}>{inflow >= outflow ? 'Cash positive' : 'Cash negative'}</StatusPill>} />
        <Card><View style={styles.stats}><Stat label="Inflows" value={formatMoney(inflow, true)} tone="success" /><Stat label="Outflows" value={formatMoney(outflow, true)} tone="danger" /><Stat label="Net" value={formatMoney(inflow - outflow, true)} tone={inflow >= outflow ? 'success' : 'danger'} /></View></Card>
      </View>

      {age >= 18 ? <View style={styles.section}>
        <SectionHeader title="Personal liabilities" action={<StatusPill>{liabilities.length}</StatusPill>} />
        {liabilities.length === 0 ? <Card><Body secondary>No personal liabilities recorded.</Body></Card> : liabilities.map((liability) => <Card key={liability.id}><View style={styles.row}><Heading size="small">{liability.kind}</Heading><StatusPill tone="danger">{formatMoney(liability.principalCents, true)}</StatusPill></View><Body secondary>{(liability.annualRateBps / 100).toFixed(2)}% annual rate · {formatMoney(liability.weeklyPaymentCents)} weekly payment</Body></Card>)}
      </View> : null}

      {age >= 18 ? <OtherActionComposer domains={['property', 'markets', 'business', 'legal', 'organization']} placeholder="Something else with money…" /> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4, paddingTop: 8 },
  section: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: { flexGrow: 1, flexBasis: 140 },
});
