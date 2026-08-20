import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { WORLD_CONTENT } from '@/content/worldContent';
import { competency, effectiveBusinessCompetence } from '@/engine/competencies';
import { formatMoney } from '@/engine/money';
import { businessRunwayReserveCents, ceoCandidates, distributableBusinessCashCents } from '@/engine/supplementalDepthBridge';
import { getDeepTimeBudget } from '@/engine/timeSystem';
import { getTrackMemory } from '@/engine/trackDepth';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

function maturityTone(maturity: string): 'success' | 'accent' | 'warning' | 'neutral' {
  if (maturity === 'growing') return 'success';
  if (maturity === 'new') return 'accent';
  if (maturity === 'declining') return 'warning';
  return 'neutral';
}

function ceoTone(quality: number): 'success' | 'accent' | 'warning' | 'danger' {
  if (quality >= 80) return 'success';
  if (quality >= 65) return 'accent';
  if (quality >= 50) return 'warning';
  return 'danger';
}

function ceoLabel(quality: number): string {
  if (quality >= 90) return 'Elite operator';
  if (quality >= 80) return 'Strong operator';
  if (quality >= 65) return 'Capable operator';
  if (quality >= 50) return 'Inconsistent';
  return 'High risk';
}

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
  const timeBudget = getDeepTimeBudget(world);
  const businessSkill = effectiveBusinessCompetence(world, actor.id);

  if (headhuntBusiness) {
    const candidates = ceoCandidates(world, headhuntBusiness);
    return (
      <AppScreen>
        <SubviewHeader eyebrow="Businesses" title="Headhunt a CEO" subtitle={`Pick who actually runs ${headhuntBusiness.name}. A great operator should create money and absorb routine decisions; a bad one can burn the company down while you are not looking.`} />
        <Pressable onPress={() => setHeadhuntBusinessId(null)} style={[styles.inlineBack, { backgroundColor: colors.secondary }]}><Text style={[styles.inlineBackText, { color: colors.text }]}>‹ Businesses</Text></Pressable>
        <Card accent><View style={styles.stats}><Stat label="Company cash" value={formatMoney(headhuntBusiness.cashCents, true)} /><Stat label="Value" value={formatMoney(headhuntBusiness.valuationCents, true)} tone="legacy" /><Stat label="Complexity" value={Math.round(headhuntBusiness.complexity ?? 20).toString()} /><Stat label="Locations" value={(headhuntBusiness.locations ?? 1).toString()} /></View><Body secondary>The company needs at least twelve weeks of CEO salary in cash. Once hired, the CEO handles routine staffing, capacity, marketing adjustments, and expansion when capital permits. You keep ownership, the broad growth mandate, financing, distributions, acquisitions, and the power to replace them.</Body></Card>
        <View style={styles.section}>
          <SectionHeader title="Available executives" action={<StatusPill>{candidates.length}</StatusPill>} />
          {candidates.map((candidate) => (
            <Card key={candidate.id}>
              <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{candidate.firstName} {candidate.lastName}</Heading><Body secondary>Overall fit {candidate.fitScore}/100 · {formatMoney(candidate.salaryWeeklyCents, true)}/week</Body></View><StatusPill tone={candidate.fitScore >= 80 ? 'success' : candidate.fitScore >= 68 ? 'accent' : 'warning'}>{candidate.fitScore >= 80 ? 'Strong fit' : candidate.fitScore >= 68 ? 'Credible' : 'Risky'}</StatusPill></View>
              <View style={styles.stats}><Stat label="Management" value={candidate.management.toString()} /><Stat label="Leadership" value={candidate.leadership.toString()} /><Stat label="Finance" value={candidate.finance.toString()} /><Stat label="Sector fit" value={candidate.sectorFit.toString()} /></View>
              <Body secondary>{candidate.fitScore >= 80 ? 'This tier gets a large execution advantage and a much smaller quarterly failure chance.' : candidate.fitScore < 60 ? 'This hire is cheaper to tolerate than to trust. Weak execution can destroy runway, quality, and reputation.' : 'This candidate can run the company, but performance will still vary materially with complexity and capital.'}</Body>
              <EngineActionButton title={`Hire ${candidate.firstName} · ${formatMoney(candidate.salaryWeeklyCents, true)}/wk`} action={{ verb: 'business.hire_ceo', targetIds: [headhuntBusiness.id], parameters: { firstName: candidate.firstName, lastName: candidate.lastName, salaryWeeklyCents: candidate.salaryWeeklyCents, management: candidate.management, leadership: candidate.leadership, finance: candidate.finance, sectorFit: candidate.sectorFit, fitScore: candidate.fitScore } }} tone="accent" />
            </Card>
          ))}
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Work" title="Businesses" subtitle="Run the company yourself, or hire an executive and become the owner. A delegated company should feel like an asset with a management team, not another full-time menu of chores." />
      <Card accent>
        <View style={styles.stats}><Stat label="Companies" value={businesses.length.toString()} /><Stat label="Owner-led" value={ownerLed.length.toString()} /><Stat label="Day job" value={activeCareer ? 'Yes' : 'No'} /><Stat label="Business competence" value={Math.round(businessSkill).toString()} /></View>
        <View style={styles.skillWrap}><StatusPill>Management {Math.round(competency(world, actor.id, 'management'))}</StatusPill><StatusPill>Finance {Math.round(competency(world, actor.id, 'finance'))}</StatusPill><StatusPill>Sales {Math.round(competency(world, actor.id, 'sales'))}</StatusPill><StatusPill>Leadership {Math.round(competency(world, actor.id, 'leadership'))}</StatusPill><StatusPill>Negotiation {Math.round(competency(world, actor.id, 'negotiation'))}</StatusPill></View>
        {ownerLed.length > 0 && activeCareer ? <Body secondary>You are balancing a day job with an owner-led company. The universal time system will make the unprotected parts of life absorb the collision.</Body> : <Body secondary>When you hire a CEO, routine operating decisions move off your plate. Your remaining job is choosing the executive, setting the mandate, allocating owner capital, and deciding when to take money out.</Body>}
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Start something" />
        <Body secondary>Each sector begins small. The interesting part is what it becomes: products, locations, culture, management layers, customer loyalty, acquisitions, financing, and eventually succession.</Body>
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
          const ceoQuality = Math.round(business.managerQuality ?? (ceo ? (ceo.discipline + ceo.charisma + ceo.ambition) / 3 : 0));
          const overload = business.demand / Math.max(1, business.capacity);
          const rdStory = getTrackMemory(world, `Business · ${business.id} R&D`);
          const cultureStory = getTrackMemory(world, `Business · ${business.id} culture`);
          const managementStory = Object.values(world.memories).find((memory) => memory.category === `Business · ${business.id} management ceiling` && memory.unresolved);
          const products = (business.productLines ?? []).filter((product) => product.active);
          const businessCommitment = timeBudget.commitments.find((item) => item.id === `business:${business.id}`);
          const acquisitionTargets = Object.values(world.businesses).filter((target) => target.active && target.id !== business.id && (target.ownerId ?? target.founderId) !== actor.id && target.valuationCents > 0).sort((left, right) => left.valuationCents - right.valuationCents).slice(0, 3);
          const distributable = distributableBusinessCashCents(business);
          const reserve = businessRunwayReserveCents(business);
          const weeklyProfit = business.revenueWeeklyCents - business.costWeeklyCents - (business.delegated ? business.managerSalaryWeeklyCents ?? 0 : 0);

          return (
            <Card key={business.id}>
              <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{business.name}</Heading><Body secondary>{business.sector} · {business.employees} employees · {business.locations ?? 1} location{(business.locations ?? 1) === 1 ? '' : 's'} · {business.delegated ? 'CEO managed' : 'owner-led'}</Body></View><StatusPill tone={business.cashCents > 0 ? 'success' : 'danger'}>{formatMoney(business.valuationCents, true)}</StatusPill></View>
              <View style={styles.stats}><Stat label="Weekly revenue" value={formatMoney(business.revenueWeeklyCents, true)} /><Stat label="Weekly cost" value={formatMoney(business.costWeeklyCents + (business.delegated ? business.managerSalaryWeeklyCents ?? 0 : 0), true)} /><Stat label="Cash" value={formatMoney(business.cashCents, true)} tone={business.cashCents < 0 ? 'danger' : 'default'} /><Stat label="Weekly result" value={formatMoney(weeklyProfit, true)} tone={weeklyProfit < 0 ? 'danger' : 'success'} /></View>
              <View style={styles.stats}><Stat label="Market share" value={`${(business.marketShare ?? 0).toFixed(1)}%`} /><Stat label="Loyalty" value={Math.round(business.customerLoyalty ?? 50).toString()} /><Stat label="Culture" value={Math.round(business.culture ?? 50).toString()} /><Stat label="Your week" value={`${businessCommitment?.hours ?? business.personalTimeHours ?? 30}h`} /></View>
              <View style={{ gap: 7 }}><View style={styles.row}><Body>Demand / capacity</Body><Body secondary>{Math.round(business.demand)} / {Math.round(business.capacity)}</Body></View><ProgressBar value={Math.min(100, overload * 70)} tone={overload > 1 ? 'danger' : 'success'} /></View>
              {managementStory && !business.delegated ? <Card accent><Heading size="small">The company is outrunning the way it is managed</Heading><Body secondary>{managementStory.narrative}</Body></Card> : null}

              <Card accent>
                <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">Growth mandate</Heading><Body secondary>{business.delegated ? 'This is your instruction to the CEO. Management decides the routine hiring, capacity, marketing, and expansion moves needed to pursue it.' : 'As the operator, this posture changes how aggressively you push demand and capital into the company.'}</Body></View><StatusPill tone={business.growthPosture === 'aggressive' ? 'warning' : business.growthPosture === 'conservative' ? 'success' : 'accent'}>{business.growthPosture}</StatusPill></View>
                <View style={styles.actions}>
                  <EngineActionButton title="Conservative" action={{ verb: 'business.set_growth_posture', targetIds: [business.id], parameters: { posture: 'conservative' } }} style={styles.actionButton} />
                  <EngineActionButton title="Balanced" action={{ verb: 'business.set_growth_posture', targetIds: [business.id], parameters: { posture: 'balanced' } }} style={styles.actionButton} />
                  <EngineActionButton title="Aggressive" action={{ verb: 'business.set_growth_posture', targetIds: [business.id], parameters: { posture: 'aggressive' } }} tone="accent" style={styles.actionButton} />
                </View>
              </Card>

              <View style={styles.section}>
                <View style={styles.row}><Heading size="small">Products & services</Heading><StatusPill>{products.length} active</StatusPill></View>
                {products.map((product) => <Card key={product.id} style={{ backgroundColor: colors.surface }}>
                  <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{product.name}</Heading><Body secondary>{formatMoney(product.priceCents, true)} price · {formatMoney(product.unitCostCents, true)} unit cost</Body></View><StatusPill tone={maturityTone(product.maturity)}>{product.maturity}</StatusPill></View>
                  <View style={styles.stats}><Stat label="Quality" value={Math.round(product.quality).toString()} /><Stat label="Demand" value={Math.round(product.demand).toString()} /><Stat label="Reputation" value={Math.round(product.reputation).toString()} /><Stat label="Gross margin" value={`${Math.max(0, Math.round((1 - product.unitCostCents / Math.max(1, product.priceCents)) * 100))}%`} /></View>
                  {!business.delegated ? <View style={styles.actions}><EngineActionButton title="Improve · $12k" action={{ verb: 'business.improve_product', targetIds: [business.id, product.id], parameters: { productId: product.id, amountCents: 1_200_000 } }} tone="accent" style={styles.actionButton} />{products.length > 1 ? <EngineActionButton title="Retire" action={{ verb: 'business.retire_product', targetIds: [business.id, product.id], parameters: { productId: product.id }, destructive: true }} tone="danger" style={styles.actionButton} /> : null}</View> : null}
                </Card>)}
                {!business.delegated ? <EngineActionButton title="Launch another offering · $20k" action={{ verb: 'business.add_product', targetIds: [business.id], parameters: { amountCents: 2_000_000, name: `New ${business.sector} offering` } }} tone="accent" /> : <Body secondary>The CEO owns routine product execution. You will see the resulting quality, demand, reputation, cash, and failures here without having to press every operating button yourself.</Body>}
              </View>

              {business.delegated ? <Card accent>
                <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">CEO · {ceo ? `${ceo.firstName} ${ceo.lastName}` : business.managerName}</Heading><Body secondary>{ceoLabel(ceoQuality)} · quality {ceoQuality}/100 · salary {formatMoney(business.managerSalaryWeeklyCents ?? 0, true)}/week</Body></View><StatusPill tone={ceoTone(ceoQuality)}>{ceoQuality >= 80 ? 'Low failure risk' : ceoQuality < 50 ? 'Dangerous' : 'Delegated'}</StatusPill></View>
                <Body secondary>{ceoQuality >= 80 ? 'Strong management receives a substantial revenue and cost-execution advantage, maintains capacity ahead of demand, and has a much smaller chance of a bad quarter.' : ceoQuality < 50 ? 'Routine decisions are off your plate, but that is not necessarily good news. This executive can overhire, mishandle runway, damage quality, and eventually kill the company.' : 'Management handles routine staffing, capacity, marketing, and expansion. Results still depend on executive quality, complexity, the economy, and available capital.'}</Body>
                <View style={styles.actions}><Pressable onPress={() => setHeadhuntBusinessId(business.id)}><Body secondary>Replace / benchmark CEO ›</Body></Pressable><EngineActionButton title="Fire CEO" action={{ verb: 'business.fire_ceo', targetIds: [business.id], parameters: {}, destructive: true }} tone="danger" /></View>
              </Card> : <Pressable onPress={() => setHeadhuntBusinessId(business.id)} style={[styles.headhunt, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}><Text style={styles.headhuntEmoji}>🧠</Text><View style={{ flex: 1, gap: 2 }}><Heading size="small">Headhunt & hire a CEO</Heading><Body secondary>Compare salary, management, leadership, finance, and sector fit. A good hire should make the company more profitable and take routine decisions away from you.</Body></View><Text style={[styles.chevron, { color: colors.accent }]}>›</Text></Pressable>}

              {business.delegated ? <View style={styles.section}>
                <SectionHeader title="Owner cash" action={<StatusPill tone={distributable > 0 ? 'success' : 'neutral'}>{formatMoney(distributable, true)} available</StatusPill>} />
                <Body secondary>The company keeps about eight weeks of operating and CEO runway before cash is considered distributable. Your ownership percentage also limits what you can take.</Body>
                <View style={styles.stats}><Stat label="Protected runway" value={formatMoney(reserve, true)} /><Stat label="Distributable" value={formatMoney(distributable, true)} tone={distributable > 0 ? 'success' : 'default'} /></View>
                {distributable > 0 ? <View style={styles.actions}>
                  {distributable >= 1_000_000 ? <EngineActionButton title="Withdraw $10k" action={{ verb: 'business.withdraw_funds', targetIds: [business.id], parameters: { amountCents: 1_000_000 } }} style={styles.actionButton} /> : null}
                  <EngineActionButton title={`Withdraw excess · ${formatMoney(distributable, true)}`} action={{ verb: 'business.withdraw_funds', targetIds: [business.id], parameters: { amountCents: distributable } }} tone="accent" style={styles.actionButton} />
                </View> : <Body secondary>There is no safe owner distribution yet. Let the company build cash or improve profitability first.</Body>}
                <View style={styles.actions}><EngineActionButton title="Add $10k capital" action={{ verb: 'business.contribute_capital', targetIds: [business.id], parameters: { amountCents: 1_000_000 } }} style={styles.actionButton} /><EngineActionButton title="Borrow $25k" action={{ verb: 'business.borrow', targetIds: [business.id], parameters: { amountCents: 2_500_000 } }} style={styles.actionButton} /></View>
              </View> : <>
                <View style={styles.section}>
                  <Heading size="small">Capital allocation</Heading>
                  <View style={styles.actions}>
                    <EngineActionButton title="Quality · $10k" action={{ verb: 'business.invest_quality', targetIds: [business.id], parameters: { amountCents: 1_000_000 } }} tone="accent" style={styles.actionButton} />
                    <EngineActionButton title="R&D · $10k" action={{ verb: 'business.invest_rd', targetIds: [business.id], parameters: { amountCents: 1_000_000 } }} style={styles.actionButton} />
                    <EngineActionButton title="Staff bonuses · $5k" action={{ verb: 'business.reward_staff', targetIds: [business.id], parameters: { amountCents: 500_000 } }} style={styles.actionButton} />
                    <EngineActionButton title="New location · $50k" action={{ verb: 'business.expand_location', targetIds: [business.id], parameters: { amountCents: 5_000_000 } }} style={styles.actionButton} />
                  </View>
                  {rdStory ? <Body secondary>{rdStory}</Body> : null}
                  {cultureStory ? <Body secondary>{cultureStory}</Body> : null}
                </View>
                <View style={styles.actions}>
                  <EngineActionButton title="Hire employee" action={{ verb: 'business.hire', targetIds: [business.id], parameters: { count: 1 } }} style={styles.actionButton} />
                  <EngineActionButton title="Add $10k capital" action={{ verb: 'business.contribute_capital', targetIds: [business.id], parameters: { amountCents: 1_000_000 } }} style={styles.actionButton} />
                  <EngineActionButton title="Borrow $25k" action={{ verb: 'business.borrow', targetIds: [business.id], parameters: { amountCents: 2_500_000 } }} style={styles.actionButton} />
                </View>
                <View style={styles.actions}>
                  <EngineActionButton title="Value pricing" action={{ verb: 'business.set_price', targetIds: [business.id], parameters: { position: 'value' } }} style={styles.actionButton} />
                  <EngineActionButton title="Market pricing" action={{ verb: 'business.set_price', targetIds: [business.id], parameters: { position: 'market' } }} style={styles.actionButton} />
                  <EngineActionButton title="Premium pricing" action={{ verb: 'business.set_price', targetIds: [business.id], parameters: { position: 'premium' } }} style={styles.actionButton} />
                </View>
                <View style={styles.actions}>
                  <EngineActionButton title="Marketing 5%" action={{ verb: 'business.advertise', targetIds: [business.id], parameters: { marketingBps: 500 } }} style={styles.actionButton} />
                  <EngineActionButton title="Marketing 15%" action={{ verb: 'business.advertise', targetIds: [business.id], parameters: { marketingBps: 1500 } }} style={styles.actionButton} />
                  <EngineActionButton title="Raise capital" action={{ verb: 'business.raise_capital', targetIds: [business.id], parameters: { equityBps: 1500 } }} style={styles.actionButton} />
                </View>
              </>}

              {acquisitionTargets.length > 0 ? <View style={styles.section}>
                <Heading size="small">Acquisition market</Heading><Body secondary>Buying another company remains an owner-level decision. You inherit its people, products, capacity, customers, locations, and management complexity.</Body>
                {acquisitionTargets.map((target) => {
                  const estimatedPrice = Math.round(target.valuationCents * (1.08 + target.reputation / 800));
                  return <Card key={target.id} style={{ backgroundColor: colors.secondary }}><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{target.name}</Heading><Body secondary>{target.sector} · {target.employees} people · value {formatMoney(target.valuationCents, true)}</Body></View><StatusPill tone={business.cashCents >= estimatedPrice ? 'success' : 'warning'}>~{formatMoney(estimatedPrice, true)}</StatusPill></View><EngineActionButton title={`Acquire ${target.name}`} action={{ verb: 'business.acquire_company', targetIds: [business.id, target.id], parameters: {} }} tone={business.cashCents >= estimatedPrice ? 'accent' : 'neutral'} /></Card>;
                })}
              </View> : null}

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
  actionButton: { flexGrow: 1, flexBasis: 135 },
  grid: { gap: spacing.md },
  sectorCard: { gap: spacing.sm },
  inlineBack: { alignSelf: 'flex-start', minHeight: 38, borderRadius: radius.pill, paddingHorizontal: 12, justifyContent: 'center' },
  inlineBackText: { fontSize: 13, fontWeight: '700' },
  headhunt: { minHeight: 78, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 12, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headhuntEmoji: { fontSize: 26 },
  chevron: { fontSize: 30 },
  skillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
