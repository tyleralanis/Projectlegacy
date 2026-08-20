import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { WORLD_CONTENT } from '@/content/worldContent';
import { formatMoney } from '@/engine/money';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

export default function MoveScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const currentCity = WORLD_CONTENT.cities.find((city) => city.id === actor.cityId);
  const currentCountry = WORLD_CONTENT.countries.find((country) => country.id === world.activeCountryId);
  const domestic = WORLD_CONTENT.cities.filter((city) => city.countryId === world.activeCountryId && city.id !== actor.cityId);
  const international = WORLD_CONTENT.cities.filter((city) => city.countryId !== world.activeCountryId);

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Life" title="Move" subtitle="Cities change jobs, housing, costs, and networks. Crossing a border is a much bigger reset than moving across town." />
      <Card accent><SectionHeader title="Home base" /><View style={styles.stats}><Stat label="City" value={currentCity?.name ?? actor.cityId} /><Stat label="Country" value={currentCountry?.name ?? world.activeCountryId} /><Stat label="Cash" value={formatMoney(actor.cashCents, true)} /></View></Card>

      <View style={styles.section}>
        <SectionHeader title="Move cities" />
        {domestic.map((city) => (
          <Card key={city.id}>
            <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{city.name}</Heading><Body secondary>Cost index {city.costIndex} · jobs {city.jobIndex} · housing {city.housingIndex}</Body></View><StatusPill>{formatMoney(city.moveCostCents, true)}</StatusPill></View>
            <EngineActionButton title={`Move to ${city.name}`} action={{ verb: 'life.move_city', targetIds: [], parameters: { cityId: city.id } }} tone="accent" />
          </Card>
        ))}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Emigrate" />
        <Body secondary>Moving countries can end incompatible local jobs and political roles. Family and friendships stay in your history, but distance affects them.</Body>
        {international.map((city) => {
          const country = WORLD_CONTENT.countries.find((item) => item.id === city.countryId);
          return (
            <Card key={city.id}>
              <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{city.name}</Heading><Body secondary>{country?.name} · stability {country?.stability} · market access {country?.marketAccess}</Body></View><StatusPill tone="warning">{formatMoney(city.moveCostCents, true)}</StatusPill></View>
              <EngineActionButton title={`Emigrate to ${city.name}`} action={{ verb: 'life.emigrate', targetIds: [], parameters: { cityId: city.id }, destructive: true }} tone="accent" />
            </Card>
          );
        })}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
});
