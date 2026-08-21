import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MenuTile } from '@/components/MenuTile';
import { WhyCard } from '@/components/WhyCard';
import { WORLD_CONTENT } from '@/content/worldContent';
import { getOpenStoryThreads } from '@/engine/autonomousWorld';
import { playerAgeYears } from '@/engine/createWorld';
import { formatMoney, netWorthCents } from '@/engine/money';
import { getNarrativeArcs, getRecentLifeTexture } from '@/engine/narrativeDepth';
import { getActiveEvent } from '@/engine/simulation';
import { getDeepTimeBudget } from '@/engine/timeSystem';
import type { FocusArea } from '@/engine/types';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Eyebrow, Heading, PrimaryButton, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
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

function weekStatus(status: ReturnType<typeof getDeepTimeBudget>['status']): { label: string; tone: 'success' | 'accent' | 'warning' | 'danger'; copy: string } {
  if (status === 'unsustainable') return { label: 'Too much', tone: 'danger', copy: 'This schedule is eating the person underneath it. Performance, health, or relationships will eventually pay for the excess.' };
  if (status === 'overloaded') return { label: 'Overloaded', tone: 'warning', copy: 'There are more commitments than sustainable hours. Your priorities decide what gets protected first.' };
  if (status === 'busy') return { label: 'Pretty full', tone: 'accent', copy: 'The week fits, but there is not much slack for surprises.' };
  return { label: 'Room to breathe', tone: 'success', copy: 'There is enough unclaimed time for people, opportunities, and the occasional bad idea.' };
}

function storyTitle(category: string): string {
  const label = category.replace('Thread · ', '');
  if (label === 'Relationship') return 'Someone is feeling the distance';
  if (label === 'Time pressure') return 'The schedule itself is becoming a problem';
  if (label === 'Career') return 'Work is turning into a story';
  if (label === 'Business') return 'A company problem is sticking around';
  if (label === 'Family money') return 'Money is getting personal';
  return 'This is still unfolding';
}

