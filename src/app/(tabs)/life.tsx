import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MenuTile } from '@/components/MenuTile';
import { WhyCard } from '@/components/WhyCard';
import { WORLD_CONTENT } from '@/content/worldContent';
import { playerAgeYears } from '@/engine/createWorld';
import { formatMoney, netWorthCents } from '@/engine/money';
import { getActiveEvent } from '@/engine/simulation';
import type { FocusArea } from '@/engine/types';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Eyebrow, Heading, PrimaryButton, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

const focusOptions: FocusArea[] = ['Academics', 'Sport', 'Family', 'Partner', 'Job', 'Startup', 'Health', 'Networking', 'Campaign', 'Creative Work'];

function exactAge(worldWeek: number, birthWeek: number): string {
  const weeks = Math.max(0, worldWeek - birthWeek);
  const years = Math.floor(weeks / 52);
  const months = Math.floor(((weeks % 52) / 52) * 12);
  return `${years}y ${months}m`;
}

function qualitative(value: number): string {
  return value >= 82 ? 'Excellent' : value >= 65 ? 'Strong' : value >= 45 ? 'Steady' : value >= 28 ? 'Strained' : 'Critical';
}

export default function LifeScreen() {
  const { world, lastSummary, setFocus } = useGame();
  const { colors } = useAppTheme();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const activeEvent = getActiveEvent(world);
  const age = playerAgeYears(world);
  const city = WORLD_CONTENT.cities.find((item) => item.id === actor.cityId);
  const country = WORLD_CONTENT.countries.find((item) => item.id === world.activeCountryId);
  const toggleFocus = (focus: FocusArea) => {
    const current = actor.focuses;
    const next = current.includes(focus) ? current.filter((item) => item !== focus) : [...current, focus].slice(-3);
    void setFocus(next);
  };

  return (
    <AppScreen>
      <View style={styles.identity}>
        <View style={{ flex: 1, gap: 4 }}>
          <Eyebrow>{new Date(`${world.calendar.dateISO}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).toUpperCase()}</Eyebrow>
          <Heading size="large">{actor.firstName} {actor.lastName}</Heading>
          <Body secondary>{exactAge(world.calendar.week, actor.birthWeek)} · {city?.name ?? actor.cityId} · {country?.name ?? 'Unknown country'} · Gen {world.dynasty.generation}</Body>
        </View>
        <StatusPill tone={actor.isAlive ? 'success' : 'danger'}>{actor.isAlive ? `Age ${age}` : 'Deceased'}</StatusPill>
      </View>

      <Card>
        <View style={styles.statsRow}>
          <Stat label="Cash" value={formatMoney(actor.cashCents, true)} tone={actor.cashCents < 0 ? 'danger' : 'default'} />
          <Stat label="Net worth" value={formatMoney(netWorthCents(world), true)} tone="legacy" />
          <Stat label="Health" value={qualitative(actor.health)} tone={actor.health < 35 ? 'danger' : 'success'} />
          <Stat label="Mood" value={qualitative(actor.mood)} />
        </View>
      </Card>

      {activeEvent ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/event')}>
          <Card accent style={{ borderColor: colors.legacy }}>
            <View style={styles.eventHeader}><View style={{ gap: 4, flex: 1 }}><Eyebrow color={colors.legacy}>SOMETHING'S UP · {activeEvent.domain.toUpperCase()}</Eyebrow><Heading>{activeEvent.title}</Heading></View><StatusPill tone={activeEvent.severity === 'S4' ? 'danger' : 'warning'}>{activeEvent.severity}</StatusPill></View>
            <Body>{activeEvent.narrative}</Body><PrimaryButton title="See what's happening" onPress={() => router.push('/event')} />
          </Card>
        </Pressable>
      ) : <Card accent><Eyebrow>NOTHING ON FIRE</Eyebrow><Heading size="small">The week is yours</Heading><Body secondary>Your standing focuses handle the boring stuff while you decide what deserves attention.</Body></Card>}

      <View style={styles.section}>
        <SectionHeader title="Do something" />
        <MenuTile icon="🌿" title="Health & wellness" subtitle="Run, work out, take a class, go to therapy, clear your head, and maybe meet somebody." route="/wellness" badge={`${Math.round(actor.health)} health`} />
        <MenuTile icon="🧳" title="Move" subtitle="Change cities, chase a cheaper life, follow opportunity, or emigrate and start rebuilding somewhere else." route="/move" badge={city?.name ?? 'Home'} />
      </View>

      {lastSummary ? <Card>
        <View style={styles.eventHeader}><SectionHeader title="What just happened" /><StatusPill tone="accent">{lastSummary.advancedWeeks}W</StatusPill></View>
        <View style={styles.statsRow}><Stat label="Cash change" value={formatMoney(lastSummary.cashDeltaCents, true)} tone={lastSummary.cashDeltaCents < 0 ? 'danger' : 'success'} /><Stat label="Wealth change" value={formatMoney(lastSummary.netWorthDeltaCents, true)} tone={lastSummary.netWorthDeltaCents < 0 ? 'danger' : 'success'} /></View>
        {lastSummary.highlights.map((highlight) => <Body key={highlight} secondary>• {highlight}</Body>)}
        {lastSummary.delegatedDecisions.length > 0 ? <Body secondary>{lastSummary.delegatedDecisions.length} routine decisions followed your standing priorities.</Body> : null}
        {lastSummary.missedOpportunities.length > 0 ? <><Eyebrow>MISSED OPPORTUNITIES</Eyebrow>{lastSummary.missedOpportunities.map((item) => <Body key={item} secondary>• {item}</Body>)}</> : null}
        {lastSummary.consequences.length > 0 ? <><Eyebrow>CONSEQUENCES</Eyebrow>{lastSummary.consequences.map((item) => <Body key={item} secondary>• {item}</Body>)}</> : null}
        <WhyCard explanation={lastSummary.explanation} />
      </Card> : null}

      <View style={styles.section}><SectionHeader title="Legacy stuff" /><View style={styles.toolRow}><PrimaryButton title="World History" style={{ flex: 1 }} onPress={() => router.push('/history' as never)} /><PrimaryButton title="Search & Pins" tone="neutral" style={{ flex: 1 }} onPress={() => router.push('/search' as never)} /></View></View>

      <View style={styles.section}>
        <SectionHeader title="What's important right now?" action={<StatusPill tone={actor.focuses.length === 3 ? 'success' : 'warning'}>{actor.focuses.length}/3</StatusPill>} />
        <Card><Body secondary>Pick up to three. These quietly steer routine choices when you jump through time.</Body><View style={styles.focusWrap}>{focusOptions.map((focus) => { const selected = actor.focuses.includes(focus); return <Pressable key={focus} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleFocus(focus)} style={[styles.focusChip, { backgroundColor: selected ? colors.accent : colors.secondary, borderColor: selected ? colors.accent : colors.border }]}><Text style={[styles.focusText, { color: selected ? '#FFFFFF' : colors.text }]}>{focus}</Text></Pressable>; })}</View></Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Your life so far" />
        {world.feed.slice(0, 12).map((entry, index) => <View key={entry.id} style={styles.feedRow}><View style={[styles.feedRail, { backgroundColor: entry.important ? colors.legacy : colors.border }]} /><View style={{ flex: 1, gap: 5, paddingBottom: 12 }}><View style={styles.eventHeader}><Eyebrow>{entry.domain.toUpperCase()} · WEEK {entry.week}</Eyebrow>{index === 0 ? <StatusPill>Latest</StatusPill> : null}</View><Heading size="small">{entry.title}</Heading><Body secondary>{entry.detail}</Body></View></View>)}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', gap: 16, alignItems: 'flex-start', paddingTop: 8 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  eventHeader: { flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', alignItems: 'flex-start' },
  section: { gap: spacing.md },
  focusWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  focusChip: { minHeight: 44, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 13, justifyContent: 'center' },
  focusText: { fontSize: 13, fontWeight: '700' },
  feedRow: { flexDirection: 'row', gap: 12 },
  feedRail: { width: 3, borderRadius: 2 },
  toolRow: { flexDirection: 'row', gap: spacing.sm },
});
