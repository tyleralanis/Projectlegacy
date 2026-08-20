import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { monthlyPropertyListings } from '@/content/lifeCatalogs';
import { WORLD_CONTENT } from '@/content/worldContent';
import { formatMoney } from '@/engine/money';
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
  const monthNumber = Math.floor(world.calendar.week / 4);

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Money" title="Property" subtitle="Browse a changing market, then actually manage what you own. Residential, multifamily, commercial, land, debt, tenants, and renovations all live here." />
      <View style={styles.segmentRow}>
        {(['browse', 'owned'] as ViewMode[]).map((item) => (
          <Pressable key={item} onPress={() => setMode(item)} style={[styles.segment, { backgroundColor: mode === item ? colors.accent : colors.secondary, borderColor: mode === item ? colors.accent : colors.border }]}><Text style={[styles.segmentText, { color: mode === item ? '#FFFFFF' : colors.text }]}>{item === 'browse' ? 'Browse market' : `Owned (${properties.length})`}</Text></Pressable>
        ))}
      </View>

      {mode === 'browse' ? <>
        <Card accent><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">🏡 {city?.name ?? 'Local'} listings</Heading><Body secondary>Inventory refreshes each simulated month. Month {monthNumber + 1} market snapshot.</Body></View><StatusPill tone="accent">{listings.length} listings</StatusPill></View></Card>
        <View style={styles.section}>
          {listings.map((listing) => {
            const down = Math.round(listing.valueCents * 0.2);
            return (
              <Card key={listing.id}>
                <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{listing.name}</Heading><Body secondary>{listing.kind} · condition {listing.condition}/100</Body></View><StatusPill tone={actor.cashCents >= down ? 'success' : 'warning'}>{formatMoney(listing.valueCents, true)}</StatusPill></View>
                <View style={styles.stats}><Stat label="20% down" value={formatMoney(down, true)} /><Stat label="Est. weekly rent" value={formatMoney(listing.weeklyRentCents, true)} /><Stat label="Condition" value={listing.condition.toString()} /></View>
                <EngineActionButton title={`Buy for ${formatMoney(listing.valueCents, true)}`} action={{ verb: 'property.buy', targetIds: [], parameters: { name: listing.name, kind: listing.kind, valueCents: listing.valueCents, weeklyRentCents: listing.weeklyRentCents, condition: listing.condition, cityId: listing.cityId } }} tone="accent" />
              </Card>
            );
          })}
        </View>
      </> : <View style={styles.section}>
        {properties.length === 0 ? <Card><Heading size="small">No property yet</Heading><Body secondary>Switch to Browse market to see what is available this month.</Body></Card> : properties.map((property) => {
          const equity = property.valueCents - property.debtCents;
          return (
            <Card key={property.id}>
              <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{property.name}</Heading><Body secondary>{property.kind} · {property.occupancy} · {property.managed ? 'professionally managed' : 'self-managed'}</Body></View><StatusPill tone={equity >= 0 ? 'success' : 'danger'}>{formatMoney(equity, true)} equity</StatusPill></View>
              <View style={styles.stats}><Stat label="Value" value={formatMoney(property.valueCents, true)} tone="legacy" /><Stat label="Debt" value={formatMoney(property.debtCents, true)} tone="danger" /><Stat label="Rent / wk" value={formatMoney(property.weeklyRentCents, true)} /><Stat label="Condition" value={Math.round(property.condition).toString()} /></View>
              <ProgressBar value={property.condition} tone={property.condition < 45 ? 'danger' : 'success'} />
              <SectionHeader title="Tenancy" />
              <View style={styles.actions}>{property.occupancy !== 'tenant' ? <EngineActionButton title="Find a tenant" action={{ verb: 'property.rent_out', targetIds: [property.id], parameters: {} }} tone="accent" style={{ flex: 1 }} /> : <><EngineActionButton title="Raise rent 5%" action={{ verb: 'property.set_rent', targetIds: [property.id], parameters: { weeklyRentCents: Math.round(property.weeklyRentCents * 1.05) } }} style={{ flex: 1 }} /><EngineActionButton title="End tenancy" action={{ verb: 'property.evict', targetIds: [property.id], parameters: {}, destructive: true }} tone="danger" style={{ flex: 1 }} /></>}</View>
              <SectionHeader title="Improve" />
              <View style={styles.actions}><EngineActionButton title="Update kitchen" action={{ verb: 'property.renovate', targetIds: [property.id], parameters: { amountCents: Math.max(1_500_000, Math.round(property.valueCents * 0.025)) } }} style={{ flex: 1 }} /><EngineActionButton title="Update bathrooms" action={{ verb: 'property.renovate', targetIds: [property.id], parameters: { amountCents: Math.max(900_000, Math.round(property.valueCents * 0.015)) } }} style={{ flex: 1 }} /><EngineActionButton title="Major renovation" action={{ verb: 'property.renovate', targetIds: [property.id], parameters: { amountCents: Math.max(3_000_000, Math.round(property.valueCents * 0.05)) } }} tone="accent" style={{ flex: 1 }} /></View>
              <SectionHeader title="Finance & management" />
              <View style={styles.actions}>{!property.managed ? <EngineActionButton title="Hire property manager" action={{ verb: 'property.manage', targetIds: [property.id], parameters: {} }} style={{ flex: 1 }} /> : null}<EngineActionButton title="Refinance" action={{ verb: 'property.refinance', targetIds: [property.id], parameters: {} }} style={{ flex: 1 }} /><EngineActionButton title="Sell property" action={{ verb: 'property.sell', targetIds: [property.id], parameters: {}, destructive: true }} tone="danger" style={{ flex: 1 }} /></View>
            </Card>
          );
        })}
      </View>}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  segmentRow: { flexDirection: 'row', gap: spacing.sm },
  segment: { flex: 1, minHeight: 44, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 },
  segmentText: { fontSize: 13, fontWeight: '800' },
});
