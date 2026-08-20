import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { WORLD_CONTENT } from '@/content/worldContent';
import { formatMoney } from '@/engine/money';
import { ceoCandidates } from '@/engine/supplementalDepth';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

export default function BusinessesScreen() {
  const { world } = useGame();
  const { colors } = useAppTheme();
  const [headhuntBusinessId, setHeadhuntBusinessId] = useState<string | null>(null);
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const businesses = Object.values(world.businesses).filter((business) => (business.ownerId ?? business.founderId) === actor.id && business.active && business.playerOwnershipBps > 0);
  const activeCareer = Object.values(world.careers).find((career) => career.characterId === actor.id && career.active);
  const ownerLed = businesses.filter((business) => !business.delegated);
  const headhuntBusiness = headhuntBusinessId ? world.businesses[headhuntBusinessId] : undefined;

  if (headhuntBusiness) {
    const candidates = ceoCandidates(world, headhuntBusiness);
    return (
      <AppScreen>
        <SubviewHeader eyebrow="Businesses" title="Headhunt a CEO" subtitle={`Pick who actually runs ${headhuntBusiness.name}. Better executives cost more, and industry fit matters.`} />
        <Pressable onPress={() => setHeadhuntBusinessId(null)} style={[styles.inlineBack, { backgroundColor: colors.secondary }]}><Text style={[styles.inlineBackText, { color: colors.text }]}>‹ Businesses</Text></Pressable>
        <Card accent><View style={styles.stats}><Stat label="Company cash" value={formatMoney(headhuntBusiness.cashCents, true)} /><Stat label="Value" value={formatMoney(headhuntBusiness.valuationCents, true)} tone="legacy" /><Stat label="Sector" value={headhuntBusiness.sector} /></View><Body secondary>The company needs at least twelve weeks of the CEO salary in cash. CEO pay then comes out of company cash as time advances.</Body></Card>
        <View style={styles.section}>
          <SectionHeader title="Available executives" action={<StatusPill>{candidates.length}</StatusPill>} />
          {candidates.map((candidate) => (
            <Card key={candidate.id}>
              <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{candidate.firstName} {candidate.lastName}</Heading><Body secondary>Overall fit {candidate.fitScore}/100 · {formatMoney(candidate.salaryWeeklyCents, true)}/week</Body></View><StatusPill tone={candidate.fitScore >= 80 ? 'success' : candidate.fitScore >= 68 ? 'accent' : 'warning'}>{candidate.fitScore >= 80 ? 'Strong fit' : candidate.fitScore >= 68 ? 'Credible' : 'Risky'}</StatusPill></View>
              <View style={styles.stats}><Stat label="Management" value={candidate.management.toString()} /><Stat label="Leadership" value={candidate.leadership.toString()} /><Stat label="Finance" value={candidate.finance.toString()} /><Stat label="Sector fit" value={candidate.sectorFit.toString()} /></View>
              <EngineActionButton title={`Hire ${candidate.firstName} · ${formatMoney(candidate.salaryWeeklyCents, true)}/wk`} action={{ verb: 'business.hire_ceo', targetIds: [headhuntBusiness.id], parameters: { firstName: candidate.firstName, lastName: candidate.lastName, salaryWeeklyCents: candidate.salaryWeeklyCents, management: candidate.management, leadership: candidate.leadership, finance: candidate.finance, sectorFit: candidate.sectorFit, fitScore: candidate.fitScore } }} tone="accent" />
            </Card>
          ))}
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Work" title="Businesses" subtitle="Ownership is not free time. Run one yourself, or hire leadership before stacking companies on top of a career." />
      <Card accent>
        <View style={styles.stats}><Stat label="Companies" value={businesses.length.toString()} /><Stat label="Owner-led" value={ownerLed.length.toString()} /><Stat label="Day job" value={activeCareer ? 'Yes' : 'No'} /><Stat label="Business rep" value={Math.round(actor.reputation.business).toString()} /></View>
        {ownerLed.length > 0 && activeCareer ? <Body secondary>You are balancing a day job with an owner-led company. Starting another company is blocked until you delegate or leave the job.</Body> : null}
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Start something" />
        <Body secondary>Each sector behaves differently. Starting capital comes from your personal cash, and owner-led companies consume a meaningful chunk of your week.</Body>
        <View style={styles.grid}>
          {WORLD_CONTENT.businessSectors.map((sector) => (
            <Card key={sector.id} style={styles.sectorCard}>
              <Heading size="small">{sector.name}</Heading>
              <Body secondary>Base capacity {sector.baseCapacity} · labor intensity {Math.round(sector.laborIntensity * 100)}%</Body>
              <EngineActionButton title={`Start with ${formatMoney(sector.startupCostCents, true)}`} action={{ verb: 'business.create', targetIds: [], parameters: { amountCents: sector.startupCostCents, sector: sector.name, name: `${actor.lastName} ${sector.name}` } }} tone="accent" />
            </Card>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Your companies" action={<StatusPill>{businesses.length}</StatusPill>} />
        {businesses.length === 0 ? <Card><Body secondary>No companies yet.</Body></Card> : businesses.map((business) => {
          const org = world.organizations[business.organizationId];
          const leader = org?.leaderId ? world.characters[org.leaderId] : undefined;
          const ceo = business.delegated && leader && leader.id !== actor.id ? leader : undefined;
          const overload = business.demand / Math.max(1, business.capacity);
          return (
            <Card key={business.id}>
              <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{business.name}</Heading><Body secondary>{business.sector} · {business.employees} employees · {business.delegated ? 'Professionally managed' : 'Owner-led'}</Body></View><StatusPill tone={business.cashCents > 0 ? 'success' : 'danger'}>{formatMoney(business.valuationCents, true)}</StatusPill></View>
              <View style={styles.stats}><Stat label="Weekly revenue" value={formatMoney(business.revenueWeeklyCents, true)} /><Stat label="Weekly cost" value={formatMoney(business.costWeeklyCents, true)} /><Stat label="Cash" value={formatMoney(business.cashCents, true)} tone={business.cashCents < 0 ? 'danger' : 'default'} /><Stat label="Ownership" value={`${(business.playerOwnershipBps / 100).toFixed(1)}%`} /></View>
              <View style={{ gap: 7 }}><View style={styles.row}><Body>Demand / capacity</Body><Body secondary>{Math.round(business.demand)} / {Math.round(business.capacity)}</Body></View><ProgressBar value={Math.min(100, overload * 70)} tone={overload > 1 ? 'danger' : 'success'} /></View>
              {ceo || business.managerName ? <Card accent><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">CEO · {ceo ? `${ceo.firstName} ${ceo.lastName}` : business.managerName}</Heading><Body secondary>Management quality {Math.round(business.managerQuality ?? (ceo ? (ceo.discipline + ceo.charisma + ceo.ambition) / 3 : 50))}/100 · salary {formatMoney(business.managerSalaryWeeklyCents ?? 0, true)}/week</Body></View><StatusPill tone="success">Delegated</StatusPill></View><Pressable onPress={() => setHeadhuntBusinessId(business.id)}><Body secondary>Replace or benchmark this CEO ›</Body></Pressable></Card> : <Pressable onPress={() => setHeadhuntBusinessId(business.id)} style={[styles.headhunt, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}><Text style={styles.headhuntEmoji}>🧠</Text><View style={{ flex: 1, gap: 2 }}><Heading size="small">Headhunt & hire a CEO</Heading><Body secondary>Compare salary, management, leadership, finance, and sector fit.</Body></View><Text style={[styles.chevron, { color: colors.accent }]}>›</Text></Pressable>}
              <View style={styles.actions}>
                <EngineActionButton title="Hire employee" action={{ verb: 'business.hire', targetIds: [business.id], parameters: { count: 1 } }} style={{ flex: 1 }} />
                <EngineActionButton title="Add $10k capital" action={{ verb: 'business.contribute_capital', targetIds: [business.id], parameters: { amountCents: 1_000_000 } }} style={{ flex: 1 }} />
                <EngineActionButton title="Borrow $25k" action={{ verb: 'business.borrow', targetIds: [business.id], parameters: { amountCents: 2_500_000 } }} style={{ flex: 1 }} />
              </View>
              <View style={styles.actions}>
                <EngineActionButton title="Value pricing" action={{ verb: 'business.set_price', targetIds: [business.id], parameters: { position: 'value' } }} style={{ flex: 1 }} />
                <EngineActionButton title="Market pricing" action={{ verb: 'business.set_price', targetIds: [business.id], parameters: { position: 'market' } }} style={{ flex: 1 }} />
                <EngineActionButton title="Premium pricing" action={{ verb: 'business.set_price', targetIds: [business.id], parameters: { position: 'premium' } }} style={{ flex: 1 }} />
              </View>
              <View style={styles.actions}>
                <EngineActionButton title="Marketing 5%" action={{ verb: 'business.advertise', targetIds: [business.id], parameters: { marketingBps: 500 } }} style={{ flex: 1 }} />
                <EngineActionButton title="Marketing 15%" action={{ verb: 'business.advertise', targetIds: [business.id], parameters: { marketingBps: 1500 } }} style={{ flex: 1 }} />
                <EngineActionButton title="Raise capital" action={{ verb: 'business.raise_capital', targetIds: [business.id], parameters: { equityBps: 1500 } }} style={{ flex: 1 }} />
              </View>
              <EngineActionButton title="Sell business" action={{ verb: 'business.sell', targetIds: [business.id], parameters: {}, destructive: true }} tone="danger" />
            </Card>
          );
        })}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grid: { gap: spacing.md },
  sectorCard: { gap: spacing.sm },
  inlineBack: { alignSelf: 'flex-start', minHeight: 38, borderRadius: radius.pill, paddingHorizontal: 12, justifyContent: 'center' },
  inlineBackText: { fontSize: 13, fontWeight: '700' },
  headhunt: { minHeight: 78, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 12, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headhuntEmoji: { fontSize: 26 },
  chevron: { fontSize: 30 },
});
