import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { playerAgeYears } from '@/engine/createWorld';
import type { FocusArea } from '@/engine/types';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

const schoolFocus: { focus: FocusArea; icon: string; title: string; detail: string }[] = [
  { focus: 'Academics', icon: '📚', title: 'Study harder', detail: 'Protect grades and build knowledge. Discipline makes the time go further.' },
  { focus: 'Sport', icon: '🏀', title: 'Play a sport', detail: 'Build fitness, confidence, teammates, and a schedule that can get crowded fast.' },
  { focus: 'Networking', icon: '🫶', title: 'Be social', detail: 'Put energy into friends, classmates, and the people you may know for decades.' },
  { focus: 'Creative Work', icon: '🎸', title: 'Join something creative', detail: 'Music, art, writing, theater, tinkering, and other interests that can become real skills.' },
];

function gradeLabel(grade: number): string {
  if (grade >= 90) return 'Crushing it';
  if (grade >= 80) return 'Strong';
  if (grade >= 70) return 'Fine';
  if (grade >= 60) return 'Wobbly';
  return 'In trouble';
}

export default function SchoolScreen() {
  const { world, setFocus } = useGame();
  const { colors } = useAppTheme();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const age = playerAgeYears(world);
  const school = Object.values(world.education).find((record) => record.characterId === actor.id && record.status === 'school');
  const peers = Object.values(world.relationships)
    .filter((relationship) => relationship.characterIds.includes(actor.id) && ['friend', 'acquaintance'].includes(relationship.kind))
    .map((relationship) => ({ relationship, person: world.characters[relationship.characterIds.find((id) => id !== actor.id)!] }))
    .filter((item) => item.person?.isAlive)
    .slice(0, 4);

  const chooseFocus = async (focus: FocusArea) => {
    const next = [focus, ...actor.focuses.filter((item) => item !== focus)].slice(0, 3);
    await setFocus(next);
  };

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Growing up" title="School" subtitle="Grades matter, but they are not the only thing happening here. Friends, confidence, interests, habits, and skills all leave fingerprints." />

      {school ? <Card accent>
        <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{school.level}</Heading><Body secondary>Harborview Academy · age {age}</Body></View><StatusPill tone={school.recordedGrade >= 80 ? 'success' : school.recordedGrade >= 65 ? 'accent' : 'warning'}>{gradeLabel(school.recordedGrade)}</StatusPill></View>
        <View style={styles.stats}><Stat label="Grade" value={Math.round(school.recordedGrade).toString()} /><Stat label="Knowledge" value={Math.round(actor.knowledge).toString()} /><Stat label="Discipline" value={Math.round(actor.discipline).toString()} /><Stat label="Fitness" value={Math.round(actor.fitness).toString()} /></View>
        <View style={{ gap: 7 }}><View style={styles.row}><Body>Academic standing</Body><Body secondary>{Math.round(school.recordedGrade)}/100</Body></View><ProgressBar value={school.recordedGrade} tone={school.recordedGrade >= 70 ? 'success' : 'legacy'} /></View>
      </Card> : <Card><Heading size="small">School has not started yet</Heading><Body secondary>Formal school begins around age five. Until then, family, health, and curiosity are doing most of the teaching.</Body></Card>}

      {school ? <View style={styles.section}>
        <SectionHeader title="What are you leaning into?" />
        <Body secondary>These become standing priorities, so they keep influencing ordinary weeks when you fast-forward.</Body>
        {schoolFocus.map((option) => {
          const selected = actor.focuses.includes(option.focus);
          return <Pressable key={option.focus} onPress={() => { void chooseFocus(option.focus); }} style={({ pressed }) => [styles.choice, { backgroundColor: selected ? colors.accentSoft : colors.surface, borderColor: selected ? colors.accent : colors.border, opacity: pressed ? 0.75 : 1 }]}><Text style={styles.emoji}>{option.icon}</Text><View style={{ flex: 1, gap: 3 }}><Heading size="small">{option.title}</Heading><Body secondary>{option.detail}</Body></View><StatusPill tone={selected ? 'accent' : 'neutral'}>{selected ? 'Focus' : 'Choose'}</StatusPill></Pressable>;
        })}
        <EngineActionButton title="Put in a real study session" action={{ verb: 'education.study', targetIds: school ? [school.id] : [], parameters: {} }} tone="accent" />
      </View> : null}

      <View style={styles.section}>
        <SectionHeader title="People at school" action={<StatusPill>{peers.length}</StatusPill>} />
        {peers.length === 0 ? <Card><Heading size="small">Still finding your people</Heading><Body secondary>Classmates and friends start appearing as childhood moves forward. The ones who stick around can matter years later.</Body></Card> : peers.map(({ relationship, person }) => <Card key={relationship.id}>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{person.firstName} {person.lastName}</Heading><Body secondary>{relationship.kind} · trust {Math.round(relationship.trust)} · affection {Math.round(relationship.affection)}</Body></View><StatusPill tone={relationship.affection >= 60 ? 'success' : 'accent'}>{relationship.affection >= 60 ? 'Close' : 'Around'}</StatusPill></View>
          <View style={styles.actions}><EngineActionButton title="Hang out" action={{ verb: 'relationship.spend_time', targetIds: [person.id], parameters: {} }} tone="accent" style={{ flex: 1 }} /><EngineActionButton title="Talk" action={{ verb: 'relationship.contact', targetIds: [person.id], parameters: {} }} style={{ flex: 1 }} /></View>
        </Card>)}
      </View>

      {age >= 15 ? <Card><Heading size="small">🎓 The next step is getting real</Heading><Body secondary>College and training applications are starting to open. Grades help, but knowledge, reputation, money, and the rest of your life still matter.</Body></Card> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  choice: { minHeight: 92, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 14, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emoji: { fontSize: 26 },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
