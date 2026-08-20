import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { ADVISOR_OPTIONS } from '@/content/lifeCatalogs';
import { formatMoney, netWorthCents } from '@/engine/money';
import type { IntentAction } from '@/engine/types';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

function actionForAdvisor(id: string, role: string, annualCostCents: number): IntentAction {
  if (id === 'wealth-manager') return { verb: 'markets.hire_wealth_manager', targetIds: [], parameters: { amountCents: annualCostCents } };
  if (id === 'attorney') return { verb: 'legal.hire_private_counsel', targetIds: [], parameters: { amountCents: annualCostCents } };
  if (id === 'family-office') return { verb: 'wealth.create_family_office', targetIds: [], parameters: { amountCents: annualCostCents } };
  return { verb: 'organization.hire_advisor', targetIds: [], parameters: { role, amountCents: annualCostCents } };
}

export default function AdvisorsScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const worth = netWorthCents(world);
  const retained = Object.values(world.organizations).filter((organization) => organization.kind === 'professional' && organization.memberIds.includes(actor.id));
  const annualRetainers = retained.reduce((total, organization) => {
    const normalized = organization.name.toLowerCase();
    const option = ADVISOR_OPTIONS.find((advisor) => normalized.includes(advisor.role.toLowerCase()));
    return total + (option?.annualCostCents ?? 0);
  }, 0);
  const familyOffice = retained.find((organization) => /family office/i.test(organization.name));

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Money" title="Your team" subtitle="At some point wealth becomes an administration problem. Good help buys back time and coordination, but retainers are real recurring expenses rather than one-time unlock fees." />
      <Card accent><View style={styles.stats}><Stat label="Net worth" value={formatMoney(worth, true)} tone="legacy" /><Stat label="Cash" value={formatMoney(actor.cashCents, true)} /><Stat label="Retained pros" value={retained.length.toString()} /><Stat label="Known retainers" value={`${formatMoney(annualRetainers, true)}/yr`} /></View></Card>

      {familyOffice ? <Card accent><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>🏛️ {familyOffice.name}</Heading><Body secondary>The fortune now has an institution coordinating reporting, advisors, entities, liquidity, administration, and succession. It lowers personal wealth-management time without making the important decisions disappear.</Body></View><StatusPill tone="success">Institutional</StatusPill></View></Card> : null}

      {retained.length > 0 ? <View style={styles.section}>
        <SectionHeader title="Retained" />
        {retained.map((organization) => {
          const professional = organization.leaderId ? world.characters[organization.leaderId] : undefined;
          const option = ADVISOR_OPTIONS.find((advisor) => organization.name.toLowerCase().includes(advisor.role.toLowerCase()));
          return <Card key={organization.id}><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{organization.name}</Heading><Body secondary>{professional && professional.id !== actor.id ? `${professional.firstName} ${professional.lastName}` : 'Professional team'} · quality {Math.round(organization.influence)}/100</Body></View><StatusPill tone="success">Active</StatusPill></View><Body secondary>{option ? `${formatMoney(option.annualCostCents, true)} annual retainer. It will be charged again when the next service year crosses.` : 'This professional relationship remains part of your network and administration.'}</Body></Card>;
        })}
      </View> : null}

      <View style={styles.section}>
        <SectionHeader title="Hire help" />
        {ADVISOR_OPTIONS.map((advisor) => {
          const already = advisor.id === 'family-office' ? Boolean(familyOffice) : retained.some((organization) => organization.name.toLowerCase().includes(advisor.role.toLowerCase()));
          const financiallyReady = worth >= advisor.minimumNetWorthCents && actor.cashCents >= advisor.annualCostCents;
          const action = actionForAdvisor(advisor.id, advisor.role, advisor.annualCostCents);
          return (
            <Card key={advisor.id} accent={advisor.id === 'family-office'}>
              <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{advisor.role}</Heading><Body secondary>{advisor.benefit}</Body></View><StatusPill tone={already ? 'success' : financiallyReady ? 'accent' : 'warning'}>{already ? 'Retained' : `${formatMoney(advisor.annualCostCents, true)}/yr`}</StatusPill></View>
              <Body secondary>Typical wealth threshold: {formatMoney(advisor.minimumNetWorthCents, true)}. This is an annual service relationship, not a permanent unlock purchased once.</Body>
              {!already ? <EngineActionButton title={advisor.id === 'family-office' ? 'Create family office' : `Hire ${advisor.role.toLowerCase()}`} action={action} tone={financiallyReady ? 'accent' : 'neutral'} /> : null}
            </Card>
          );
        })}
        <Card><Heading size="small">🏢 Property management</Heading><Body secondary>Property managers are hired per asset because a duplex and a forty-unit commercial portfolio are different jobs. Manage them from Property → Owned.</Body></Card>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
});
