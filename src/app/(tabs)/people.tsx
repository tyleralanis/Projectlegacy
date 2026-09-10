import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { OtherActionComposer } from '@/components/OtherActionComposer';
import { playerAgeYears } from '@/engine/createWorld';
import { relationshipPortrait } from '@/engine/immersionWorld';
import { socialCircle } from '@/engine/lifeJourney';
import { relationshipNeed } from '@/engine/relationshipDepth';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Eyebrow, Heading, ProgressBar, SectionHeader, StatusPill } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

type Group = 'family' | 'friends' | 'dating' | 'acquaintances' | 'professional' | 'rivals';

const groups: { id: Group; icon: string; title: string; subtitle: string; minimumAge?: number }[] = [
  { id: 'family', icon: '🏡', title: 'Family', subtitle: 'Parents, siblings, children, and relatives.' },
  { id: 'friends', icon: '🫶', title: 'Friends', subtitle: 'The people you choose to keep around.', minimumAge: 3 },
  { id: 'dating', icon: '💘', title: 'Dating & partners', subtitle: 'Dates, partners, spouses, and relationship decisions.', minimumAge: 16 },
  { id: 'acquaintances', icon: '👋', title: 'Acquaintances', subtitle: 'People from school, activities, work, or ordinary life.', minimumAge: 5 },
  { id: 'professional', icon: '🤝', title: 'Professional network', subtitle: 'Coworkers, advisors, executives, and useful connections.', minimumAge: 14 },
  { id: 'rivals', icon: '⚡', title: 'Rivals', subtitle: 'People you do not get along with.', minimumAge: 5 },
];

function relationshipStatus(trust: number, affection: number, resentment: number): string {
  const score = (trust + affection - resentment) / 2;
  return score >= 72 ? 'Close' : score >= 52 ? 'Steady' : score >= 32 ? 'Distant' : 'Strained';
}

function ageOf(worldWeek: number, birthWeek: number): number {
  return Math.max(0, Math.floor((worldWeek - birthWeek) / 52));
}

