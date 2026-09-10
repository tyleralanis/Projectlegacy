import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LifePlanCard } from '@/components/LifePlanCard';
import { MenuTile } from '@/components/MenuTile';
import { WhyCard } from '@/components/WhyCard';
import { WORLD_CONTENT } from '@/content/worldContent';
import { availableFocusesForAge, canManagePriorities, developmentPrioritiesForAge } from '@/engine/ageProgression';
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
  if (status === 'unsustainable') return { label: 'Too much', tone: 'danger', copy: 'Something has to give: work, health, or relationships.' };
  if (status === 'overloaded') return { label: 'Overloaded', tone: 'warning', copy: 'There are more commitments than sustainable hours.' };
  if (status === 'busy') return { label: 'Pretty full', tone: 'accent', copy: 'The week fits, but there is not much slack.' };
  return { label: 'Room to breathe', tone: 'success', copy: 'There is time left for people, rest, and opportunities.' };
}

function storyTitle(category: string): string {
  const label = category.replace('Thread · ', '');
  if (label === 'Relationship') return 'Someone is feeling the distance';
  if (label === 'Time pressure') return 'The schedule is becoming a problem';
  if (label === 'Career') return 'Work is turning into a story';
  if (label === 'Business') return 'A company problem is sticking around';
  if (label === 'Family money') return 'Money is getting personal';
  return 'This is still unfolding';
}

function narrativeArcTitle(category: string): string {
  const label = category.replace('Arc · Narrative · ', '');
  if (label === 'Economic weather') return 'The economy is reaching several parts of your life';
  if (label === 'Success has overhead') return 'Success is creating more work';
  if (label === 'Reputation under legal pressure') return 'The legal problem is hurting your reputation';
  if (label === 'Body versus career') return 'Your body and ambition are colliding';
  return label;
}

