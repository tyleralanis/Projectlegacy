import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { WORLD_CONTENT } from '@/content/worldContent';
import { playerAgeYears } from '@/engine/createWorld';
import { formatMoney } from '@/engine/money';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, SectionHeader, Stat, StatusPill } from '@/ui/components';
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
  const experienceWeeks = Object.values(world.careers).filter((career) => career.characterId === actor.id).reduce((sum, career) => sum + career.weeksInRole, 0);
  const degree = completedHigherEducation(world, actor.id);
  const current = Object.values(world.careers).find((career) => career.characterId === actor.id && career.active);
  const listings = listingsForWeek(world.calendar.week);

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Work" title="Job market" subtitle="Openings rotate every week. Meeting the minimums gets you considered; your resume still has to beat the other applicants." />
      <Card accent>
        <SectionHeader title="Your resume" action={<StatusPill tone="accent">Age {age}</StatusPill>} />
        <View style={styles.stats}><Stat label="Knowledge" value={Math.round(actor.knowledge).toString()} /><Stat label="Reputation" value={Math.round(actor.reputation.professional).toString()} /><Stat label="Experience" value={`${Math.floor(experienceWeeks / 52)}y`} /><Stat label="Degree" value={degree ? 'Yes' : 'No'} /></View>
        {current ? <Body secondary>Currently: {current.title} · {formatMoney(current.weeklySalaryCents * 52, true)}/yr</Body> : <Body secondary>You are currently unemployed.</Body>}
      </Card>

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
});
