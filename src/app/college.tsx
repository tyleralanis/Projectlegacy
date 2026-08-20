import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { WORLD_CONTENT } from '@/content/worldContent';
import { formatMoney } from '@/engine/money';
import { getTuitionBalance } from '@/engine/supplementalDepth';
import { getTrackMemory } from '@/engine/trackDepth';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

const majors = ['Finance', 'Computer Science', 'Engineering', 'Law & Policy', 'Business'] as const;

export default function CollegeScreen() {
  const { world } = useGame();
  const { colors } = useAppTheme();
  const [sportsOpen, setSportsOpen] = useState(false);
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const records = Object.values(world.education).filter((record) => record.characterId === actor.id);
  const current = records.find((record) => ['accepted', 'higher', 'trade'].includes(record.status));
  const school = current ? WORLD_CONTENT.universities.find((item) => item.id === current.institutionId) : undefined;
  const tuitionBalance = current ? getTuitionBalance(world, current.id) : 0;
  const annualTuition = school?.tuitionCentsPerYear ?? current?.tuitionCentsPerYear ?? 0;
  const majorStory = getTrackMemory(world, 'Track · College major');
  const athleteStory = getTrackMemory(world, 'Track · Athlete development');
  const hasActiveJob = Object.values(world.careers).some((career) => career.characterId === actor.id && career.active);
  const campusClubs = Object.values(world.organizations).filter((organization) => organization.kind === 'club' && organization.memberIds.includes(actor.id) && !organization.history.some((entry) => entry.startsWith('gym-membership:')));

  if (sportsOpen) {
    return (
      <AppScreen>
        <SubviewHeader eyebrow="College" title="Sports" subtitle="Athletics can become a serious parallel track: train, compete, chase reputation and scholarships, or keep it casual and social." />
        <Pressable onPress={() => setSportsOpen(false)} style={[styles.inlineBack, { backgroundColor: colors.secondary }]}><Text style={[styles.inlineBackText, { color: colors.text }]}>‹ College menu</Text></Pressable>
        <Card accent>
          <View style={styles.stats}><Stat label="Fitness" value={Math.round(actor.fitness).toString()} /><Stat label="Health" value={Math.round(actor.health).toString()} /><Stat label="Discipline" value={Math.round(actor.discipline).toString()} /><Stat label="Public rep" value={Math.round(actor.reputation.public).toString()} /></View>
          {current ? <View style={{ gap: 7 }}><View style={styles.row}><Body>Academic standing</Body><Body secondary>{Math.round(current.recordedGrade)}/100</Body></View><ProgressBar value={current.recordedGrade} tone={current.recordedGrade >= 70 ? 'success' : 'legacy'} /></View> : null}
          {athleteStory ? <Body secondary>{athleteStory}</Body> : <Body secondary>Training enough to become competitive will cost time, stress, and a little academic bandwidth.</Body>}
        </Card>
        <Card><Heading size="small">Choose the level</Heading><Body secondary>Joining establishes how much of campus life revolves around sport.</Body><View style={styles.actions}><EngineActionButton title="Intramurals" action={{ verb: 'education.sports', targetIds: current ? [current.id] : [], parameters: { intensity: 'casual' } }} style={styles.actionButton} /><EngineActionButton title="Club team" action={{ verb: 'education.sports', targetIds: current ? [current.id] : [], parameters: { intensity: 'club' } }} style={styles.actionButton} /><EngineActionButton title="Varsity tryout" action={{ verb: 'education.sports', targetIds: current ? [current.id] : [], parameters: { intensity: 'varsity' } }} tone="accent" style={styles.actionButton} /></View></Card>
        <Card><Heading size="small">Develop as an athlete</Heading><View style={styles.actions}><EngineActionButton title="Train seriously" action={{ verb: 'education.sports_train', targetIds: current ? [current.id] : [], parameters: {} }} tone="accent" style={styles.actionButton} /><EngineActionButton title="Compete" action={{ verb: 'education.sports_compete', targetIds: current ? [current.id] : [], parameters: {} }} style={styles.actionButton} /><EngineActionButton title="Seek scholarship" action={{ verb: 'education.sports_seek_scholarship', targetIds: current ? [current.id] : [], parameters: {} }} style={styles.actionButton} /></View><Body secondary>Competition results become part of reputation and school history. Scholarship attempts depend on the athletic profile rather than a guaranteed button reward.</Body></Card>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Work" title="College" subtitle="College is now a whole chapter: choose a field, build faculty and peer networks, intern, join organizations, compete in sports, pay for it, or decide the credential is not worth the tradeoff." />

      {current ? (
        <Card accent>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{current.level}</Heading><Body secondary>{school?.name ?? current.institutionId}</Body></View><StatusPill tone={current.status === 'accepted' ? 'warning' : 'success'}>{current.status}</StatusPill></View>
          <View style={styles.stats}><Stat label="Grades" value={Math.round(current.recordedGrade).toString()} /><Stat label="Knowledge" value={Math.round(actor.knowledge).toString()} /><Stat label="Network" value={Math.round(current.network).toString()} /><Stat label="Tuition / yr" value={formatMoney(annualTuition, true)} /></View>
          {current.status === 'accepted' ? <>
            <Body secondary>Enrolling creates the first tuition bill. The game will not quietly pull tuition out of your cash every week.</Body>
            <EngineActionButton title="Enroll" action={{ verb: 'education.enroll', targetIds: [current.id], parameters: {} }} tone="accent" />
          </> : (
            <>
              <Card style={{ backgroundColor: colors.surface }}>
                <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">Tuition</Heading><Body secondary>Each academic year creates a bill. Pay it when you choose instead of having it silently deducted.</Body></View><StatusPill tone={tuitionBalance > 0 ? 'warning' : 'success'}>{tuitionBalance > 0 ? `${formatMoney(tuitionBalance, true)} due` : 'Paid'}</StatusPill></View>
                {tuitionBalance > 0 ? <View style={styles.actions}>
                  <EngineActionButton title="Pay $500" action={{ verb: 'education.pay_tuition', targetIds: [current.id], parameters: { amountCents: 50_000 } }} style={styles.actionButton} />
                  <EngineActionButton title="Pay balance" action={{ verb: 'education.pay_tuition', targetIds: [current.id], parameters: { amountCents: tuitionBalance } }} tone="accent" style={styles.actionButton} />
                </View> : <Body secondary>No tuition is currently due.</Body>}
              </Card>
              <View style={styles.actions}>
                <EngineActionButton title="Study" action={{ verb: 'education.study', targetIds: [current.id], parameters: {} }} tone="accent" style={styles.actionButton} />
                <EngineActionButton title="Office hours" action={{ verb: 'education.office_hours', targetIds: [current.id], parameters: {} }} style={styles.actionButton} />
                <EngineActionButton title="Go out" action={{ verb: 'education.party', targetIds: [current.id], parameters: {} }} style={styles.actionButton} />
              </View>
              <Pressable onPress={() => setSportsOpen(true)} style={[styles.menuButton, { borderColor: colors.border, backgroundColor: colors.secondary }]}><Text style={styles.menuEmoji}>🏀</Text><View style={{ flex: 1 }}><Heading size="small">Sports</Heading><Body secondary>Train, compete, chase scholarships, or keep it social.</Body></View><Text style={[styles.chevron, { color: colors.accent }]}>›</Text></Pressable>
              <EngineActionButton title="Drop out" action={{ verb: 'education.withdraw', targetIds: [current.id], parameters: {}, destructive: true }} tone="danger" />
            </>
          )}
        </Card>
      ) : <Card><Heading size="small">Not currently enrolled</Heading><Body secondary>Schools below weigh knowledge, reputation, and selectivity. An acceptance is not the same as enrollment.</Body></Card>}

      {current && current.status === 'higher' ? <View style={styles.section}>
        <SectionHeader title="Academic direction" action={<StatusPill tone={majorStory ? 'accent' : 'neutral'}>{majorStory ? current.level.replace('Undergraduate · ', '') : 'Undeclared'}</StatusPill>} />
        <Card>
          <Body secondary>A major changes the credential and the story around internships and future careers. It does not instantly grant competence.</Body>
          <View style={styles.actions}>{majors.map((major) => <EngineActionButton key={major} title={major} action={{ verb: 'education.choose_major', targetIds: [current.id], parameters: { major } }} tone={current.level.includes(major) ? 'accent' : 'neutral'} style={styles.actionButton} />)}</View>
          {majorStory ? <Body secondary>{majorStory.replace('major:', 'Declared direction: ')}</Body> : null}
        </Card>
      </View> : null}

      {current && ['higher', 'trade'].includes(current.status) ? <View style={styles.section}>
        <SectionHeader title="Campus & career capital" action={<StatusPill>{campusClubs.length} groups</StatusPill>} />
        <Card><Heading size="small">Build a world around the credential</Heading><Body secondary>Faculty, clubs, internships, and classmates can matter years after graduation. This is where prestige and actual network start separating from grades.</Body><View style={styles.actions}><EngineActionButton title="Join campus society" action={{ verb: 'education.join_club', targetIds: [current.id], parameters: { club: 'Campus Society' } }} style={styles.actionButton} />{current.status === 'higher' && !hasActiveJob ? <EngineActionButton title="Take an internship" action={{ verb: 'education.internship', targetIds: [current.id], parameters: {} }} tone="accent" style={styles.actionButton} /> : null}</View></Card>
        {campusClubs.slice(0, 4).map((club) => <Card key={club.id}><View style={styles.row}><Heading size="small">{club.name}</Heading><StatusPill tone="accent">Network</StatusPill></View><Body secondary>Influence {Math.round(club.influence)} · stability {Math.round(club.stability)}. This organization persists in the world after the semester ends.</Body></Card>)}
      </View> : null}

      {!current ? <View style={styles.section}>
        <SectionHeader title="Schools accepting applications" action={<StatusPill>{WORLD_CONTENT.universities.length}</StatusPill>} />
        {WORLD_CONTENT.universities.map((schoolOption) => {
          const city = WORLD_CONTENT.cities.find((item) => item.id === schoolOption.cityId);
          return (
            <Card key={schoolOption.id}>
              <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{schoolOption.name}</Heading><Body secondary>{city?.name ?? 'Unknown city'} · prestige {schoolOption.prestige} · network {schoolOption.network}</Body></View><StatusPill tone={actor.knowledge >= schoolOption.admissionKnowledge ? 'success' : 'warning'}>{formatMoney(schoolOption.tuitionCentsPerYear, true)}/yr</StatusPill></View>
              <Body secondary>Typical academic bar: knowledge {schoolOption.admissionKnowledge}+ · professional reputation {schoolOption.admissionReputation}+.</Body>
              <EngineActionButton title={`Apply to ${schoolOption.name}`} action={{ verb: 'education.apply', targetIds: [], parameters: { universityId: schoolOption.id } }} tone="accent" />
            </Card>
          );
        })}
      </View> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: { flexGrow: 1, flexBasis: 125 },
  menuButton: { minHeight: 72, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 12, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  menuEmoji: { fontSize: 24 },
  chevron: { fontSize: 30 },
  inlineBack: { alignSelf: 'flex-start', minHeight: 38, borderRadius: radius.pill, paddingHorizontal: 12, justifyContent: 'center' },
  inlineBackText: { fontSize: 13, fontWeight: '700' },
});
