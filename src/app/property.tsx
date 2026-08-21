import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { MoneyAmountPicker } from '@/components/MoneyAmountPicker';
import { SubviewHeader } from '@/components/MenuTile';
import { OtherActionComposer } from '@/components/OtherActionComposer';
import { monthlyPropertyListings } from '@/content/lifeCatalogs';
import { WORLD_CONTENT } from '@/content/worldContent';
import { formatMoney } from '@/engine/money';
import { portfolioManagementFeeWeeklyCents, propertyManagerActive } from '@/engine/supplementalDepthBridge';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

type ViewMode = 'browse' | 'owned';

export default function PropertyScreen() {
  const { world } = useGame();
  const { colors } = useAppTheme();
  const [mode, setMode] = useState<ViewMode>('browse');
  const [principalAmounts, setPrincipalAmounts] = useState<Record<string, number>>({});
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
      <SubviewHeader eyebrow="Money" title="Property" subtitle="Real estate is a leveraged cash-flow business now. Value, debt, occupancy, rent, condition, tenants, rates, management, development, and vacancies all have to work together." />
      <View style={styles.segmentRow}>
        {(['browse', 'owned'] as ViewMode[]).map((item) => (
          <Pressable key={item} onPress={() => setMode(item)} style={[styles.segment, { backgroundColor: mode === item ? colors.accent : colors.secondary, borderColor: mode === item ? colors.accent : colors.border }]}><Text style={[styles.segmentText, { color: mode === item ? '#FFFFFF' : colors.text }]}>{item === 'browse' ? 'Browse market' : `Owned (${properties.length})`}</Text></Pressable>
        ))}
      </View>

      {mode === 'browse' ? <>
        <Card accent><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🏡 {city?.name ?? 'Local'} listings</Heading><Body secondary>Inventory refreshes each simulated month. Rates, rent potential, down payment, and condition matter more than the sticker price alone.</Body></View><StatusPill tone="accent">{listings.length} listings</StatusPill></View></Card>
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
                <Body secondary>Estimated net includes modeled operating costs, current-rate mortgage interest, and your portfolio-management fee if retained. Vacancy and future repairs can still make reality worse.</Body>
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
          <Body secondary>Equity is not cash flow. A portfolio can make you wealthy on paper while rates, vacancies, repairs, and management consume the week-to-week economics.</Body>
        </Card> : null}

        {properties.length > 0 ? <Card accent>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 3 }}><Heading size="small">Portfolio management</Heading><Body secondary>{managerActive ? `One manager covers all ${properties.length} properties, routine maintenance, screening, and ordinary vacancy turnover. New acquisitions join automatically.` : 'Hire one manager for the entire portfolio instead of paying for and managing a separate relationship on every property.'}</Body></View>
            <StatusPill tone={managerActive ? 'success' : 'neutral'}>{managerActive ? 'Managed' : 'Self-managed'}</StatusPill>
          </View>
          <View style={styles.stats}><Stat label="Properties covered" value={managerActive ? properties.length.toString() : '0'} /><Stat label="Current fee / wk" value={formatMoney(managerActive ? managementFee : 0, true)} /><Stat label="Fee model" value="9% rent" /></View>
          <Body secondary>The manager will try to fill viable vacancies on recurring monthly checks. Major financing, rent policy, development, purchases, and sales still remain owner decisions.</Body>
          {managerActive
            ? <EngineActionButton title="End portfolio management" action={{ verb: 'property.end_management', targetIds: [], parameters: {} }} tone="danger" />
            : <EngineActionButton title="Hire one portfolio manager" action={{ verb: 'property.manage_portfolio', targetIds: [], parameters: {} }} tone="accent" />}
        </Card> : null}

        {properties.length === 0 ? <Card><Heading size="small">No property yet</Heading><Body secondary>Switch to Browse market to see what is available this month.</Body></Card> : properties.map((property) => {
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
          const maxPrincipalPayment = Math.min(Math.max(0, actor.cashCents), Math.max(0, property.debtCents));
          const defaultPrincipalPayment = maxPrincipalPayment > 0 ? Math.min(maxPrincipalPayment, Math.max(10_000, Math.round(maxPrincipalPayment * 0.25))) : 0;
          const selectedPrincipalPayment = Math.min(maxPrincipalPayment, principalAmounts[property.id] && principalAmounts[property.id] > 0 ? principalAmounts[property.id] : defaultPrincipalPayment);
          return (
            <Card key={property.id}>
              <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{property.name}</Heading><Body secondary>{property.kind} · {property.occupancy} · {property.managed || managerActive ? 'professionally managed' : 'self-managed'}</Body></View><StatusPill tone={equity >= 0 ? 'success' : 'danger'}>{formatMoney(equity, true)} equity</StatusPill></View>
              <View style={styles.stats}><Stat label="Value" value={formatMoney(property.valueCents, true)} tone="legacy" /><Stat label="Debt" value={formatMoney(property.debtCents, true)} tone="danger" /><Stat label="LTV" value={`${ltv.toFixed(0)}%`} tone={ltv >= 75 ? 'danger' : 'default'} /><Stat label="Net / wk" value={formatMoney(net, true)} tone={net >= 0 ? 'success' : 'danger'} /></View>
              <View style={styles.stats}><Stat label="Rent / wk" value={formatMoney(property.weeklyRentCents, true)} /><Stat label="Gross yield" value={`${grossYield.toFixed(1)}%`} /><Stat label="Interest / wk" value={formatMoney(interest, true)} /><Stat label="Condition" value={Math.round(property.condition).toString()} /></View>
              <ProgressBar value={property.condition} tone={property.condition < 45 ? 'danger' : 'success'} />

              {development ? <Card accent><View style={styles.row}><Heading size="small">🏗️ Under development</Heading><StatusPill tone="warning">Construction</StatusPill></View><Body secondary>{development.narrative}</Body></Card> : null}

              {tenant ? <Card accent>
                <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">Tenant · {tenant.firstName} {tenant.lastName}</Heading><Body secondary>Rent is backed by a real relationship now. Condition, price, repairs, and accumulated friction can change whether the lease survives.</Body></View><StatusPill tone={(tenantRelationship?.resentment ?? 0) >= 50 ? 'warning' : 'success'}>{(tenantRelationship?.resentment ?? 0) >= 50 ? 'Friction' : 'Stable'}</StatusPill></View>
                <Body secondary>Trust {Math.round(tenantRelationship?.trust ?? 0)} · respect {Math.round(tenantRelationship?.respect ?? 0)} · resentment {Math.round(tenantRelationship?.resentment ?? 0)}</Body>
              </Card> : property.occupancy === 'vacant' && managerActive && property.kind !== 'land' ? <Card accent><Heading size="small">Manager is handling the vacancy</Heading><Body secondary>The portfolio manager will screen and place a viable tenant on recurring monthly checks. You can still change rent, repair the unit, sell it, or end management while it is vacant.</Body></Card> : null}

              {!development && property.kind === 'land' ? <View style={styles.section}>
                <SectionHeader title="Develop the land" />
                <Body secondary>Ground-up development ties up cash, creates carrying costs, and takes roughly a year before leasing can begin.</Body>
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
                {property.occupancy === 'tenant' ? <Body secondary>Rent increases are no longer free yield. Larger jumps can reduce trust, create resentment, or push the tenant into a real vacancy decision.</Body> : null}

                <SectionHeader title="Condition & improvement" />
                <View style={styles.actions}>
                  <EngineActionButton title="Repair what needs it" action={{ verb: 'property.repair', targetIds: [property.id], parameters: {} }} tone="accent" style={styles.actionButton} />
                  <EngineActionButton title="Update kitchen" action={{ verb: 'property.renovate', targetIds: [property.id], parameters: { amountCents: Math.max(1_500_000, Math.round(property.valueCents * 0.025)) } }} style={styles.actionButton} />
                  <EngineActionButton title="Major renovation" action={{ verb: 'property.renovate', targetIds: [property.id], parameters: { amountCents: Math.max(3_000_000, Math.round(property.valueCents * 0.05)) } }} style={styles.actionButton} />
                </View>

                <SectionHeader title="Finance" />
                <Body secondary>Refinancing depends on current rates, condition, leverage, and closing costs. You can also pay any amount directly toward principal or clear the mortgage completely when liquid cash allows it.</Body>
                {property.debtCents > 0 ? <>
                  <MoneyAmountPicker
                    maxCents={maxPrincipalPayment}
                    valueCents={selectedPrincipalPayment}
                    onChange={(amountCents) => setPrincipalAmounts((current) => ({ ...current, [property.id]: amountCents }))}
                    label="Principal payment"
                    remainingLabel="Cash after payment"
                  />
                  <View style={styles.actions}>
                    {selectedPrincipalPayment > 0 ? <EngineActionButton title={`Pay ${formatMoney(selectedPrincipalPayment, true)} principal`} action={{ verb: 'property.pay_principal', targetIds: [property.id], parameters: { amountCents: selectedPrincipalPayment } }} tone="accent" style={styles.actionButton} /> : null}
                    {actor.cashCents >= property.debtCents ? <EngineActionButton title={`Pay off · ${formatMoney(property.debtCents, true)}`} action={{ verb: 'property.pay_principal', targetIds: [property.id], parameters: { amountCents: property.debtCents } }} style={styles.actionButton} /> : null}
                  </View>
                </> : <Body secondary>This property is debt-free. There is no mortgage balance to pay.</Body>}
                <View style={styles.actions}><EngineActionButton title="Cash-out refinance" action={{ verb: 'property.refinance', targetIds: [property.id], parameters: {} }} style={styles.actionButton} /><EngineActionButton title="Sell property" action={{ verb: 'property.sell', targetIds: [property.id], parameters: {}, destructive: true }} tone="danger" style={styles.actionButton} /></View>
              </> : null}
            </Card>
          );
        })}
        <OtherActionComposer domains={['property']} placeholder="Something else with a property, portfolio manager, rent, mortgage payoff, or development…" />
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
