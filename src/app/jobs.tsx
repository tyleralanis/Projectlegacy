import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { OtherActionComposer } from '@/components/OtherActionComposer';
import { WORLD_CONTENT } from '@/content/worldContent';
import { employerNameForProfession, professionSkillSnapshot } from '@/engine/careerApplicationBridge';
import { careerCompetencies, competency, competencyLabel, effectiveCareerCompetence } from '@/engine/competencies';
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
  const currentEmployer = current ? world.organizations[current.employerId] : undefined;
  const coworkers = current ? Object.values(world.relationships)
    .filter((relationship) => relationship.kind === 'professional' && relationship.characterIds.includes(actor.id))
    .map((relationship) => ({ relationship, person: world.characters[relationship.characterIds.find((id) => id !== actor.id)!] }))
    .filter(({ person }) => person?.isAlive && Object.values(world.careers).some((career) => career.characterId === person.id && career.active && career.employerId === current.employerId))
    .slice(0, 6) : [];
  const currentSkills = current ? careerCompetencies(current).map((key) => ({ key, label: competencyLabel(key), value: competency(world, actor.id, key) })) : [];
  const competence = current ? effectiveCareerCompetence(world, current) : 0;
  const manager = current?.managerId ? world.characters[current.managerId] : undefined;
  const sportsCareer = current && (current.sector === 'Sports' || /athlete/i.test(current.title)) ? current : undefined;
  const sportsInjury = Object.values(world.memories).find((memory) => memory.unresolved && memory.participantIds.includes(actor.id) && memory.category.startsWith('Health · Sports injury'));
  const retiredAthlete = Object.values(world.memories).find((memory) => memory.participantIds.includes(actor.id) && memory.category === 'Athletics · Retired professional');

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Work" title="Career" subtitle="A job is an organization full of people, power, skill, politics, money, responsibility, burnout, and exits. Time is part of the compensation package now too." />
      <Card accent>
        <SectionHeader title="Your resume" action={<StatusPill tone="accent">Age {age}</StatusPill>} />
        <View style={styles.stats}><Stat label="Knowledge" value={Math.round(actor.knowledge).toString()} /><Stat label="Reputation" value={Math.round(actor.reputation.professional).toString()} /><Stat label="Experience" value={`${Math.floor(experienceWeeks / 52)}y`} /><Stat label="Degree" value={degree ? 'Yes' : 'No'} /></View>
      </Card>

      {current ? <View style={styles.section}>
        <SectionHeader title="Current role" action={<StatusPill tone={current.satisfaction >= 65 ? 'success' : current.satisfaction < 40 ? 'warning' : 'accent'}>{Math.floor(current.weeksInRole / 52)}y {current.weeksInRole % 52}w</StatusPill>} />
        <Card>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{current.title}</Heading><Body secondary>{currentEmployer?.name ?? current.department ?? current.sector} · {formatMoney(current.weeklySalaryCents * 52, true)}/yr · {current.hoursPerWeek ?? 40}h/wk</Body></View><StatusPill tone={competence >= 72 ? 'success' : competence < 48 ? 'warning' : 'accent'}>Competence {Math.round(competence)}</StatusPill></View>
          <View style={styles.metric}><View style={styles.row}><Body>Performance</Body><Body secondary>{Math.round(current.performance)}/100</Body></View><ProgressBar value={current.performance} tone={current.performance >= 70 ? 'success' : 'accent'} /></View>
          <View style={styles.metric}><View style={styles.row}><Body>Internal standing</Body><Body secondary>{Math.round(current.organizationStanding ?? 48)}/100</Body></View><ProgressBar value={current.organizationStanding ?? 48} tone="legacy" /></View>
          <View style={styles.metric}><View style={styles.row}><Body>Promotion case</Body><Body secondary>{Math.round(current.promotionProgress ?? 0)}/100</Body></View><ProgressBar value={current.promotionProgress ?? 0} tone={(current.promotionProgress ?? 0) >= 70 ? 'success' : 'accent'} /></View>
          <View style={styles.metric}><View style={styles.row}><Body>Satisfaction</Body><Body secondary>{Math.round(current.satisfaction)}/100</Body></View><ProgressBar value={current.satisfaction} tone={current.satisfaction >= 60 ? 'legacy' : 'danger'} /></View>
          <View style={styles.skillWrap}>{currentSkills.map((skill) => <StatusPill key={skill.key} tone={skill.value >= 70 ? 'success' : skill.value < 45 ? 'warning' : 'neutral'}>{skill.label} {Math.round(skill.value)}</StatusPill>)}</View>
          {manager ? <Body secondary>Mentor / sponsor: {manager.firstName} {manager.lastName}. That relationship can help your career, but it is still a relationship with its own trust and resentment.</Body> : null}

          <Card accent>
            <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">Your work week is negotiable</Heading><Body secondary>Fewer hours can buy back real time for health, family, school, companies, or simply having a life. The organization can say no, and successful negotiation usually costs pay or promotion velocity.</Body></View><StatusPill tone={(current.hoursPerWeek ?? 40) > 40 ? 'warning' : (current.hoursPerWeek ?? 40) < 40 ? 'success' : 'accent'}>{current.hoursPerWeek ?? 40}h</StatusPill></View>
            <View style={styles.actions}>
              {[20, 32, 40, 50].map((hours) => <EngineActionButton key={hours} title={`${hours}h / week`} action={{ verb: 'career.negotiate_hours', targetIds: [current.id], parameters: { hours } }} tone={(current.hoursPerWeek ?? 40) === hours ? 'accent' : 'neutral'} style={styles.actionButton} />)}
            </View>
          </Card>

          {sportsCareer ? <Card accent>
            <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">Professional sports life</Heading><Body secondary>Performance creates fame and money, but the body keeps a clock. Injuries, endorsements, retirement, and the next career all connect to this chapter.</Body></View><StatusPill tone={sportsInjury ? 'warning' : 'success'}>{sportsInjury ? 'Injured' : 'Active'}</StatusPill></View>
            {sportsInjury ? <Body secondary>{sportsInjury.narrative}</Body> : null}
            <View style={styles.actions}>
              <EngineActionButton title="Seek endorsement" action={{ verb: 'sports.sign_endorsement', targetIds: [sportsCareer.id], parameters: {} }} tone="accent" style={styles.actionButton} />
              {sportsInjury ? <EngineActionButton title="Protect recovery" action={{ verb: 'sports.recover', targetIds: [sportsCareer.id], parameters: {} }} style={styles.actionButton} /> : null}
              <EngineActionButton title="Retire from playing" action={{ verb: 'sports.retire', targetIds: [sportsCareer.id], parameters: {}, destructive: true }} tone="danger" style={styles.actionButton} />
            </View>
          </Card> : null}

          <View style={styles.actions}>
            <EngineActionButton title="Push hard" action={{ verb: 'career.work_hard', targetIds: [current.id], parameters: {} }} tone="accent" style={styles.actionButton} />
            <EngineActionButton title="Train skills" action={{ verb: 'career.train', targetIds: [current.id], parameters: {} }} style={styles.actionButton} />
            <EngineActionButton title="Take the lead" action={{ verb: 'career.take_lead', targetIds: [current.id], parameters: {} }} style={styles.actionButton} />
            <EngineActionButton title="Find a mentor" action={{ verb: 'career.find_mentor', targetIds: [current.id], parameters: {} }} style={styles.actionButton} />
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
        {coworkers.length === 0 ? <Card><Body secondary>Workplace relationships will start appearing as the world advances. Performance can open doors; people decide who gets invited through them.</Body></Card> : coworkers.map(({ relationship, person }) => <Card key={relationship.id}>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{person.firstName} {person.lastName}</Heading><Body secondary>Trust {Math.round(relationship.trust)} · respect {Math.round(relationship.respect)} · resentment {Math.round(relationship.resentment)}</Body></View><StatusPill tone={relationship.resentment >= 45 ? 'warning' : relationship.respect >= 65 ? 'success' : 'neutral'}>{relationship.resentment >= 45 ? 'Friction' : relationship.respect >= 65 ? 'Useful ally' : 'Coworker'}</StatusPill></View>
          <EngineActionButton title="Build an alliance" action={{ verb: 'career.build_alliance', targetIds: [person.id], parameters: {} }} />
        </Card>)}
      </View> : <Card><Heading size="small">Between jobs</Heading><Body secondary>You are currently unemployed. That can be temporary, deliberate, or the start of a completely different path.</Body></Card>}

      {retiredAthlete && !sportsCareer ? <Card accent><Heading size="small">The sport is still part of your résumé</Heading><Body secondary>{retiredAthlete.narrative}</Body><EngineActionButton title="Return as a professional coach" action={{ verb: 'sports.coach', targetIds: [], parameters: {} }} tone="accent" /></Card> : null}

      <View style={styles.section}>
        <SectionHeader title="This week's openings" action={<StatusPill>{listings.length}</StatusPill>} />
        {listings.map((job) => {
          const skill = professionSkillSnapshot(world, actor.id, job);
          const eligibleAge = age >= job.minimumAge;
          const eligibleDegree = !job.requiredDegree || degree;
          const eligibleKnowledge = actor.knowledge >= job.minKnowledge;
          const eligibleExperience = experienceWeeks >= job.minExperienceWeeks;
          const eligibleReputation = actor.reputation.professional >= job.minReputation;
          const eligibleSkill = skill.value >= skill.minimum;
          const eligible = eligibleAge && eligibleDegree && eligibleKnowledge && eligibleExperience && eligibleReputation && eligibleSkill;
          const employerName = employerNameForProfession(world, job);
          return (
            <Card key={job.id}>
              <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{job.title}</Heading><Body secondary>{employerName} · {job.sector} · about {formatMoney(job.weeklySalaryCents * 52, true)}/yr</Body></View><StatusPill tone={eligible ? 'success' : 'warning'}>{eligible ? 'Competitive' : 'Prereqs'}</StatusPill></View>
              <Body secondary>Age {job.minimumAge}+ · Knowledge {job.minKnowledge}+ · Reputation {job.minReputation}+ · {skill.label} {skill.minimum}+ · {job.requiredDegree ? 'Degree required' : 'Degree optional'} · {job.minExperienceWeeks ? `${Math.ceil(job.minExperienceWeeks / 52)}y experience` : 'Entry level'}</Body>
              <View style={styles.skillRequirement}><Body>{skill.label}</Body><Body secondary>{Math.round(skill.value)} / {skill.minimum}</Body></View>
              <ProgressBar value={Math.min(100, (skill.value / Math.max(1, skill.minimum)) * 75)} tone={eligibleSkill ? 'success' : 'legacy'} />
              <Body secondary>The competency bar is authoritative. A degree can open the door; it does not substitute for the underlying skill.</Body>
              <EngineActionButton title={eligible ? `Apply to ${employerName}` : 'Apply anyway'} action={{ verb: 'career.apply', targetIds: [], parameters: { professionId: job.id } }} tone={eligible ? 'accent' : 'neutral'} />
            </Card>
          );
        })}
        <Body secondary>Listings and employers refresh as the world moves. The same career can exist at different organizations instead of routing every life through one company.</Body>
      </View>

      <OtherActionComposer domains={['career']} placeholder="Another career move, schedule change, or sports transition…" />
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
  skillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  skillRequirement: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
});
