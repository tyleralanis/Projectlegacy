import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { LUXURY_CATALOG } from '@/content/luxuryCatalog';
import { playerAgeYears } from '@/engine/createWorld';
import { formatMoney } from '@/engine/money';
import { hasActiveLicense, licenseFor } from '@/engine/supplementalDepthBridge';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

function licenseProgress(currentWeek: number, startedWeek: number, requiredWeeks: number): number {
  return Math.max(0, Math.min(100, ((currentWeek - startedWeek) / Math.max(1, requiredWeeks)) * 100));
}

export default function LuxuryScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const age = playerAgeYears(world);
  const driver = licenseFor(world, 'driver');
  const pilot = licenseFor(world, 'private-pilot');
  const canDrive = hasActiveLicense(world, 'driver');
  const canFly = hasActiveLicense(world, 'private-pilot');
  const assets = Object.values(world.personalAssets ?? {}).filter((asset) => asset.ownerId === actor.id);
  const assetValue = assets.reduce((sum, asset) => sum + asset.valueCents, 0);
  const upkeep = assets.reduce((sum, asset) => sum + asset.weeklyUpkeepCents, 0);
  const cars = LUXURY_CATALOG.filter((item) => item.category === 'car');
  const aircraft = LUXURY_CATALOG.filter((item) => item.category === 'aircraft');
  const collectibles = LUXURY_CATALOG.filter((item) => item.category === 'collectible');
  const jewelry = LUXURY_CATALOG.filter((item) => item.category === 'jewelry');

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Money" title={age < 18 ? 'Licenses & driving' : 'Lifestyle & luxury'} subtitle={age < 18 ? 'Some adult freedom starts before adult wealth does.' : 'Cars, aircraft, collectibles, jewelry, and giving.'} />

      {assets.length > 0 ? <Card accent>
        <SectionHeader title="What you own" action={<StatusPill tone="accent">{assets.length}</StatusPill>} />
        <View style={styles.stats}><Stat label="Current value" value={formatMoney(assetValue, true)} tone="legacy" /><Stat label="Upkeep / wk" value={formatMoney(upkeep, true)} /></View>
        {assets.map((asset) => <Card key={asset.id}>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{asset.name}</Heading><Body secondary>{asset.category} · worth about {formatMoney(asset.valueCents, true)}</Body></View><StatusPill>{formatMoney(asset.weeklyUpkeepCents, true)}/wk</StatusPill></View>
          {asset.category === 'aircraft' ? <Body secondary>{asset.hiredOperator ? 'Pilot under contract.' : canFly ? 'You can fly it yourself.' : 'Grounded until you hire a pilot or earn a pilot license.'}</Body> : null}
          <View style={styles.actions}>
            {asset.category === 'aircraft' && !asset.hiredOperator ? <EngineActionButton title="Hire pilot" action={{ verb: 'luxury.hire_pilot', targetIds: [asset.id], parameters: {} }} style={styles.actionButton} /> : null}
            <EngineActionButton title="Sell" action={{ verb: 'luxury.sell_asset', targetIds: [asset.id], parameters: {} }} tone="danger" style={styles.actionButton} />
          </View>
        </Card>)}
      </Card> : null}

      {age >= 15 ? <View style={styles.section}>
        <SectionHeader title="Driving" />
        <Card>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🚗 Driver's license</Heading><Body secondary>{driver?.status === 'active' ? 'Licensed.' : driver?.status === 'training' ? 'Training is underway.' : 'Start at 15. Finish the training and reach 16.'}</Body></View><StatusPill tone={driver?.status === 'active' ? 'success' : driver?.status === 'training' ? 'accent' : 'neutral'}>{driver?.status === 'active' ? 'Licensed' : driver?.status === 'training' ? 'Training' : '$1,200'}</StatusPill></View>
          {driver?.status === 'training' ? <ProgressBar value={licenseProgress(world.calendar.week, driver.startedWeek, driver.requiredWeeks)} tone="success" /> : null}
          {!driver ? <EngineActionButton title="Start driver training · $1,200" action={{ verb: 'license.start_driver_training', targetIds: [], parameters: {} }} tone="accent" /> : null}
        </Card>
      </View> : null}

      {age >= 16 ? <View style={styles.section}>
        <SectionHeader title="Cars" />
        {!canDrive ? <Card><Heading size="small">Finish the license first</Heading><Body secondary>Cars unlock once you can legally drive.</Body></Card> : cars.filter((item) => age >= item.minimumAge).map((item) => <Card key={item.id}>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{item.name}</Heading><Body secondary>{item.note}</Body></View><StatusPill>{formatMoney(item.priceCents, true)}</StatusPill></View>
          <Body secondary>About {formatMoney(item.weeklyUpkeepCents, true)}/week to keep.</Body>
          <EngineActionButton title={`Buy · ${formatMoney(item.priceCents, true)}`} action={{ verb: 'luxury.buy_asset', targetIds: [], parameters: { catalogId: item.id } }} tone="accent" />
        </Card>)}
      </View> : null}

      {age >= 16 ? <View style={styles.section}>
        <SectionHeader title="Aviation" />
        <Card>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">✈️ Pilot license</Heading><Body secondary>{pilot?.status === 'active' ? 'Licensed.' : pilot?.status === 'training' ? 'Aviation school is underway.' : 'Start flight training now. The license can become active at 17.'}</Body></View><StatusPill tone={pilot?.status === 'active' ? 'success' : pilot?.status === 'training' ? 'accent' : 'neutral'}>{pilot?.status === 'active' ? 'Licensed' : pilot?.status === 'training' ? 'Training' : '$14K'}</StatusPill></View>
          {pilot?.status === 'training' ? <ProgressBar value={licenseProgress(world.calendar.week, pilot.startedWeek, pilot.requiredWeeks)} tone="success" /> : null}
          {!pilot ? <EngineActionButton title="Start aviation school · $14K" action={{ verb: 'license.start_pilot_training', targetIds: [], parameters: {} }} tone="accent" /> : null}
        </Card>
        {age >= 18 ? aircraft.map((item) => <Card key={item.id}>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{item.name}</Heading><Body secondary>{item.note}</Body></View><StatusPill>{formatMoney(item.priceCents, true)}</StatusPill></View>
          <Body secondary>Upkeep about {formatMoney(item.weeklyUpkeepCents, true)}/week · pilot about {formatMoney(item.pilotAnnualCostCents ?? 0, true)}/year.</Body>
          <View style={styles.actions}>
            {canFly ? <EngineActionButton title="Buy & fly" action={{ verb: 'luxury.buy_asset', targetIds: [], parameters: { catalogId: item.id, operationMode: 'self' } }} tone="accent" style={styles.actionButton} /> : null}
            <EngineActionButton title="Buy + hire pilot" action={{ verb: 'luxury.buy_asset', targetIds: [], parameters: { catalogId: item.id, operationMode: 'pilot' } }} style={styles.actionButton} />
          </View>
        </Card>) : <Card><Body secondary>Aircraft ownership opens at 18. Flight training can start earlier.</Body></Card>}
      </View> : null}

      {age >= 18 ? <View style={styles.section}>
        <SectionHeader title="Collectibles" />
        {collectibles.map((item) => <Card key={item.id}><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{item.name}</Heading><Body secondary>{item.note}</Body></View><StatusPill>{formatMoney(item.priceCents, true)}</StatusPill></View><EngineActionButton title={`Buy · ${formatMoney(item.priceCents, true)}`} action={{ verb: 'luxury.buy_asset', targetIds: [], parameters: { catalogId: item.id } }} /></Card>)}
      </View> : null}

      {age >= 18 ? <View style={styles.section}>
        <SectionHeader title="Jewelry" />
        {jewelry.map((item) => <Card key={item.id}><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{item.name}</Heading><Body secondary>{item.note}</Body></View><StatusPill>{formatMoney(item.priceCents, true)}</StatusPill></View><EngineActionButton title={`Buy · ${formatMoney(item.priceCents, true)}`} action={{ verb: 'luxury.buy_asset', targetIds: [], parameters: { catalogId: item.id } }} /></Card>)}
      </View> : null}

      {age >= 18 ? <View style={styles.section}>
        <SectionHeader title="Give" />
        <Card><Heading size="small">Charity</Heading><Body secondary>Donations help the organization and can modestly improve public and political support.</Body><View style={styles.actions}>
          {[100_000, 1_000_000, 10_000_000, 100_000_000].map((amount) => <EngineActionButton key={amount} title={`Donate ${formatMoney(amount, true)}`} action={{ verb: 'charity.donate', targetIds: [], parameters: { amountCents: amount } }} style={styles.actionButton} />)}
        </View></Card>
      </View> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: { flexGrow: 1, flexBasis: 140 },
});
