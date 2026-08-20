import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { competency } from '@/engine/competencies';
import { playerAgeYears } from '@/engine/createWorld';
import type { FocusArea } from '@/engine/types';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

const schoolFocus: { focus: FocusArea; icon: string; title: string; detail: string }[] = [
  { focus: 'Academics', icon: '📚', title: 'Study harder', detail: 'Protect grades and build academic skill. Discipline makes the time go further.' },
  { focus: 'Sport', icon: '🏀', title: 'Take sport seriously', detail: 'Build athletic skill, fitness, teammates, competition history, and a schedule that can get crowded fast.' },
  { focus: 'Networking', icon: '🫶', title: 'Be social', detail: 'Put energy into friends, classmates, and the people you may know for decades.' },
  { focus: 'Creative Work', icon: '🎸', title: 'Build something creative', detail: 'Music, art, writing, theater, tinkering, and other interests that can become real skills.' },
];

const sports = ['Basketball', 'Football', 'Soccer', 'Baseball', 'Track & Field', 'Tennis'] as const;

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
    .slice(0, 5);
  const academicSkill = competency(world, actor.id, 'academics');
  const communicationSkill = competency(world, actor.id, 'communication');
  const athleticSkill = competency(world, actor.id, 'athletics');

  const chooseFocus = async (focus: FocusArea) => {
    const next = [focus, ...actor.focuses.filter((item) => item !== focus)].slice(0, 3);
    await setFocus(next);
  };

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Growing up" title="School" subtitle="Grades matter, but they are not the only thing happening here. Friends, confidence, competition, interests, habits, mentors, and actual skills all leave fingerprints." />

      {school ? <Card accent>
        <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{school.level}</Heading><Body secondary>Harborview Academy · age {age}</Body></View><StatusPill tone={school.recordedGrade >= 80 ? 'success' : school.recordedGrade >= 65 ? 'accent' : 'warning'}>{gradeLabel(school.recordedGrade)}</StatusPill></View>
        <View style={styles.stats}><Stat label="Grade" value={Math.round(school.recordedGrade).toString()} /><Stat label="Academics" value={Math.round(academicSkill).toString()} /><Stat label="Communication" value={Math.round(communicationSkill).toString()} /><Stat label="Athletics" value={Math.round(athleticSkill).toString()} /></View>
        <View style={{ gap: 7 }}><View style={styles.row}><Body>Academic standing</Body><Body secondary>{Math.round(school.recordedGrade)}/100</Body></View><ProgressBar value={school.recordedGrade} tone={school.recordedGrade >= 70 ? 'success' : 'legacy'} /></View>
      </Card> : <Card><Heading size="small">School has not started yet</Heading><Body secondary>Formal school begins around age five. Until then, family, health, curiosity, and the adults around you are doing most of the teaching.</Body></Card>}

      {school ? <View style={styles.section}>
        <SectionHeader title="What are you leaning into?" />
        <Body secondary>These become standing priorities. They protect some parts of life when everything cannot fit, which means other parts can genuinely lose ground.</Body>
        {schoolFocus.map((option) => {
          const selected = actor.focuses.includes(option.focus);
          return <Pressable key={option.focus} onPress={() => { void chooseFocus(option.focus); }} style={({ pressed }) => [styles.choice, { backgroundColor: selected ? colors.accentSoft : colors.surface, borderColor: selected ? colors.accent : colors.border, opacity: pressed ? 0.75 : 1 }]}><Text style={styles.emoji}>{option.icon}</Text><View style={{ flex: 1, gap: 3 }}><Heading size="small">{option.title}</Heading><Body secondary>{option.detail}</Body></View><StatusPill tone={selected ? 'accent' : 'neutral'}>{selected ? 'Focus' : 'Choose'}</StatusPill></Pressable>;
        })}
        <EngineActionButton title="Put in a real study session" action={{ verb: 'education.study', targetIds: school ? [school.id] : [], parameters: {} }} tone="accent" />
      </View> : null}

      {school && age >= 8 ? <View style={styles.section}>
        <SectionHeader title="Athletics" action={<StatusPill tone={school.sport ? 'accent' : 'neutral'}>{school.sport ?? 'No main sport'}</StatusPill>} />
        <Card>
          <Body secondary>Athletics is a skill track, not a fitness button. Practice develops technique. Competition creates a record. Recognition can eventually become recruiting, scholarships, fame, or a professional career—but only if the underlying performance gets there.</Body>
          <View style={styles.stats}><Stat label="Skill" value={Math.round(athleticSkill).toString()} /><Stat label="Level" value={Math.round(school.athleticLevel ?? 0).toString()} /><Stat label="Recognition" value={Math.round(school.athleticRecognition ?? 0).toString()} /><Stat label="Fitness" value={Math.round(actor.fitness).toString()} /></View>
          <View style={styles.actions}>{sports.map((sport) => <EngineActionButton key={sport} title={sport} action={{ verb: 'sports.choose_sport', targetIds: [school.id], parameters: { sport } }} tone={school.sport === sport ? 'accent' : 'neutral'} style={styles.actionButton} />)}</View>
          <View style={styles.actions}><EngineActionButton title="Practice" action={{ verb: 'sports.practice', targetIds: [school.id], parameters: {} }} tone="accent" style={styles.actionButton} /><EngineActionButton title="Compete" action={{ verb: 'sports.compete', targetIds: [school.id], parameters: {} }} style={styles.actionButton} />{age >= 16 ? <EngineActionButton title="Chase scholarship" action={{ verb: 'education.sports_seek_scholarship', targetIds: [school.id], parameters: {} }} style={styles.actionButton} /> : null}</View>
        </Card>
      </View> : null}

      <View style={styles.section}>
        <SectionHeader title="People at school" action={<StatusPill>{peers.length}</StatusPill>} />
        {peers.length === 0 ? <Card><Heading size="small">Still finding your people</Heading><Body secondary>Classmates and friends start appearing as childhood moves forward. The ones who stick around can matter years later.</Body></Card> : peers.map(({ relationship, person }) => <Card key={relationship.id}>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{person.firstName} {person.lastName}</Heading><Body secondary>{relationship.kind} · trust {Math.round(relationship.trust)} · affection {Math.round(relationship.affection)}</Body></View><StatusPill tone={relationship.affection >= 60 ? 'success' : 'accent'}>{relationship.affection >= 60 ? 'Close' : 'Around'}</StatusPill></View>
          <View style={styles.actions}><EngineActionButton title="Hang out" action={{ verb: 'relationship.spend_time', targetIds: [person.id], parameters: {} }} tone="accent" style={styles.actionButton} /><EngineActionButton title="Talk" action={{ verb: 'relationship.contact', targetIds: [person.id], parameters: {} }} style={styles.actionButton} /></View>
        </Card>)}
      </View>

      {age >= 15 ? <Card><Heading size="small">🎓 The next step is getting real</Heading><Body secondary>College, training, work, scholarships, and other routes are starting to open. Grades help, but competence, network, reputation, money, health, and the rest of your life still matter.</Body></Card> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  choice: { minHeight: 92, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 14, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emoji: { fontSize: 26 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: { flexGrow: 1, flexBasis: 120 },
});