export default function LifeScreen() {
  const { world, lastSummary, setFocus } = useGame();
  const { colors } = useAppTheme();
  const [expandedStories, setExpandedStories] = useState(false);
  const [expandedFeed, setExpandedFeed] = useState(false);
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
  const focusOptions = availableFocusesForAge(age);
  const managesPriorities = canManagePriorities(age);
  const developmentPriorities = developmentPrioritiesForAge(age);
  const toggleFocus = (focus: FocusArea) => {
    if (!managesPriorities || !focusOptions.includes(focus)) return;
    const current = actor.focuses.filter((item) => focusOptions.includes(item));
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

      {age >= 8 ? <Pressable accessibilityRole="button" onPress={() => router.push('/time' as never)}>
        <Card accent>
          <View style={styles.eventHeader}>
            <View style={{ flex: 1, gap: 4 }}><Eyebrow>YOUR WEEK</Eyebrow><Heading size="small">{timeBudget.committedHours}h spoken for · {timeBudget.freeHours}h still yours</Heading></View>
            <StatusPill tone={timeState.tone}>{timeState.label}</StatusPill>
          </View>
          <ProgressBar value={Math.min(100, timeBudget.loadRatio * 100)} tone={timeBudget.status === 'unsustainable' ? 'danger' : timeBudget.status === 'overloaded' ? 'legacy' : 'success'} />
          <Body secondary>{timeState.copy}</Body>
          {timeBudget.commitments.slice(0, 4).map((commitment) => <View key={commitment.id} style={styles.commitmentRow}><Body>{commitment.label}</Body><Body secondary>{commitment.hours}h</Body></View>)}
          {timeBudget.commitments.length > 4 ? <Body secondary>+ {timeBudget.commitments.length - 4} more</Body> : null}
        </Card>
      </Pressable> : null}

      {activeEvent ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/event')}>
          <Card accent style={{ borderColor: colors.legacy }}>
            <View style={styles.eventHeader}><View style={{ gap: 4, flex: 1 }}><Eyebrow color={colors.legacy}>SOMETHING IS UP · {activeEvent.domain.toUpperCase()}</Eyebrow><Heading>{activeEvent.title}</Heading></View><StatusPill tone={activeEvent.severity === 'S4' ? 'danger' : 'warning'}>{activeEvent.severity === 'S4' ? 'Big one' : 'Needs you'}</StatusPill></View>
            <Body>{activeEvent.narrative}</Body><PrimaryButton title="See what's happening" onPress={() => router.push('/event')} />
          </Card>
        </Pressable>
      ) : age >= 8 ? <Card accent><Eyebrow>NOTHING ON FIRE</Eyebrow><Heading size="small">The week is yours</Heading><Body secondary>Nothing needs an immediate decision.</Body></Card> : null}

      <LifePlanCard />

      {narrativeArcs.length > 0 && age >= 8 ? <View style={styles.section}>
        <SectionHeader title="Pressure & momentum" action={<StatusPill tone="warning">{narrativeArcs.length} active</StatusPill>} />
        {narrativeArcs.slice(0, expandedStories ? 3 : 1).map((memory) => <Card key={memory.id}>
          <View style={styles.eventHeader}>
            <View style={{ flex: 1, gap: 4 }}><Eyebrow>{memory.category.replace('Arc · Narrative · ', '').toUpperCase()}</Eyebrow><Heading size="small">{narrativeArcTitle(memory.category)}</Heading></View>
            <StatusPill tone={memory.importance >= 78 ? 'danger' : memory.importance >= 64 ? 'warning' : 'accent'}>{memory.importance >= 78 ? 'Hot' : 'Building'}</StatusPill>
          </View>
          <Body secondary>{memory.narrative}</Body>
        </Card>)}
      </View> : null}

      {openStories.length > 0 && age >= 8 ? <View style={styles.section}>
        <SectionHeader title="Ongoing stories" action={<StatusPill tone="warning">{openStories.length} open</StatusPill>} />
        {openStories.slice(0, expandedStories ? 4 : 1).map((memory) => {
          const label = memory.category.replace('Thread · ', '');
          const people = memory.participantIds.filter((id) => id !== actor.id).map((id) => world.characters[id]?.firstName).filter(Boolean).slice(0, 2).join(' & ');
          return <Card key={memory.id}>
            <View style={styles.eventHeader}><View style={{ flex: 1, gap: 4 }}><Eyebrow>{label.toUpperCase()}{people ? ` · ${people.toUpperCase()}` : ''}</Eyebrow><Heading size="small">{storyTitle(memory.category)}</Heading></View><StatusPill tone={memory.importance >= 82 ? 'danger' : memory.importance >= 65 ? 'warning' : 'accent'}>{memory.importance >= 82 ? 'Hot' : 'Building'}</StatusPill></View>
            <Body secondary>{memory.narrative}</Body>
          </Card>;
        })}
      </View> : null}

      {narrativeArcs.length > 1 || openStories.length > 1 ? <PrimaryButton title={expandedStories ? 'Show fewer ongoing stories' : 'Show more ongoing stories'} tone="neutral" accessibilityState={{ expanded: expandedStories }} onPress={() => setExpandedStories((value) => !value)} /> : null}

      {lifeTexture.length > 0 ? <Card>
        <Eyebrow>LIFE BETWEEN MILESTONES</Eyebrow>
        {lifeTexture.map((memory) => <View key={memory.id} style={styles.textureRow}><View style={[styles.textureDot, { backgroundColor: colors.accent }]} /><Body secondary>{memory.narrative}</Body></View>)}
      </Card> : null}

      <View style={styles.section}>
        <SectionHeader title={age < 18 ? 'Life right now' : 'Do something'} />
        {age >= 8 ? <MenuTile icon="⏳" title="Your week" subtitle="See where your time is going." route="/time" badge={timeBudget.overloadHours > 0 ? `${timeBudget.overloadHours}h over` : `${timeBudget.freeHours}h free`} /> : null}
        <MenuTile icon={age < 5 ? '🧸' : '🌿'} title={age < 5 ? 'Health & development' : 'Health & wellness'} subtitle={age < 5 ? 'Movement, language, sleep, and caregiver routines.' : age < 12 ? 'Play, movement, sports, sleep, and growing well.' : 'Fitness, recovery, stress, and health.'} route="/wellness" badge={`${Math.round(actor.health)} health`} />
        {age === 15 ? <MenuTile icon="🚗" title="Learn to drive" subtitle="Start training now so you can be ready at 16." route="/luxury" badge="Available now" /> : null}
        {age >= 18 ? <MenuTile icon="🧳" title="Move" subtitle="Change cities or start over somewhere else." route="/move" badge={city?.name ?? 'Home'} /> : <Card><Heading size="small">🏡 Home still shapes your options</Heading><Body secondary>Family, school, friends, and the adults around you still have a lot of control over daily life.</Body></Card>}
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
        <SectionHeader title="What's important right now?" action={managesPriorities ? <StatusPill tone={actor.focuses.length === 3 ? 'success' : 'warning'}>{actor.focuses.length}/3</StatusPill> : <StatusPill tone="accent">Age {age}</StatusPill>} />
        {managesPriorities ? <Card><Body secondary>Pick up to three. These get protected first when time gets tight.</Body><View style={styles.focusWrap}>{focusOptions.map((focus) => { const selected = actor.focuses.includes(focus); return <Pressable key={focus} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleFocus(focus)} style={[styles.focusChip, { backgroundColor: selected ? colors.accent : colors.secondary, borderColor: selected ? colors.accent : colors.border }]}><Text style={[styles.focusText, { color: selected ? '#FFFFFF' : colors.text }]}>{focus}</Text></Pressable>; })}</View></Card> : <Card>
          <Heading size="small">Caregivers handle the big stuff for now</Heading>
          <Body secondary>You are not responsible for managing work, money, or adult relationships yet.</Body>
          {developmentPriorities.map((priority) => <View key={priority.title} style={styles.developmentRow}><Heading size="small">{priority.title}</Heading><Body secondary>{priority.detail}</Body></View>)}
        </Card>}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Your life so far" />
        {world.feed.slice(0, expandedFeed ? 14 : 5).map((entry, index) => <View key={entry.id} style={styles.feedRow}><View style={[styles.feedRail, { backgroundColor: entry.important ? colors.legacy : colors.border }]} /><View style={{ flex: 1, gap: 5, paddingBottom: 12 }}><View style={styles.eventHeader}><Eyebrow>{entry.domain.toUpperCase()} · WEEK {entry.week}</Eyebrow>{index === 0 ? <StatusPill>Latest</StatusPill> : null}</View><Heading size="small">{entry.title}</Heading><Body secondary>{entry.detail}</Body></View></View>)}
      </View>
      {world.feed.length > 5 ? <PrimaryButton title={expandedFeed ? 'Show fewer life entries' : 'Show more life entries'} tone="neutral" accessibilityState={{ expanded: expandedFeed }} onPress={() => setExpandedFeed((value) => !value)} /> : null}
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
  developmentRow: { gap: 2, paddingTop: spacing.sm },
  feedRow: { flexDirection: 'row', gap: 12 },
  feedRail: { width: 3, borderRadius: 2 },
  toolRow: { flexDirection: 'row', gap: spacing.sm },
});
