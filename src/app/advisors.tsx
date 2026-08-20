import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { ADVISOR_OPTIONS } from '@/content/lifeCatalogs';
import { formatMoney, netWorthCents } from '@/engine/money';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

export default function AdvisorsScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const worth = netWorthCents(world);
  const retained = Object.values(world.organizations).filter((organization) => organization.kind === 'professional' && organization.memberIds.includes(actor.id));

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Money" title="Your team" subtitle="At some point wealth becomes an administration problem. Advisors are always available to approach, but good help is expensive." />
      <Card accent><View style={styles.stats}><Stat label="Net worth" value={formatMoney(worth, true)} tone="legacy" /><Stat label="Cash" value={formatMoney(actor.cashCents, true)} /><Stat label="Retained pros" value={retained.length.toString()} /></View></Card>

      {retained.length > 0 ? <View style={styles.section}>
        <SectionHeader title="Retained" />
        {retained.map((organization) => {
          const professional = organization.leaderId ? world.characters[organization.leaderId] : undefined;
          return <Card key={organization.id}><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{organization.name}</Heading><Body secondary>{professional ? `${professional.firstName} ${professional.lastName}` : 'Professional team'} · quality {Math.round(organization.influence)}/100</Body></View><StatusPill tone="success">Active</StatusPill></View></Card>;
        })}
      </View> : null}

      <View style={styles.section}>
        <SectionHeader title="Hire help" />
        {ADVISOR_OPTIONS.map((advisor) => {
          const already = retained.some((organization) => organization.name.toLowerCase().includes(advisor.role.toLowerCase()));
          const financiallyReady = worth >= advisor.minimumNetWorthCents && actor.cashCents >= advisor.annualCostCents;
          const action = advisor.id === 'wealth-manager'
            ? { verb: 'markets.hire_wealth_manager', targetIds: [], parameters: { amountCents: advisor.annualCostCents } }
            : advisor.id === 'attorney'
              ? { verb: 'legal.hire_private_counsel', targetIds: [], parameters: { amountCents: advisor.annualCostCents } }
              : { verb: 'organization.hire_advisor', targetIds: [], parameters: { role: advisor.role, amountCents: advisor.annualCostCents } };
          return (
            <Card key={advisor.id}>
              <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{advisor.role}</Heading><Body secondary>{advisor.benefit}</Body></View><StatusPill tone={already ? 'success' : financiallyReady ? 'accent' : 'warning'}>{already ? 'Retained' : `${formatMoney(advisor.annualCostCents, true)}/yr`}</StatusPill></View>
              <Body secondary>Typical wealth threshold: {formatMoney(advisor.minimumNetWorthCents, true)}. You can still try earlier if you have the cash, but it may be a ridiculous use of money.</Body>
              {!already ? <EngineActionButton title={`Hire ${advisor.role.toLowerCase()}`} action={action} tone={financiallyReady ? 'accent' : 'neutral'} /> : null}
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
