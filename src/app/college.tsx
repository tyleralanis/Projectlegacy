import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { WORLD_CONTENT } from '@/content/worldContent';
import { competency } from '@/engine/competencies';
import { recurringScholarshipCents, tuitionForCurrentLoad } from '@/engine/financeEducationPolish';
import { formatMoney } from '@/engine/money';
import { getTuitionBalance } from '@/engine/supplementalDepthBridge';
import { getTrackMemory } from '@/engine/trackDepth';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

const majors = ['Finance', 'Computer Science', 'Engineering', 'Law & Policy', 'Business'] as const;
const minors = ['Economics', 'Finance', 'Computer Science', 'Political Science', 'Business'] as const;
const sports = ['Basketball', 'Football', 'Soccer', 'Baseball', 'Track & Field', 'Tennis'] as const;

export default function CollegeScreen() {
  const { world } = useGame();
  const { colors } = useAppTheme();
  const [sportsOpen, setSportsOpen] = useState(false);
  if (!world) return null;

  const actor = world.characters[world.playerCharacterId];
  const records = Object.values(world.education).filter((record) => record.characterId === actor.id);
  const current = records.find((record) => ['accepted', 'higher', 'trade'].includes(record.status));
  const secondary = records.find((record) => record.status === 'school');
  const school = current ? WORLD_CONTENT.universities.find((item) => item.id === current.institutionId) : undefined;
  const tuitionBalance = current ? getTuitionBalance(world, current.id) : 0;
  const annualTuition = school?.tuitionCentsPerYear ?? current?.tuitionCentsPerYear ?? 0;
  const annualScholarship = Math.max(current?.scholarshipCents ?? 0, recurringScholarshipCents(world));
  const currentLoadTuition = current ? tuitionForCurrentLoad(world, current.id) : 0;
  const netCurrentLoadTuition = Math.max(0, currentLoadTuition - annualScholarship);
  const partTimeNow = Boolean(secondary && current && ['higher', 'trade'].includes(current.status));
  const willStartPartTime = Boolean(secondary && current?.status === 'accepted');
  const enrolledWeeks = current?.startedWeek !== undefined ? Math.max(0, world.calendar.week - current.startedWeek) : 0;
  const expectedWeeks = current?.status === 'trade' ? 104 : 208;
  const graduationWeek = world.timeline
    .filter((entry) => entry.category === 'education' && entry.title === 'Graduation' && entry.subjectIds.includes(actor.id))
    .sort((left, right) => left.week - right.week)[0]?.week ?? actor.birthWeek + 18 * 52;
  const partTimeOverlap = current?.startedWeek !== undefined
    ? Math.max(0, Math.min(world.calendar.week, graduationWeek) - current.startedWeek)
    : 0;
  const equivalentProgramWeeks = Math.max(0, enrolledWeeks - Math.min(enrolledWeeks, partTimeOverlap) * 0.5);
  const completion = current && ['higher', 'trade'].includes(current.status)
    ? Math.min(100, (equivalentProgramWeeks / expectedWeeks) * 100)
    : 0;
  const majorStory = getTrackMemory(world, 'Track · College major');
  const athleteStory = getTrackMemory(world, 'Track · Athlete development');
  const hasActiveJob = Object.values(world.careers).some((career) => career.characterId === actor.id && career.active);
  const campusClubs = Object.values(world.organizations).filter(
    (organization) => organization.kind === 'club'
      && organization.memberIds.includes(actor.id)
      && !organization.history.some((entry) => entry.startsWith('gym-membership:')),
  );
  const academicMentor = current?.mentorId ? world.characters[current.mentorId] : undefined;
  const academicSkill = competency(world, actor.id, 'academics');
  const communicationSkill = competency(world, actor.id, 'communication');
  const athleticSkill = competency(world, actor.id, 'athletics');
  const studentLoanDebt = Object.values(world.liabilities)
    .filter((liability) => liability.debtorId === actor.id && liability.kind === 'student' && liability.annualRateBps > 0)
    .reduce((sum, liability) => sum + liability.principalCents, 0);
  const hasFamilyToAsk = actor.parentIds.some((id) => world.characters[id]?.isAlive);

  if (sportsOpen) {
    return (
      <AppScreen>
        <SubviewHeader
          eyebrow="College"
          title="Athletics"
          subtitle="Sport can be a social activity—or an entire parallel career with skill, competition, recruiting, recurring scholarships, fame, injuries, and professional interest."
        />
        <Pressable
          onPress={() => setSportsOpen(false)}
          style={[styles.inlineBack, { backgroundColor: colors.secondary }]}
        >
          <Text style={[styles.inlineBackText, { color: colors.text }]}>‹ College menu</Text>
        </Pressable>

        <Card accent>
          <View style={styles.stats}>
            <Stat label="Athletic skill" value={Math.round(athleticSkill).toString()} />
            <Stat label="Athletic level" value={Math.round(current?.athleticLevel ?? 0).toString()} />
            <Stat label="Recognition" value={Math.round(current?.athleticRecognition ?? 0).toString()} />
            <Stat label="Fitness" value={Math.round(actor.fitness).toString()} />
          </View>
          {current ? (
            <View style={styles.metric}>
              <View style={styles.row}>
                <Body>Academic standing</Body>
                <Body secondary>{Math.round(current.recordedGrade)}/100</Body>
              </View>
              <ProgressBar value={current.recordedGrade} tone={current.recordedGrade >= 70 ? 'success' : 'legacy'} />
            </View>
          ) : null}
          {annualScholarship > 0 ? (
            <Card style={{ backgroundColor: colors.surface }}>
              <View style={styles.row}>
                <Heading size="small">Scholarship</Heading>
                <StatusPill tone="success">{formatMoney(annualScholarship, true)}/yr</StatusPill>
              </View>
              <Body secondary>Scholarship support is committed recurring aid. It reduces tuition when an eligible academic year is funded; it does not become spendable cash or prepay tuition before enrollment.</Body>
            </Card>
          ) : null}
          <Body secondary>
            {current?.sport
              ? `${current.sport} is your current competitive sport.`
              : 'You have not committed to a specific competitive sport yet.'}
          </Body>
          <Body secondary>
            {athleteStory ?? 'Serious sport consumes real weekly time. Those hours cannot also be perfect grades, a full internship, a startup, and a packed social life.'}
          </Body>
        </Card>

        <Card>
          <Heading size="small">Choose the sport</Heading>
          <View style={styles.actions}>
            {sports.map((sport) => (
              <EngineActionButton
                key={sport}
                title={sport}
                action={{ verb: 'sports.choose_sport', targetIds: current ? [current.id] : [], parameters: { sport } }}
                tone={current?.sport === sport ? 'accent' : 'neutral'}
                style={styles.actionButton}
              />
            ))}
          </View>
        </Card>

        <Card>
          <Heading size="small">Develop the athletic career</Heading>
          <View style={styles.actions}>
            <EngineActionButton title="Practice" action={{ verb: 'sports.practice', targetIds: current ? [current.id] : [], parameters: {} }} tone="accent" style={styles.actionButton} />
            <EngineActionButton title="Compete" action={{ verb: 'sports.compete', targetIds: current ? [current.id] : [], parameters: {} }} style={styles.actionButton} />
            <EngineActionButton title="Seek scholarship" action={{ verb: 'education.sports_seek_scholarship', targetIds: current ? [current.id] : [], parameters: {} }} style={styles.actionButton} />
            <EngineActionButton title="Test pro interest" action={{ verb: 'sports.seek_agent', targetIds: current ? [current.id] : [], parameters: {} }} style={styles.actionButton} />
          </View>
          <Body secondary>Scholarships weigh athletic level, recognition, fitness, discipline, academics, and public profile. Professional interest requires elite ability and visibility.</Body>
        </Card>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <SubviewHeader
        eyebrow="Work"
        title="College"
        subtitle="A credential is one output. The deeper game is competence, professors, peers, projects, internships, sport, money, reputation, networks, and the other things competing for the same years."
      />

      {current ? (
        <Card accent>
          <View style={styles.row}>
            <View style={styles.flexGap}>
              <Heading>{current.level}</Heading>
              <Body secondary>{school?.name ?? current.institutionId}</Body>
            </View>
            <StatusPill tone={current.status === 'accepted' ? 'warning' : partTimeNow ? 'accent' : 'success'}>{current.status === 'accepted' ? 'accepted' : partTimeNow ? 'part-time' : current.status}</StatusPill>
          </View>
          <View style={styles.stats}>
            <Stat label="Grades" value={Math.round(current.recordedGrade).toString()} />
            <Stat label="Academic skill" value={Math.round(academicSkill).toString()} />
            <Stat label="Network" value={Math.round(current.network).toString()} />
            <Stat label="Current tuition load" value={formatMoney(netCurrentLoadTuition, true)} />
          </View>

          {current.status === 'accepted' ? (
            <Card style={{ backgroundColor: colors.surface }}>
              <View style={styles.row}>
                <View style={styles.flexGap}>
                  <Heading size="small">Finance enrollment first</Heading>
                  <Body secondary>No tuition debt is created just because you were accepted. Choose how the first academic year will actually be paid before enrollment begins.</Body>
                </View>
                <StatusPill tone="warning">Not enrolled</StatusPill>
              </View>
              <View style={styles.stats}>
                <Stat label="Sticker / yr" value={formatMoney(annualTuition, true)} />
                <Stat label={willStartPartTime ? 'Part-time load' : 'Current load'} value={formatMoney(currentLoadTuition, true)} />
                <Stat label="Scholarship / yr" value={formatMoney(annualScholarship, true)} tone={annualScholarship > 0 ? 'success' : 'default'} />
                <Stat label="Still to fund" value={formatMoney(netCurrentLoadTuition, true)} tone={netCurrentLoadTuition > 0 ? 'danger' : 'success'} />
              </View>
              <View style={styles.stats}>
                <Stat label="Liquid cash" value={formatMoney(Math.max(0, actor.cashCents), true)} />
                <Stat label="Student debt" value={formatMoney(studentLoanDebt, true)} tone={studentLoanDebt > 0 ? 'danger' : 'default'} />
              </View>
              {willStartPartTime ? <Body secondary>Secondary school is still active. Starting now is dual enrollment: college runs at half academic pace and half the normal tuition load until secondary graduation. If you graduate high school early, the college path can become full-time immediately.</Body> : <Body secondary>Secondary school is complete, so this can begin as a normal full-time postsecondary path.</Body>}
              <View style={styles.actions}>
                {hasFamilyToAsk && netCurrentLoadTuition > 0 ? <EngineActionButton title="Ask family for help" action={{ verb: 'education.ask_family_help', targetIds: [current.id], parameters: {} }} style={styles.actionButton} /> : null}
                <EngineActionButton title={annualScholarship > 0 ? 'Seek more athletic aid' : 'Seek athletic scholarship'} action={{ verb: 'education.sports_seek_scholarship', targetIds: [current.id], parameters: {} }} style={styles.actionButton} />
                {netCurrentLoadTuition <= 0 ? <EngineActionButton title="Enroll with aid" action={{ verb: 'education.enroll', targetIds: [current.id], parameters: { funding: 'scholarship' } }} tone="accent" style={styles.actionButton} /> : null}
                {netCurrentLoadTuition > 0 && actor.cashCents >= netCurrentLoadTuition ? <EngineActionButton title={`Pay ${formatMoney(netCurrentLoadTuition, true)} & enroll`} action={{ verb: 'education.enroll', targetIds: [current.id], parameters: { funding: 'cash' } }} tone="accent" style={styles.actionButton} /> : null}
                {netCurrentLoadTuition > 0 && actor.cashCents > 0 && actor.cashCents < netCurrentLoadTuition ? <EngineActionButton title="Use cash + student loan" action={{ verb: 'education.enroll', targetIds: [current.id], parameters: { funding: 'cash-and-loan' } }} tone="accent" style={styles.actionButton} /> : null}
                {netCurrentLoadTuition > 0 ? <EngineActionButton title={`Finance ${formatMoney(netCurrentLoadTuition, true)} with loan`} action={{ verb: 'education.enroll', targetIds: [current.id], parameters: { funding: 'student-loan' } }} style={styles.actionButton} /> : null}
              </View>
              <Body secondary>Family help becomes liquid cash first. Scholarships stay committed aid. Student loans become real debt. Enrollment only starts once one of those funding paths covers the current academic load.</Body>
            </Card>
          ) : (
            <>
              <Card style={{ backgroundColor: colors.surface }}>
                <View style={styles.row}>
                  <View style={styles.flexGap}>
                    <Heading size="small">Program progress</Heading>
                    <Body secondary>{Math.round((enrolledWeeks / 52) * 10) / 10} years elapsed · {Math.round((equivalentProgramWeeks / 52) * 10) / 10} full-time-equivalent years · typical {Math.round(expectedWeeks / 52)}-year path</Body>
                  </View>
                  <StatusPill tone={completion >= 75 ? 'success' : 'accent'}>{Math.round(completion)}%</StatusPill>
                </View>
                <ProgressBar value={completion} tone="accent" />
                <Body secondary>{partTimeNow ? 'College is currently progressing at half pace because secondary school is still active. Those weeks count, but not as a hidden full-time college schedule.' : 'Time enrolled is not the same as academic quality. A student can be near graduation with a weak record—or early with an exceptional one.'}</Body>
              </Card>

              <Card style={{ backgroundColor: colors.surface }}>
                <View style={styles.row}>
                  <View style={styles.flexGap}>
                    <Heading size="small">Tuition</Heading>
                    <Body secondary>Each academic year uses the current study load. Scholarships recur annually; funded student loans stay visible as debt instead of pretending tuition disappeared.</Body>
                  </View>
                  <StatusPill tone={tuitionBalance > 0 ? 'warning' : 'success'}>
                    {tuitionBalance > 0 ? `${formatMoney(tuitionBalance, true)} due` : 'Current tuition funded'}
                  </StatusPill>
                </View>
                <View style={styles.stats}>
                  <Stat label="Sticker / yr" value={formatMoney(annualTuition, true)} />
                  <Stat label={partTimeNow ? 'Part-time load' : 'Current load'} value={formatMoney(currentLoadTuition, true)} />
                  <Stat label="Scholarship / yr" value={formatMoney(annualScholarship, true)} tone={annualScholarship > 0 ? 'success' : 'default'} />
                  <Stat label="Net current load" value={formatMoney(netCurrentLoadTuition, true)} />
                </View>
                <View style={styles.stats}>
                  <Stat label="Student-loan debt" value={formatMoney(studentLoanDebt, true)} tone={studentLoanDebt > 0 ? 'danger' : 'default'} />
                  <Stat label="Liquid cash" value={formatMoney(Math.max(0, actor.cashCents), true)} />
                </View>
                {tuitionBalance > 0 ? (
                  <View style={styles.actions}>
                    {hasFamilyToAsk ? <EngineActionButton title="Ask family for help" action={{ verb: 'education.ask_family_help', targetIds: [current.id], parameters: {} }} style={styles.actionButton} /> : null}
                    <EngineActionButton title="Pay $500" action={{ verb: 'education.pay_tuition', targetIds: [current.id], parameters: { amountCents: 50_000 } }} style={styles.actionButton} />
                    <EngineActionButton title="Pay balance" action={{ verb: 'education.pay_tuition', targetIds: [current.id], parameters: { amountCents: tuitionBalance } }} tone="accent" style={styles.actionButton} />
                  </View>
                ) : (
                  <Body secondary>No tuition is due right now. Continuing into another academic year can create a new financing need after recurring aid is applied.</Body>
                )}
              </Card>

              <View style={styles.actions}>
                <EngineActionButton title="Study" action={{ verb: 'education.study', targetIds: [current.id], parameters: {} }} tone="accent" style={styles.actionButton} />
                <EngineActionButton title="Office hours" action={{ verb: 'education.office_hours', targetIds: [current.id], parameters: {} }} style={styles.actionButton} />
                <EngineActionButton title="Serious project" action={{ verb: 'education.research_project', targetIds: [current.id], parameters: {} }} style={styles.actionButton} />
                <EngineActionButton title="Go out" action={{ verb: 'education.party', targetIds: [current.id], parameters: {} }} style={styles.actionButton} />
              </View>

              <Pressable onPress={() => setSportsOpen(true)} style={[styles.menuButton, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                <Text style={styles.menuEmoji}>🏀</Text>
                <View style={styles.flexGap}>
                  <Heading size="small">Athletics</Heading>
                  <Body secondary>
                    {current.sport
                      ? `${current.sport} · level ${Math.round(current.athleticLevel ?? 0)} · recognition ${Math.round(current.athleticRecognition ?? 0)}${annualScholarship > 0 ? ` · ${formatMoney(annualScholarship, true)}/yr aid` : ''}`
                      : 'Choose a sport, train, compete, recruit, seek scholarships, and possibly go pro.'}
                  </Body>
                </View>
                <Text style={[styles.chevron, { color: colors.accent }]}>›</Text>
              </Pressable>

              <EngineActionButton title="Drop out" action={{ verb: 'education.withdraw', targetIds: [current.id], parameters: {}, destructive: true }} tone="danger" />
            </>
          )}
        </Card>
      ) : (
        <Card>
          <Heading size="small">Not currently enrolled</Heading>
          <Body secondary>Schools below weigh knowledge, reputation, and selectivity. Acceptance is not enrollment, and a degree is not competence.</Body>
        </Card>
      )}

      {current?.status === 'higher' ? (
        <View style={styles.section}>
          <SectionHeader title="Academic direction" action={<StatusPill tone={current.major ? 'accent' : 'neutral'}>{current.major ?? 'Undeclared'}</StatusPill>} />
          <Card>
            <Body secondary>Your major and minor shape what you repeatedly practice, which networks you build, and which future moves are plausible. They do not magically make you good at the work.</Body>
            <Heading size="small">Major</Heading>
            <View style={styles.actions}>
              {majors.map((major) => (
                <EngineActionButton
                  key={major}
                  title={major}
                  action={{ verb: 'education.choose_major', targetIds: [current.id], parameters: { major } }}
                  tone={current.major === major || current.level.includes(major) ? 'accent' : 'neutral'}
                  style={styles.actionButton}
                />
              ))}
            </View>
            <Heading size="small">Minor</Heading>
            <View style={styles.actions}>
              {minors.map((minor) => (
                <EngineActionButton
                  key={minor}
                  title={minor}
                  action={{ verb: 'education.add_minor', targetIds: [current.id], parameters: { minor } }}
                  tone={current.minor === minor ? 'accent' : 'neutral'}
                  style={styles.actionButton}
                />
              ))}
            </View>
            {majorStory ? <Body secondary>{majorStory.replace('major:', 'Declared direction: ')}</Body> : null}
          </Card>
        </View>
      ) : null}

      {current && ['higher', 'trade'].includes(current.status) ? (
        <View style={styles.section}>
          <SectionHeader title="Faculty, network & real work" action={<StatusPill>{campusClubs.length} groups</StatusPill>} />
          <Card>
            <Heading size="small">The people around the credential</Heading>
            <Body secondary>Professors, clubs, internships, classmates, and serious projects can matter decades later. This is where prestige and actual network separate from the diploma.</Body>
            <View style={styles.actions}>
              <EngineActionButton title={academicMentor ? `Mentor: ${academicMentor.firstName}` : 'Find academic mentor'} action={{ verb: 'education.find_mentor', targetIds: [current.id], parameters: {} }} style={styles.actionButton} />
              <EngineActionButton title="Join campus society" action={{ verb: 'education.join_club', targetIds: [current.id], parameters: { club: 'Campus Society' } }} style={styles.actionButton} />
              {current.status === 'higher' && !hasActiveJob ? (
                <EngineActionButton title="Take an internship" action={{ verb: 'education.internship', targetIds: [current.id], parameters: {} }} tone="accent" style={styles.actionButton} />
              ) : null}
            </View>
            {academicMentor ? <Body secondary>{academicMentor.firstName} {academicMentor.lastName} is now a persistent professional relationship that can survive graduation.</Body> : null}
          </Card>

          {campusClubs.slice(0, 4).map((club) => (
            <Card key={club.id}>
              <View style={styles.row}>
                <Heading size="small">{club.name}</Heading>
                <StatusPill tone="accent">Network</StatusPill>
              </View>
              <Body secondary>Influence {Math.round(club.influence)} · stability {Math.round(club.stability)}. This organization persists after the semester ends.</Body>
            </Card>
          ))}

          <Card>
            <Heading size="small">What is actually developing</Heading>
            <View style={styles.stats}>
              <Stat label="Academics" value={Math.round(academicSkill).toString()} />
              <Stat label="Communication" value={Math.round(communicationSkill).toString()} />
              <Stat label="Network" value={Math.round(current.network).toString()} />
              <Stat label="Grade" value={Math.round(current.recordedGrade).toString()} />
            </View>
            <Body secondary>Those numbers can diverge. A brilliant student can have a weak network. A connected student can have mediocre grades. An impressive degree can sit on top of ordinary competence.</Body>
          </Card>
        </View>
      ) : null}

      {!current ? (
        <View style={styles.section}>
          <SectionHeader title="Schools accepting applications" action={<StatusPill>{WORLD_CONTENT.universities.length}</StatusPill>} />
          {WORLD_CONTENT.universities.map((schoolOption) => {
            const cityOption = WORLD_CONTENT.cities.find((item) => item.id === schoolOption.cityId);
            return (
              <Card key={schoolOption.id}>
                <View style={styles.row}>
                  <View style={styles.flexGap}>
                    <Heading size="small">{schoolOption.name}</Heading>
                    <Body secondary>{cityOption?.name ?? 'Unknown city'} · prestige {schoolOption.prestige} · network {schoolOption.network}</Body>
                  </View>
                  <StatusPill tone={actor.knowledge >= schoolOption.admissionKnowledge ? 'success' : 'warning'}>{formatMoney(schoolOption.tuitionCentsPerYear, true)}/yr</StatusPill>
                </View>
                <Body secondary>Typical academic bar: knowledge {schoolOption.admissionKnowledge}+ · professional reputation {schoolOption.admissionReputation}+. Admission can open a network; it cannot guarantee what you do with it.</Body>
                <EngineActionButton title={`Apply to ${schoolOption.name}`} action={{ verb: 'education.apply', targetIds: [], parameters: { universityId: schoolOption.id } }} tone="accent" />
              </Card>
            );
          })}
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  flexGap: { flex: 1, gap: 3 },
  metric: { gap: 7 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: { flexGrow: 1, flexBasis: 125 },
  menuButton: { minHeight: 72, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 12, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  menuEmoji: { fontSize: 24 },
  chevron: { fontSize: 30 },
  inlineBack: { alignSelf: 'flex-start', minHeight: 38, borderRadius: radius.pill, paddingHorizontal: 12, justifyContent: 'center' },
  inlineBackText: { fontSize: 13, fontWeight: '700' },
});
