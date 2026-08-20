import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { WORLD_CONTENT } from '@/content/worldContent';
import { playerAgeYears } from '@/engine/createWorld';
import { formatMoney } from '@/engine/money';
import { getTrackMemory } from '@/engine/trackDepth';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

function listingsForWeek(week: number) {
  const jobs = WORLD_CONTENT.professions;
  const offset = Math.floor(week) % jobs.length;
  const seen = new Set<string>();
  const listings = [] as typeof jobs[number][];
  for (let index = 0; index < jobs.length * 2 && listings.length < 6; index += 1) {
    const job = jobs[(offset + index * 5) % jobs.length];
    if (!seen.has(job.id)) { seen.add(job.id); listings.push(job); }
  }
  return listings;
}

function completedHigherEducation(world: NonNullable<ReturnType<typeof useGame>['world']>, actorId: string) {
  return Object.values(world.education).some((record) => record.characterId === actorId && record.status === 'completed' && record.level !== 'Secondary diploma');
}

export default function JobsScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const age = playerAgeYears(world);
  const careers = Object.values(world.careers).filter((career) => career.characterId === actor.id);
  const experienceWeeks = careers.reduce((sum, career) => sum + career.weeksInRole, 0);
  const degree = completedHigherEducation(world, actor.id);
  const current = careers.find((career) => career.active);
  const listings = listingsForWeek(world.calendar.week);
  const leverage = getTrackMemory(world, 'Career · Growing leverage');
  const networkStory = getTrackMemory(world, 'Track · Career network');
  const coworkers = current ? Object.values(world.relationships)
    .filter((relationship) => relationship.kind === 'professional' && relationship.characterIds.includes(actor.id))
    .map((relationship) => ({ relationship, person: world.characters[relationship.characterIds.find((id) => id !== actor.id)!] }))
    .filter(({ person }) => person?.isAlive && Object.values(world.careers).some((career) => career.characterId === person.id && career.active && career.employerId === current.employerId))
    .slice(0, 4) : [];

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Work" title="Career" subtitle="A job can become a long game: performance, skills, relationships, internal politics, reputation, pay, promotions, burnout, and exit choices all compound." />
      <Card accent>
        <SectionHeader title="Your resume" action={<StatusPill tone="accent">Age {age}</StatusPill>} />
        <View style={styles.stats}><Stat label="Knowledge" value={Math.round(actor.knowledge).toString()} /><Stat label="Reputation" value={Math.round(actor.reputation.professional).toString()} /><Stat label="Experience" value={`${Math.floor(experienceWeeks / 52)}y`} /><Stat label="Degree" value={degree ? 'Yes' : 'No'} /></View>
      </Card>

      {current ? <View style={styles.section}>
        <SectionHeader title="Current role" action={<StatusPill tone={current.satisfaction >= 65 ? 'success' : current.satisfaction < 40 ? 'warning' : 'accent'}>{Math.floor(current.weeksInRole / 52)}y {current.weeksInRole % 52}w</StatusPill>} />
        <Card>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{current.title}</Heading><Body secondary>{current.sector} · {formatMoney(current.weeklySalaryCents * 52, true)}/yr</Body></View><StatusPill tone={current.performance >= 75 ? 'success' : current.performance < 45 ? 'warning' : 'accent'}>Performance {Math.round(current.performance)}</StatusPill></View>
          <View style={styles.metric}><View style={styles.row}><Body>Performance</Body><Body secondary>{Math.round(current.performance)}/100</Body></View><ProgressBar value={current.performance} tone={current.performance >= 70 ? 'success' : 'accent'} /></View>
          <View style={styles.metric}><View style={styles.row}><Body>Satisfaction</Body><Body secondary>{Math.round(current.satisfaction)}/100</Body></View><ProgressBar value={current.satisfaction} tone={current.satisfaction >= 60 ? 'legacy' : 'danger'} /></View>
          <View style={styles.actions}>
            <EngineActionButton title="Push hard" action={{ verb: 'career.work_hard', targetIds: [current.id], parameters: {} }} tone="accent" style={styles.actionButton} />
            <EngineActionButton title="Train skills" action={{ verb: 'career.train', targetIds: [current.id], parameters: {} }} style={styles.actionButton} />
            <EngineActionButton title="Build network" action={{ verb: 'career.network', targetIds: [current.id], parameters: {} }} style={styles.actionButton} />
            <EngineActionButton title="Navigate office politics" action={{ verb: 'career.office_politics', targetIds: [current.id], parameters: {} }} style={styles.actionButton} />
            <EngineActionButton title="Push for promotion" action={{ verb: 'career.seek_promotion', targetIds: [current.id], parameters: {} }} tone="accent" style={styles.actionButton} />
            <EngineActionButton title="Ask for a raise" action={{ verb: 'career.request_raise', targetIds: [current.id], parameters: {} }} style={styles.actionButton} />
            <EngineActionButton title="Quit" action={{ verb: 'career.quit', targetIds: [current.id], parameters: {}, destructive: true }} tone="danger" style={styles.actionButton} />
          </View>
          {networkStory ? <Body secondary>{networkStory}</Body> : null}
          {leverage ? <Card accent><Heading size="small">Your leverage is changing</Heading><Body secondary>{leverage}</Body></Card> : null}
        </Card>

        <SectionHeader title="People around the job" action={<StatusPill>{coworkers.length}</StatusPill>} />
        {coworkers.length === 0 ? <Card><Body secondary>Workplace relationships will start appearing as the world advances.</Body></Card> : coworkers.map(({ relationship, person }) => <Card key={relationship.id}><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{person.firstName} {person.lastName}</Heading><Body secondary>Trust {Math.round(relationship.trust)} · respect {Math.round(relationship.respect)} · resentment {Math.round(relationship.resentment)}</Body></View><StatusPill tone={relationship.resentment >= 45 ? 'warning' : relationship.respect >= 65 ? 'success' : 'neutral'}>{relationship.resentment >= 45 ? 'Friction' : relationship.respect >= 65 ? 'Useful ally' : 'Coworker'}</StatusPill></View></Card>)}
      </View> : <Card><Heading size="small">Between jobs</Heading><Body secondary>You are currently unemployed. That can be temporary, deliberate, or the start of a completely different path.</Body></Card>}

      <View style={styles.section}>
        <SectionHeader title="This week's openings" action={<StatusPill>{listings.length}</StatusPill>} />
        {listings.map((job) => {
          const eligibleAge = age >= job.minimumAge;
          const eligibleDegree = !job.requiredDegree || degree;
          const eligibleKnowledge = actor.knowledge >= job.minKnowledge;
          const eligibleExperience = experienceWeeks >= job.minExperienceWeeks;
          const eligibleReputation = actor.reputation.professional >= job.minReputation;
          const eligible = eligibleAge && eligibleDegree && eligibleKnowledge && eligibleExperience && eligibleReputation;
          return (
            <Card key={job.id}>
              <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{job.title}</Heading><Body secondary>{job.sector} · {formatMoney(job.weeklySalaryCents * 52, true)}/yr</Body></View><StatusPill tone={eligible ? 'success' : 'warning'}>{eligible ? 'Competitive' : 'Prereqs'}</StatusPill></View>
              <Body secondary>Age {job.minimumAge}+ · Knowledge {job.minKnowledge}+ · Reputation {job.minReputation}+ · {job.requiredDegree ? 'Degree required' : 'Degree optional'} · {job.minExperienceWeeks ? `${Math.ceil(job.minExperienceWeeks / 52)}y experience` : 'Entry level'}</Body>
              <EngineActionButton title={eligible ? `Apply for ${job.title}` : 'Apply anyway'} action={{ verb: 'career.apply', targetIds: [], parameters: { professionId: job.id } }} tone={eligible ? 'accent' : 'neutral'} />
            </Card>
          );
        })}
        <Body secondary>Listings refresh automatically when the world advances into a new week.</Body>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  metric: { gap: 7 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: { flexGrow: 1, flexBasis: 130 },
});