function narrativeArcTitle(category: string): string {
  const label = category.replace('Arc · Narrative · ', '');
  if (label === 'Economic weather') return 'The economy is reaching several parts of your life';
  if (label === 'Success has overhead') return 'Success is becoming its own workload';
  if (label === 'Reputation under legal pressure') return 'The legal problem is spilling into reputation';
  if (label === 'Body versus career') return 'Your body and your ambition are negotiating';
  return label;
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
  const timeBudget = getDeepTimeBudget(world);
  const timeState = weekStatus(timeBudget.status);
  const narrativeArcs = getNarrativeArcs(world);
  const lifeTexture = getRecentLifeTexture(world, 2);
  const openStories = getOpenStoryThreads(world);
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

      <Pressable accessibilityRole="button" onPress={() => router.push('/time' as never)}>
        <Card accent>
          <View style={styles.eventHeader}>
            <View style={{ flex: 1, gap: 4 }}><Eyebrow>YOUR WEEK</Eyebrow><Heading size="small">{timeBudget.committedHours}h spoken for · {timeBudget.freeHours}h still yours</Heading></View>
            <StatusPill tone={timeState.tone}>{timeState.label}</StatusPill>
          </View>
          <ProgressBar value={Math.min(100, timeBudget.loadRatio * 100)} tone={timeBudget.status === 'unsustainable' ? 'danger' : timeBudget.status === 'overloaded' ? 'legacy' : 'success'} />
          <Body secondary>{timeState.copy}</Body>
          {timeBudget.commitments.slice(0, 4).map((commitment) => <View key={commitment.id} style={styles.commitmentRow}><Body>{commitment.label}</Body><Body secondary>{commitment.hours}h</Body></View>)}
          {timeBudget.commitments.length > 4 ? <Body secondary>+ {timeBudget.commitments.length - 4} smaller commitments · tap to see what is being squeezed</Body> : <Body secondary>Tap to see the full opportunity-cost picture.</Body>}
        </Card>
      </Pressable>

      {activeEvent ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/event')}>
          <Card accent style={{ borderColor: colors.legacy }}>
            <View style={styles.eventHeader}><View style={{ gap: 4, flex: 1 }}><Eyebrow color={colors.legacy}>SOMETHING IS UP · {activeEvent.domain.toUpperCase()}</Eyebrow><Heading>{activeEvent.title}</Heading></View><StatusPill tone={activeEvent.severity === 'S4' ? 'danger' : 'warning'}>{activeEvent.severity === 'S4' ? 'Big one' : 'Needs you'}</StatusPill></View>
            <Body>{activeEvent.narrative}</Body><PrimaryButton title="See what's happening" onPress={() => router.push('/event')} />
          </Card>
        </Pressable>
      ) : <Card accent><Eyebrow>NOTHING ON FIRE</Eyebrow><Heading size="small">The week is yours</Heading><Body secondary>Your priorities handle the ordinary stuff. The world handles making sure ordinary does not last forever.</Body></Card>}

      {narrativeArcs.length > 0 ? <View style={styles.section}>
        <SectionHeader title="Pressure & momentum" action={<StatusPill tone="warning">{narrativeArcs.length} active</StatusPill>} />
        {narrativeArcs.slice(0, 3).map((memory) => <Card key={memory.id}>
          <View style={styles.eventHeader}>
            <View style={{ flex: 1, gap: 4 }}><Eyebrow>{memory.category.replace('Arc · Narrative · ', '').toUpperCase()}</Eyebrow><Heading size="small">{narrativeArcTitle(memory.category)}</Heading></View>
            <StatusPill tone={memory.importance >= 78 ? 'danger' : memory.importance >= 64 ? 'warning' : 'accent'}>{memory.importance >= 78 ? 'Hot' : 'Building'}</StatusPill>
          </View>
          <Body secondary>{memory.narrative}</Body>
        </Card>)}
        <Body secondary>These are cross-system pressures. They close only when the underlying conditions actually improve.</Body>
      </View> : null}

      {openStories.length > 0 ? <View style={styles.section}>
        <SectionHeader title="Ongoing stories" action={<StatusPill tone="warning">{openStories.length} open</StatusPill>} />
        {openStories.slice(0, 4).map((memory) => {
          const label = memory.category.replace('Thread · ', '');
          const people = memory.participantIds.filter((id) => id !== actor.id).map((id) => world.characters[id]?.firstName).filter(Boolean).slice(0, 2).join(' & ');
          return <Card key={memory.id}>
            <View style={styles.eventHeader}><View style={{ flex: 1, gap: 4 }}><Eyebrow>{label.toUpperCase()}{people ? ` · ${people.toUpperCase()}` : ''}</Eyebrow><Heading size="small">{storyTitle(memory.category)}</Heading></View><StatusPill tone={memory.importance >= 82 ? 'danger' : memory.importance >= 65 ? 'warning' : 'accent'}>{memory.importance >= 82 ? 'Hot' : 'Building'}</StatusPill></View>
            <Body secondary>{memory.narrative}</Body>
          </Card>;
        })}
        <Body secondary>These do not disappear because a popup closed. They stay open until the underlying situation actually changes.</Body>
      </View> : null}

      {lifeTexture.length > 0 ? <Card>
        <Eyebrow>LIFE BETWEEN MILESTONES</Eyebrow>
        {lifeTexture.map((memory) => <View key={memory.id} style={styles.textureRow}><View style={[styles.textureDot, { backgroundColor: colors.accent }]} /><Body secondary>{memory.narrative}</Body></View>)}
        <Body secondary>Quiet years still count. These moments are drawn from the life you are actually living, not from a generic random-event deck.</Body>
      </Card> : null}

      <View style={styles.section}>
        <SectionHeader title={age < 18 ? 'Life right now' : 'Do something'} />
        <MenuTile icon="⏳" title="Your week" subtitle="See the opportunity cost behind work, school, relationships, businesses, properties, organizations, wealth, health, and delegation." route="/time" badge={timeBudget.overloadHours > 0 ? `${timeBudget.overloadHours}h over` : `${timeBudget.freeHours}h free`} />
        <MenuTile icon="🌿" title="Health & wellness" subtitle="Run, work out, take a class, go to therapy, clear your head, and maybe meet somebody." route="/wellness" badge={`${Math.round(actor.health)} health`} />
        {age >= 18 ? <MenuTile icon="🧳" title="Move" subtitle="Change cities, chase a cheaper life, follow opportunity, or emigrate and start rebuilding somewhere else." route="/move" badge={city?.name ?? 'Home'} /> : <Card><Heading size="small">🏡 Your world is still partly chosen for you</Heading><Body secondary>Family, school, friends, interests, and the adults around you are shaping what becomes possible later. Those relationships and habits now keep compounding while you grow.</Body></Card>}
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
        <Card><Body secondary>Pick up to three. They are not decorative: when the week cannot fit everything, these are the areas the simulation tries to protect first.</Body><View style={styles.focusWrap}>{focusOptions.map((focus) => { const selected = actor.focuses.includes(focus); return <Pressable key={focus} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleFocus(focus)} style={[styles.focusChip, { backgroundColor: selected ? colors.accent : colors.secondary, borderColor: selected ? colors.accent : colors.border }]}><Text style={[styles.focusText, { color: selected ? '#FFFFFF' : colors.text }]}>{focus}</Text></Pressable>; })}</View></Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Your life so far" />
        {world.feed.slice(0, 14).map((entry, index) => <View key={entry.id} style={styles.feedRow}><View style={[styles.feedRail, { backgroundColor: entry.important ? colors.legacy : colors.border }]} /><View style={{ flex: 1, gap: 5, paddingBottom: 12 }}><View style={styles.eventHeader}><Eyebrow>{entry.domain.toUpperCase()} · WEEK {entry.week}</Eyebrow>{index === 0 ? <StatusPill>Latest</StatusPill> : null}</View><Heading size="small">{entry.title}</Heading><Body secondary>{entry.detail}</Body></View></View>)}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', gap: 16, alignItems: 'flex-start', paddingTop: 8 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  eventHeader: { flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', alignItems: 'flex-start' },
  section: { gap: spacing.md },
  commitmentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  textureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  textureDot: { width: 7, height: 7, borderRadius: 4, marginTop: 7 },
  focusWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  focusChip: { minHeight: 44, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 13, justifyContent: 'center' },
  focusText: { fontSize: 13, fontWeight: '700' },
  feedRow: { flexDirection: 'row', gap: 12 },
  feedRail: { width: 3, borderRadius: 2 },
  toolRow: { flexDirection: 'row', gap: spacing.sm },
});
