import React, { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { DetailScreen } from '@/components/DetailScreen';
import { searchWorld } from '@/engine/worldIndex';
import { useGame } from '@/state/GameProvider';
import { Body, Card, Heading, PrimaryButton, StatusPill } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

export default function SearchScreen() {
  const { world, togglePin } = useGame();
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const results = useMemo(() => world ? searchWorld(world, query) : [], [query, world]);
  if (!world) return null;
  return (
    <DetailScreen title="Search Your World" eyebrow="PEOPLE · ASSETS · ORGANIZATIONS · HISTORY">
      <TextInput autoFocus accessibilityLabel="Search your world" value={query} onChangeText={setQuery} placeholder="Search a person, company, property, country…" placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
      {world.favorites.length > 0 && !query ? <Card accent><Heading size="small">Favorites</Heading><Body secondary>{world.favorites.map((favorite) => favorite.label).join(' · ')}</Body></Card> : null}
      {results.map((result) => <Card key={`${result.type}-${result.id}`}><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{result.title}</Heading><Body secondary>{result.subtitle}</Body></View><StatusPill tone={result.pinned ? 'warning' : 'neutral'}>{result.type}</StatusPill></View><PrimaryButton title={result.pinned ? 'Unpin' : 'Pin'} tone="neutral" onPress={() => { void togglePin(result.type, result.id, result.title); }} /></Card>)}
      {query && results.length === 0 ? <Card><Body secondary>No person, business, property, organization, country, or historical event matches that search.</Body></Card> : null}
    </DetailScreen>
  );
}

const styles = StyleSheet.create({ input: { minHeight: 52, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, fontSize: 17 }, row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md } });