function weeksAgo(currentWeek: number, week: number): string {
  const elapsed = Math.max(0, currentWeek - week);
  if (elapsed === 0) return 'this week';
  if (elapsed === 1) return 'last week';
  if (elapsed < 52) return `${elapsed} weeks ago`;
  const years = Math.floor(elapsed / 52);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

export default function PeopleScreen() {
  const { world } = useGame();
  const { colors } = useAppTheme();
  const [selected, setSelected] = useState<Group | null>(null);
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const age = playerAgeYears(world);
  const availableGroups = groups.filter((group) => age >= (group.minimumAge ?? 0));
  const relationships = Object.values(world.relationships)
    .filter((relationship) => relationship.characterIds.includes(actor.id))
    .map((relationship) => {
      const otherId = relationship.characterIds.find((id) => id !== actor.id)!;
      const person = world.characters[otherId];
      const kind = actor.parentIds.includes(otherId) ? 'parent' : actor.childIds.includes(otherId) ? 'child' : relationship.kind;
      let group: Group;
      if (['parent', 'child', 'sibling', 'relative'].includes(kind)) group = 'family';
      else if (['partner', 'spouse'].includes(kind)) group = 'dating';
      else if (kind === 'friend') group = 'friends';
      else if (kind === 'rival') group = 'rivals';
      else if (kind === 'professional' && person?.professionId) group = 'professional';
      else group = 'acquaintances';
      return { relationship, person, kind, group };
    })
    .filter((item) => item.person);

  if (selected) {
    const definition = groups.find((group) => group.id === selected)!;
    const shown = relationships.filter((item) => item.group === selected);
    return (
      <AppScreen>
        <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={[styles.back, { backgroundColor: colors.secondary }]}><Text style={[styles.backText, { color: colors.text }]}>‹ People</Text></Pressable>
        <View style={styles.header}><Eyebrow>{definition.icon} {definition.title.toUpperCase()}</Eyebrow><Heading size="large">{definition.title}</Heading><Body secondary>{definition.subtitle}</Body></View>
        <View style={styles.section}>
          {shown.length === 0 ? <Card><Heading size="small">Nobody here yet</Heading><Body secondary>Life will put more people in your orbit over time.</Body></Card> : shown.map(({ relationship, person, kind }) => {
            const portrait = relationshipPortrait(world, person.id);
            const need = relationshipNeed(world, person.id);
            const caregiverManaged = age < 8 && kind === 'parent';
            const sameHousehold = person.householdId === actor.householdId;
            const parentCareer = Object.values(world.careers).find((career) => career.characterId === person.id && career.active);
            const parentBusy = Boolean(parentCareer && ((parentCareer.hoursPerWeek ?? 40) >= 50 || person.focuses.includes('Job')));
            const caregiverTitle = !sameHousehold ? 'Living apart' : parentBusy ? 'Work takes some of their time' : 'Present day-to-day';
            const caregiverDetail = !sameHousehold ? 'Living in different households can limit everyday time together.' : parentBusy ? 'Their work schedule affects how available they are.' : 'They are around and handling the everyday care.';
            return (
              <Card key={relationship.id}>
                <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{person.firstName} {person.lastName}</Heading><Body secondary>{kind} · age {ageOf(world.calendar.week, person.birthWeek)} · {relationshipStatus(relationship.trust, relationship.affection, relationship.resentment)}</Body></View><StatusPill tone={person.isAlive ? 'success' : 'neutral'}>{person.isAlive ? 'Around' : 'Remembered'}</StatusPill></View>

                <Body>{portrait.summary}</Body>
                <View style={styles.lifeBlock}><Eyebrow>THEIR LIFE RIGHT NOW</Eyebrow><Body secondary>{portrait.currentLife}</Body></View>
                <View style={styles.traitWrap}>{portrait.traits.map((trait) => <StatusPill key={trait} tone="neutral">{trait}</StatusPill>)}</View>

                {caregiverManaged ? <View style={[styles.need, { backgroundColor: colors.secondary }]}><View style={{ flex: 1, gap: 3 }}><Eyebrow>CAREGIVER ROLE</Eyebrow><Body>{caregiverTitle}</Body><Body secondary>{caregiverDetail}</Body><Body secondary>This is mostly shaped by what they do right now, not by a priority you pick.</Body></View></View> : <View style={[styles.need, { backgroundColor: colors.secondary }]}><View style={{ flex: 1, gap: 3 }}><Eyebrow>WHAT THIS RELATIONSHIP NEEDS</Eyebrow><Body>{need.title}</Body><Body secondary>{need.detail}</Body></View></View>}

                {!caregiverManaged ? <View style={styles.metrics}>
                  <View style={styles.metric}><View style={styles.row}><Body>Trust</Body><Body secondary>{Math.round(relationship.trust)}</Body></View><ProgressBar value={relationship.trust} /></View>
                  <View style={styles.metric}><View style={styles.row}><Body>Affection</Body><Body secondary>{Math.round(relationship.affection)}</Body></View><ProgressBar value={relationship.affection} tone="legacy" /></View>
                  <View style={styles.metric}><View style={styles.row}><Body>Resentment</Body><Body secondary>{Math.round(relationship.resentment)}</Body></View><ProgressBar value={relationship.resentment} tone="danger" /></View>
                </View> : null}

                <View style={styles.lifeBlock}>
                  <View style={styles.row}><Eyebrow>SHARED HISTORY</Eyebrow>{!caregiverManaged ? <Body secondary>Last real interaction {weeksAgo(world.calendar.week, relationship.lastInteractionWeek)}</Body> : null}</View>
                  {portrait.recentSharedHistory.length === 0 ? <Body secondary>{caregiverManaged ? 'Most of the relationship is still everyday care and time together.' : 'Nothing major is written into the relationship yet.'}</Body> : portrait.recentSharedHistory.slice(0, 3).map((memory, index) => <Body key={`${person.id}-memory-${index}`} secondary>• {memory}</Body>)}
                </View>

                {person.isAlive && !caregiverManaged ? <>
                  <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/relationship', params: { personId: person.id } } as never)} style={({ pressed }) => [styles.focusButton, { backgroundColor: colors.accentSoft, borderColor: colors.accent, opacity: pressed ? 0.74 : 1 }]}><View style={{ flex: 1 }}><Heading size="small">Open the relationship</Heading><Body secondary>Spend time, repair conflict, support goals, or handle bigger decisions.</Body></View><Text style={[styles.chevron, { color: colors.accent }]}>›</Text></Pressable>
                  <View style={styles.actions}>
                    <EngineActionButton title={age < 13 ? 'Talk' : 'Reach out'} action={{ verb: 'relationship.contact', targetIds: [person.id], parameters: {} }} style={{ flex: 1 }} />
                    <EngineActionButton title="Spend time" action={{ verb: 'relationship.spend_time', targetIds: [person.id], parameters: {} }} tone="accent" style={{ flex: 1 }} />
                  </View>
                </> : null}
              </Card>
            );
          })}
        </View>
        {age >= 8 ? <OtherActionComposer domains={['relationship', 'family', 'dynasty']} placeholder="Do something else with someone…" /> : null}
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <View style={styles.header}><Eyebrow>{age < 13 ? 'YOUR PEOPLE' : 'PEOPLE'}</Eyebrow><Heading size="large">People</Heading><Body secondary>{age < 8 ? 'The adults around you still shape most of your social world.' : 'Family, friends, partners, coworkers, acquaintances, and rivals.'}</Body></View>
      <Card accent><SectionHeader title={`${world.dynasty.familyName} family`} action={<StatusPill tone="warning">Generation {world.dynasty.generation}</StatusPill>} /><Body>{actor.parentIds.length} parents · {actor.childIds.length} children · {age >= 16 ? (actor.partnerId ? 'Partnered' : 'Single') : 'Still growing up'}</Body></Card>

      {age >= 8 ? <Card>
        <Heading size="small">Keep in touch</Heading>
        <Body secondary>Catch up with up to five living family members and friends, starting with those you have not spoken to recently. Two hours for short calls and messages; serious issues still need a personal conversation.</Body>
        {socialCircle(world).length ? <Body secondary>Next: {socialCircle(world).map((link) => world.characters[link.characterIds.find((id) => id !== actor.id)!].firstName).join(', ')}</Body> : null}
        {world.journey?.socialWeeks[actor.id] === world.calendar.week ? <StatusPill tone="success">Caught up this week</StatusPill> : <EngineActionButton title="Catch up with my circle" tone="accent" action={{ verb: 'relationship.keep_in_touch', targetIds: [], parameters: {} }} />}
      </Card> : null}

      <View style={styles.section}>
        {availableGroups.map((group) => {
          const count = relationships.filter((item) => item.group === group.id).length;
          return <Pressable key={group.id} accessibilityRole="button" accessibilityLabel={`${group.title}, ${count} people`} onPress={() => setSelected(group.id)} style={({ pressed }) => [styles.groupTile, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}><View style={[styles.icon, { backgroundColor: colors.accentSoft }]}><Text style={styles.iconText}>{group.icon}</Text></View><View style={{ flex: 1, gap: 3 }}><Heading size="small">{group.title}</Heading><Body secondary>{group.subtitle}</Body></View><View style={{ alignItems: 'center', gap: 2 }}><StatusPill tone={count > 0 ? 'accent' : 'neutral'}>{count}</StatusPill><Text style={[styles.chevron, { color: colors.accent }]}>›</Text></View></Pressable>;
        })}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Important memories" action={<StatusPill>{Object.keys(world.memories).length}</StatusPill>} />
        {Object.values(world.memories).length === 0 ? <Card><Body secondary>Nothing major has stuck yet.</Body></Card> : Object.values(world.memories).sort((left, right) => right.week - left.week).slice(0, 6).map((memory) => <Card key={memory.id}><View style={styles.row}><Heading size="small">{memory.category}</Heading><StatusPill tone={memory.unresolved ? 'warning' : 'neutral'}>{memory.unresolved ? 'Still matters' : 'Remembered'}</StatusPill></View><Body>{memory.narrative}</Body><Eyebrow>IMPORTANCE {Math.round(memory.importance)}</Eyebrow></Card>)}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4, paddingTop: 8 },
  section: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  metrics: { gap: spacing.md },
  metric: { gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  lifeBlock: { gap: 5, paddingTop: 2 },
  traitWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  need: { borderRadius: radius.md, padding: spacing.md, flexDirection: 'row' },
  focusButton: { minHeight: 82, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 13, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  groupTile: { minHeight: 94, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 25 },
  chevron: { fontSize: 26, lineHeight: 26 },
  back: { alignSelf: 'flex-start', minHeight: 44, borderRadius: radius.pill, paddingHorizontal: 12, justifyContent: 'center', marginTop: 4 },
  backText: { fontSize: 13, fontWeight: '700' },
});
