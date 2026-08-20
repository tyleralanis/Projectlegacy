import React, { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { DetailScreen } from '@/components/DetailScreen';
import { WhyCard } from '@/components/WhyCard';
import { useGame } from '@/state/GameProvider';
import { Body, Card, Eyebrow, Heading, PrimaryButton, StatusPill } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

export default function HistoryScreen() {
  const { world, togglePin } = useGame();
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const entries = useMemo(() => world ? world.timeline.filter((entry) => `${entry.title} ${entry.detail} ${entry.category}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 500) : [], [query, world]);
  if (!world) return null;
  return (
    <DetailScreen title="World History" eyebrow={`${world.dynasty.familyName.toUpperCase()} LEGACY · ${world.timeline.length} RECORDS`}>
      <Body secondary>Births, relationships, education, ownership, elections, scandals, deaths, and world changes survive succession.</Body>
      <TextInput accessibilityLabel="Filter world history" value={query} onChangeText={setQuery} placeholder="Filter by event, person, or category" placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
      {entries.map((entry) => {
        const pinned = world.favorites.some((favorite) => favorite.entityType === 'event' && favorite.entityId === entry.id);
        return <Card key={entry.id} accent={entry.importance >= 4}><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Eyebrow>GEN {entry.generation} · WEEK {entry.week} · {entry.category.toUpperCase()}</Eyebrow><Heading size="small">{entry.title}</Heading></View><StatusPill tone={entry.importance >= 4 ? 'warning' : 'neutral'}>{entry.importance}/5</StatusPill></View><Body secondary>{entry.detail}</Body><PrimaryButton title={pinned ? 'Unpin' : 'Pin to favorites'} tone="neutral" onPress={() => { void togglePin('event', entry.id, entry.title); }} /><WhyCard explanation={entry.explanation} /></Card>;
      })}
      {entries.length === 0 ? <Card><Body secondary>No history records match that search.</Body></Card> : null}
    </DetailScreen>
  );
}

const styles = StyleSheet.create({ input: { minHeight: 48, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 13, fontSize: 16 }, row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' } });
