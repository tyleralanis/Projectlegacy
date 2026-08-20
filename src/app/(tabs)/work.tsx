import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { OtherActionComposer } from '@/components/OtherActionComposer';
import { playerAgeYears } from '@/engine/createWorld';
import { formatMoney } from '@/engine/money';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Eyebrow, Heading, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

export default function WorkScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const age = playerAgeYears(world);
  const education = Object.values(world.education).filter((record) => record.characterId === actor.id);
  const openEducation = education.find((record) => !['completed', 'withdrawn'].includes(record.status));
  const career = Object.values(world.careers).find((record) => record.characterId === actor.id && record.active);
  const businesses = Object.values(world.businesses).filter((business) => (business.ownerId ?? business.founderId) === actor.id && business.active && business.playerOwnershipBps > 0);
  const politics = world.politics[actor.id];
  const memberships = Object.values(world.organizations).filter((organization) => organization.memberIds.includes(actor.id));

  return (
    <AppScreen>
      <View style={styles.header}><View style={{ alignSelf: 'stretch', gap: 4 }}><Eyebrow>CAPABILITY & POWER</Eyebrow><Heading size="large">Work</Heading><Body secondary>School, career, business, organizations, and public office open as your life develops.</Body></View><StatusPill tone="accent">Knowledge {Math.round(actor.knowledge)}</StatusPill></View>

      <View style={styles.section}>
        <SectionHeader title="Education" />
        {education.length === 0 ? (
          <Card><Body secondary>{age < 5 ? 'Early childhood is shaped by family, health, play, and development. Formal school will begin later.' : 'No formal record yet. Education begins with age and context; competence can also grow outside credentials.'}</Body>{age >= 5 ? <EngineActionButton title="Prioritize learning" action={{ verb: 'education.study', targetIds: [], parameters: {} }} tone="accent" /> : null}</Card>
        ) : education.map((record) => (
          <Card key={record.id}>
            <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{record.level}</Heading><Body secondary>{world.organizations[record.institutionId]?.name ?? 'Independent program'}</Body></View><StatusPill tone={record.status === 'completed' ? 'success' : 'accent'}>{record.status}</StatusPill></View>
            <View style={styles.metric}><View style={styles.row}><Body>Recorded performance</Body><Body secondary>{Math.round(record.recordedGrade)}</Body></View><ProgressBar value={record.recordedGrade} /></View>
            <View style={styles.stats}><Stat label="Knowledge" value={Math.round(record.knowledgeGain).toString()} /><Stat label="Network" value={Math.round(record.network).toString()} /><Stat label="Prestige" value={Math.round(record.prestige).toString()} tone="legacy" /></View>
            {record.manipulatedCredential ? <StatusPill tone="warning">Credential exposure exists</StatusPill> : null}
            {record.status === 'accepted' ? <EngineActionButton title="Enroll in this program" action={{ verb: 'education.enroll', targetIds: [record.id], parameters: {} }} tone="accent" /> : null}
          </Card>
        ))}
        {!openEducation && education.length > 0 && age >= 16 ? <Card><Heading size="small">Another path remains possible</Heading><Body secondary>Admissions weigh your record, current knowledge, network, and the institution. An offer still requires enrollment.</Body><EngineActionButton title="Apply to a program" action={{ verb: 'education.apply', targetIds: [], parameters: {} }} tone="accent" /></Card> : null}
      </View>

      {age >= 14 ? <View style={styles.section}>
        <SectionHeader title="Career" />
        {career ? (
          <Card>
            <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{career.title}</Heading><Body secondary>{world.organizations[career.employerId]?.name ?? career.sector} · {career.weeksInRole} weeks</Body></View><StatusPill tone={career.satisfaction > 50 ? 'success' : 'warning'}>{career.satisfaction > 70 ? 'Fulfilling' : career.satisfaction > 45 ? 'Steady' : 'Strained'}</StatusPill></View>
            <View style={styles.stats}><Stat label="Weekly pay" value={formatMoney(career.weeklySalaryCents)} /><Stat label="Performance" value={Math.round(career.performance).toString()} /><Stat label="Satisfaction" value={Math.round(career.satisfaction).toString()} /></View>
            <View style={styles.actions}><EngineActionButton title="Request raise" action={{ verb: 'career.request_raise', targetIds: [career.id], parameters: {} }} tone="accent" style={{ flex: 1 }} /><EngineActionButton title="Apply elsewhere" action={{ verb: 'career.apply', targetIds: [], parameters: {} }} style={{ flex: 1 }} /><EngineActionButton title="Quit" action={{ verb: 'career.quit', targetIds: [career.id], parameters: {}, destructive: true }} tone="danger" style={{ flex: 1 }} /></View>
          </Card>
        ) : <Card><Heading size="small">No active job</Heading><Body secondary>Applications weigh competence, credentials, network, reputation, location, and the labor market.</Body><EngineActionButton title="Apply for work" action={{ verb: 'career.apply', targetIds: [], parameters: {} }} tone="accent" /></Card>}
      </View> : null}

      {age >= 16 ? <View style={styles.section}>
        <SectionHeader title="Businesses" action={<StatusPill>{businesses.length}</StatusPill>} />
        {businesses.length === 0 ? <Card accent><Heading size="small">Build something of your own</Heading><Body secondary>Demand, marketing, capacity, people, debt, quality, competition, and control are simulated separately.</Body><EngineActionButton title="Start with $5,000" action={{ verb: 'business.create', targetIds: [], parameters: { amountCents: 500_000, sector: 'Professional Services' } }} tone="accent" /></Card> : businesses.map((business) => (
          <Card key={business.id}>
            <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{business.name}</Heading><Body secondary>{business.sector} · {business.employees} employees · {business.delegated ? 'Delegated' : 'Owner-led'}</Body></View><StatusPill tone={business.cashCents > business.costWeeklyCents * 8 ? 'success' : 'warning'}>{business.cashCents > business.costWeeklyCents * 8 ? 'Funded' : 'Thin runway'}</StatusPill></View>
            <View style={styles.stats}><Stat label="Weekly revenue" value={formatMoney(business.revenueWeeklyCents, true)} /><Stat label="Cash" value={formatMoney(business.cashCents, true)} /><Stat label="Value" value={formatMoney(business.valuationCents, true)} tone="legacy" /><Stat label="Ownership" value={`${(business.playerOwnershipBps / 100).toFixed(1)}%`} /></View>
            <View style={styles.metric}><View style={styles.row}><Body>Demand / capacity</Body><Body secondary>{Math.round(business.demand)} / {Math.round(business.capacity)}</Body></View><ProgressBar value={(business.demand / Math.max(1, business.capacity)) * 60} tone={business.demand > business.capacity ? 'danger' : 'success'} /></View>
            <View style={styles.actions}><EngineActionButton title="Hire one" action={{ verb: 'business.hire', targetIds: [business.id], parameters: { count: 1 } }} style={{ flex: 1 }} /><EngineActionButton title="Marketing 10%" action={{ verb: 'business.advertise', targetIds: [business.id], parameters: { marketingBps: 1_000 } }} style={{ flex: 1 }} /><EngineActionButton title="Delegate" action={{ verb: 'business.delegate', targetIds: [business.id], parameters: {} }} tone="accent" style={{ flex: 1 }} /><EngineActionButton title="Sell business" action={{ verb: 'business.sell', targetIds: [business.id], parameters: {}, destructive: true }} tone="danger" style={{ flex: 1 }} /></View>
          </Card>
        ))}
      </View> : null}

      {age >= 18 ? <View style={styles.section}>
        <SectionHeader title="Politics & organizations" />
        <Card>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{politics?.office ?? politics?.campaign?.office ?? 'Private citizen'}</Heading><Body secondary>{politics?.campaign ? `${politics.campaign.weeksRemaining} weeks to election` : `${memberships.length} memberships · ${politics?.authority ?? 0} authority`}</Body></View>{politics?.campaign ? <StatusPill tone="warning">Campaigning</StatusPill> : politics?.office ? <StatusPill tone="success">In office</StatusPill> : <StatusPill>Political path</StatusPill>}</View>
          {politics?.campaign ? <EngineActionButton title="Add $1,000 to campaign" action={{ verb: 'politics.campaign_action', targetIds: [], parameters: { amountCents: 100_000 } }} tone="accent" /> : politics?.office ? <EngineActionButton title="Exercise policy authority" action={{ verb: 'politics.policy_action', targetIds: [], parameters: {} }} tone="accent" /> : <EngineActionButton title="Run for Harborview Council" action={{ verb: 'politics.run_for_office', targetIds: [], parameters: { office: 'Harborview Council', amountCents: 250_000 } }} tone="accent" />}
          {memberships.map((organization) => <View key={organization.id} style={styles.row}><Body>{organization.name}</Body><StatusPill>{organization.kind}</StatusPill></View>)}
        </Card>
      </View> : null}

      {age >= 14 ? <OtherActionComposer domains={['education', 'career', 'business', 'organization', 'politics']} placeholder="Start a company, apply for a role, raise capital, or join an organization…" /> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, alignItems: 'flex-start', paddingTop: 8 },
  section: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  metric: { gap: 7 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
