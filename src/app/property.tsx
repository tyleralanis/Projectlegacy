import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { OtherActionComposer } from '@/components/OtherActionComposer';
import { monthlyPropertyListings } from '@/content/lifeCatalogs';
import { WORLD_CONTENT } from '@/content/worldContent';
import { formatMoney } from '@/engine/money';
import { renovationOptionsForProperty } from '@/engine/propertyRenovations';
import { portfolioManagementFeeWeeklyCents, propertyManagerActive } from '@/engine/supplementalDepthBridge';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

type ViewMode = 'browse' | 'owned';

export default function PropertyScreen() {
  const { world } = useGame();
  const { colors } = useAppTheme();
  const [mode, setMode] = useState<ViewMode>('browse');
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const city = WORLD_CONTENT.cities.find((item) => item.id === actor.cityId);
  const properties = Object.values(world.properties).filter((property) => property.ownerId === actor.id);
  const listings = monthlyPropertyListings(world.calendar.week, actor.cityId);
  const managerActive = propertyManagerActive(world);
  const managementFee = portfolioManagementFeeWeeklyCents(world);
  const portfolioValue = properties.reduce((sum, property) => sum + property.valueCents, 0);
  const portfolioDebt = properties.reduce((sum, property) => sum + property.debtCents, 0);
  const portfolioEquity = portfolioValue - portfolioDebt;
  const occupiedRent = properties.filter((property) => property.occupancy === 'tenant').reduce((sum, property) => sum + property.weeklyRentCents, 0);
  const portfolioInterest = properties.reduce((sum, property) => sum + Math.round((property.debtCents * (world.economy.policyRate + 0.02)) / 52), 0);
  const portfolioOperating = properties.reduce((sum, property) => sum + property.weeklyCostsCents, 0);
  const portfolioNet = occupiedRent - portfolioOperating - portfolioInterest - (managerActive ? managementFee : 0);
  const vacancyCount = properties.filter((property) => property.occupancy === 'vacant' && !['land', 'residence', 'estate'].includes(property.kind)).length;
  const portfolioLtv = portfolioValue > 0 ? portfolioDebt / portfolioValue * 100 : 0;

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Money" title="Property" subtitle="Buy, rent, repair, improve, finance, manage, or sell." />
      <View style={styles.segmentRow}>
        {(['browse', 'owned'] as ViewMode[]).map((item) => (
          <Pressable key={item} onPress={() => setMode(item)} style={[styles.segment, { backgroundColor: mode === item ? colors.accent : colors.secondary, borderColor: mode === item ? colors.accent : colors.border }]}><Text style={[styles.segmentText, { color: mode === item ? '#FFFFFF' : colors.text }]}>{item === 'browse' ? 'Browse market' : `Owned (${properties.length})`}</Text></Pressable>
        ))}
      </View>

      {mode === 'browse' ? <>
        <Card accent><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🏡 {city?.name ?? 'Local'} listings</Heading><Body secondary>Inventory refreshes each simulated month.</Body></View><StatusPill tone="accent">{listings.length} listings</StatusPill></View></Card>
        <View style={styles.section}>
          {listings.map((listing) => {
            const down = Math.round(listing.valueCents * 0.2);
            const debt = listing.valueCents - down;
            const interest = Math.round((debt * (world.economy.policyRate + 0.02)) / 52);
            const operating = Math.round(listing.valueCents * 0.00024);
            const management = managerActive ? Math.round(listing.weeklyRentCents * 0.09) : 0;
            const estimatedNet = listing.weeklyRentCents - operating - interest - management;
            const grossYield = listing.valueCents > 0 ? listing.weeklyRentCents * 52 / listing.valueCents * 100 : 0;
            return (
              <Card key={listing.id}>
                <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{listing.name}</Heading><Body secondary>{listing.kind} · condition {listing.condition}/100</Body></View><StatusPill tone={actor.cashCents >= down ? 'success' : 'warning'}>{formatMoney(listing.valueCents, true)}</StatusPill></View>
                <View style={styles.stats}><Stat label="20% down" value={formatMoney(down, true)} /><Stat label="Rent / wk" value={formatMoney(listing.weeklyRentCents, true)} /><Stat label="Gross yield" value={`${grossYield.toFixed(1)}%`} /><Stat label="Est. net / wk" value={formatMoney(estimatedNet, true)} tone={estimatedNet >= 0 ? 'success' : 'danger'} /></View>
                <Body secondary>Estimate includes operating costs, current-rate interest, and management if retained.</Body>
                <EngineActionButton title={`Buy for ${formatMoney(listing.valueCents, true)}`} action={{ verb: 'property.buy', targetIds: [], parameters: { name: listing.name, kind: listing.kind, valueCents: listing.valueCents, weeklyRentCents: listing.weeklyRentCents, condition: listing.condition, cityId: listing.cityId } }} tone="accent" />
              </Card>
            );
          })}
        </View>
      </> : <View style={styles.section}>
        {properties.length > 0 ? <Card accent>
          <SectionHeader title="Portfolio" action={<StatusPill tone={portfolioNet >= 0 ? 'success' : 'warning'}>{portfolioNet >= 0 ? 'Cash-flow positive' : 'Cash-flow negative'}</StatusPill>} />
          <View style={styles.stats}><Stat label="Value" value={formatMoney(portfolioValue, true)} tone="legacy" /><Stat label="Equity" value={formatMoney(portfolioEquity, true)} tone={portfolioEquity >= 0 ? 'success' : 'danger'} /><Stat label="LTV" value={`${portfolioLtv.toFixed(0)}%`} tone={portfolioLtv >= 75 ? 'danger' : 'default'} /><Stat label="Net / wk" value={formatMoney(portfolioNet, true)} tone={portfolioNet >= 0 ? 'success' : 'danger'} /></View>
          <View style={styles.stats}><Stat label="Rent collected" value={formatMoney(occupiedRent, true)} /><Stat label="Interest" value={formatMoney(portfolioInterest, true)} /><Stat label="Operating" value={formatMoney(portfolioOperating, true)} /><Stat label="Vacancies" value={vacancyCount.toString()} tone={vacancyCount > 0 ? 'danger' : 'default'} /></View>
        </Card> : null}

        {properties.length > 0 ? <Card accent>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 3 }}><Heading size="small">Portfolio management</Heading><Body secondary>{managerActive ? `One manager covers all ${properties.length} properties.` : 'Hire one manager for the whole portfolio.'}</Body></View>
            <StatusPill tone={managerActive ? 'success' : 'neutral'}>{managerActive ? 'Managed' : 'Self-managed'}</StatusPill>
          </View>
          <View style={styles.stats}><Stat label="Properties covered" value={managerActive ? properties.length.toString() : '0'} /><Stat label="Current fee / wk" value={formatMoney(managerActive ? managementFee : 0, true)} /><Stat label="Fee model" value="9% rent" /></View>
          {managerActive
            ? <EngineActionButton title="End portfolio management" action={{ verb: 'property.end_management', targetIds: [], parameters: {} }} tone="danger" />
            : <EngineActionButton title="Hire one portfolio manager" action={{ verb: 'property.manage_portfolio', targetIds: [], parameters: {} }} tone="accent" />}
        </Card> : null}

        {properties.length === 0 ? <Card><Heading size="small">No property yet</Heading><Body secondary>Browse the market to see what is available.</Body></Card> : properties.map((property) => {
          const equity = property.valueCents - property.debtCents;
          const ltv = property.valueCents > 0 ? property.debtCents / property.valueCents * 100 : 0;
          const interest = Math.round((property.debtCents * (world.economy.policyRate + 0.02)) / 52);
          const rent = property.occupancy === 'tenant' ? property.weeklyRentCents : 0;
          const propertyManagement = managerActive && property.occupancy === 'tenant' ? Math.round(property.weeklyRentCents * 0.09) : 0;
          const net = rent - property.weeklyCostsCents - interest - propertyManagement;
          const grossYield = property.valueCents > 0 ? property.weeklyRentCents * 52 / property.valueCents * 100 : 0;
          const tenantMemory = Object.values(world.memories).find((memory) => memory.category === `Property · Tenant · ${property.id}` && memory.unresolved);
          const tenantId = tenantMemory?.participantIds.find((id) => id !== actor.id && world.characters[id]);
          const tenant = tenantId ? world.characters[tenantId] : undefined;
          const tenantRelationship = tenant ? Object.values(world.relationships).find((relationship) => relationship.characterIds.includes(actor.id) && relationship.characterIds.includes(tenant.id)) : undefined;
          const development = Object.values(world.memories).find((memory) => memory.category.startsWith(`Property · Development · ${property.id} ·`) && memory.unresolved);
          const multiCost = Math.max(10_000_000, Math.round(property.valueCents * 0.58));
          const commercialCost = Math.max(10_000_000, Math.round(property.valueCents * 0.72));
          const renovationOptions = renovationOptionsForProperty(property, world);
          return (
            <Card key={property.id}>
              <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{property.name}</Heading><Body secondary>{property.kind} · {property.occupancy} · {property.managed || managerActive ? 'professionally managed' : 'self-managed'}</Body></View><StatusPill tone={equity >= 0 ? 'success' : 'danger'}>{formatMoney(equity, true)} equity</StatusPill></View>
              <View style={styles.stats}><Stat label="Value" value={formatMoney(property.valueCents, true)} tone="legacy" /><Stat label="Debt" value={formatMoney(property.debtCents, true)} tone="danger" /><Stat label="LTV" value={`${ltv.toFixed(0)}%`} tone={ltv >= 75 ? 'danger' : 'default'} /><Stat label="Net / wk" value={formatMoney(net, true)} tone={net >= 0 ? 'success' : 'danger'} /></View>
              <View style={styles.stats}><Stat label="Rent / wk" value={formatMoney(property.weeklyRentCents, true)} /><Stat label="Gross yield" value={`${grossYield.toFixed(1)}%`} /><Stat label="Interest / wk" value={formatMoney(interest, true)} /><Stat label="Condition" value={Math.round(property.condition).toString()} /></View>
              <ProgressBar value={property.condition} tone={property.condition < 45 ? 'danger' : 'success'} />

              {development ? <Card accent><View style={styles.row}><Heading size="small">🏗️ Under development</Heading><StatusPill tone="warning">Construction</StatusPill></View><Body secondary>{development.narrative}</Body></Card> : null}

              {tenant ? <Card accent>
                <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">Tenant · {tenant.firstName} {tenant.lastName}</Heading><Body secondary>Rent, condition, and repairs affect whether they stay.</Body></View><StatusPill tone={(tenantRelationship?.resentment ?? 0) >= 50 ? 'warning' : 'success'}>{(tenantRelationship?.resentment ?? 0) >= 50 ? 'Friction' : 'Stable'}</StatusPill></View>
                <Body secondary>Trust {Math.round(tenantRelationship?.trust ?? 0)} · respect {Math.round(tenantRelationship?.respect ?? 0)} · resentment {Math.round(tenantRelationship?.resentment ?? 0)}</Body>
              </Card> : property.occupancy === 'vacant' && managerActive && property.kind !== 'land' ? <Card accent><Heading size="small">Manager is handling the vacancy</Heading><Body secondary>They will screen and place a viable tenant on recurring checks.</Body></Card> : null}

              {!development && property.kind === 'land' ? <View style={styles.section}>
                <SectionHeader title="Develop the land" />
                <Body secondary>Ground-up development takes roughly a year.</Body>
                <View style={styles.actions}>
                  <EngineActionButton title={`Build multifamily · ${formatMoney(multiCost, true)}`} action={{ verb: 'property.develop', targetIds: [property.id], parameters: { targetKind: 'multifamily', amountCents: multiCost } }} tone="accent" style={styles.actionButton} />
                  <EngineActionButton title={`Build commercial · ${formatMoney(commercialCost, true)}`} action={{ verb: 'property.develop', targetIds: [property.id], parameters: { targetKind: 'commercial', amountCents: commercialCost } }} style={styles.actionButton} />
                </View>
              </View> : null}

              {!development ? <>
                <SectionHeader title="Tenancy & pricing" />
                <View style={styles.actions}>
                  {property.occupancy !== 'tenant' && property.kind !== 'land' && !managerActive ? <EngineActionButton title="Screen a tenant" action={{ verb: 'property.screen_tenant', targetIds: [property.id], parameters: {} }} tone="accent" style={styles.actionButton} /> : null}
                  {property.occupancy === 'tenant' ? <>
                    <EngineActionButton title="Lower rent 5%" action={{ verb: 'property.set_rent', targetIds: [property.id], parameters: { weeklyRentCents: Math.round(property.weeklyRentCents * 0.95) } }} style={styles.actionButton} />
                    <EngineActionButton title="Raise rent 5%" action={{ verb: 'property.set_rent', targetIds: [property.id], parameters: { weeklyRentCents: Math.round(property.weeklyRentCents * 1.05) } }} style={styles.actionButton} />
                    <EngineActionButton title="Raise rent 10%" action={{ verb: 'property.set_rent', targetIds: [property.id], parameters: { weeklyRentCents: Math.round(property.weeklyRentCents * 1.1) } }} style={styles.actionButton} />
                    <EngineActionButton title="End tenancy" action={{ verb: 'property.evict', targetIds: [property.id], parameters: {}, destructive: true }} tone="danger" style={styles.actionButton} />
                  </> : null}
                </View>

                <SectionHeader title="Repairs & improvements" />
                <View style={styles.actions}>
                  <EngineActionButton title="Repair what needs it" action={{ verb: 'property.repair', targetIds: [property.id], parameters: {} }} tone="accent" style={styles.actionButton} />
                  {renovationOptions.map((option) => <EngineActionButton key={option.id} title={`${option.label} · ${formatMoney(option.costCents, true)}`} action={{ verb: 'property.renovate', targetIds: [property.id], parameters: { renovationId: option.id, amountCents: option.costCents } }} style={styles.actionButton} />)}
                </View>

                <SectionHeader title="Finance" />
                <View style={styles.actions}><EngineActionButton title="Cash-out refinance" action={{ verb: 'property.refinance', targetIds: [property.id], parameters: {} }} style={styles.actionButton} /><EngineActionButton title="Sell property" action={{ verb: 'property.sell', targetIds: [property.id], parameters: {}, destructive: true }} tone="danger" style={styles.actionButton} /></View>
              </> : null}
            </Card>
          );
        })}
        <OtherActionComposer domains={['property']} placeholder="Something else with a property…" />
      </View>}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: { flexGrow: 1, flexBasis: 140 },
  segmentRow: { flexDirection: 'row', gap: spacing.sm },
  segment: { flex: 1, minHeight: 44, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 },
  segmentText: { fontSize: 13, fontWeight: '800' },
});
