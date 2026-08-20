import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { OtherActionComposer } from '@/components/OtherActionComposer';
import { innerCircleProfile } from '@/engine/factionDepth';
import { formatMoney } from '@/engine/money';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, ProgressBar, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

const archetypes = [
  { id: 'religious', label: 'Religious', detail: 'Doctrine, conversion, devotion, leader veneration, and household rules become central.' },
  { id: 'military', label: 'Military', detail: 'Cohesion and abstract security capacity become the main route toward raw political power.' },
  { id: 'political', label: 'Political', detail: 'Legitimacy, ideology, influence, public recognition, and institutional access matter most.' },
  { id: 'communal', label: 'Communal', detail: 'Land, mutual support, cohesion, shared life, and internal stability become the strongest branches.' },
  { id: 'commercial', label: 'Commercial', detail: 'Money, influence, legitimacy, and a resource-rich organization matter more than devotion.' },
] as const;

function ageOf(week: number, birthWeek: number): number {
  return Math.max(0, Math.floor((week - birthWeek) / 52));
}

function readiness(profile: NonNullable<ReturnType<typeof innerCircleProfile>>, factionReputation: number): number {
  return Math.min(100,
    Math.log10(Math.max(10, profile.followers)) * 10
    + profile.security * 0.3
    + profile.cohesion * 0.2
    + profile.influence * 0.18
    + factionReputation * 0.14
    + Math.min(12, Math.log10(Math.max(100, profile.resourcesCents / 100)) * 1.8)
    + (profile.archetype === 'military' ? 8 : profile.archetype === 'political' ? 4 : 0),
  );
}

export default function InnerCircleScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const profile = innerCircleProfile(world);

  if (!profile) {
    return (
      <AppScreen>
        <SubviewHeader eyebrow="Work & ambition" title="Nothing here" subtitle="This private path only exists in a save after you deliberately uncover it through another action." />
        <Card><Body secondary>There is no player-led private movement in this life.</Body></Card>
      </AppScreen>
    );
  }

  const organization = world.organizations[profile.organizationId];
  const country = world.countries[world.activeCountryId];
  const resistance = Math.min(100, country.stability * 0.34 + country.ruleOfLaw * 0.36 + country.marketAccess * 0.08 + country.educationIndex * 0.07 + 10);
  const movementReadiness = readiness(profile, actor.reputation.faction);
  const followers = organization.memberIds
    .filter((id) => id !== actor.id)
    .map((id) => world.characters[id])
    .filter((person) => person?.isAlive);
  const pluralSpouses = Object.values(world.relationships)
    .filter((relationship) => relationship.kind === 'spouse' && relationship.characterIds.includes(actor.id))
    .map((relationship) => ({ relationship, person: world.characters[relationship.characterIds.find((id) => id !== actor.id)!] }))
    .filter(({ person }) => person?.isAlive && person.id !== actor.partnerId);
  const spouseIds = new Set(Object.values(world.relationships)
    .filter((relationship) => relationship.kind === 'spouse' && relationship.characterIds.includes(actor.id))
    .map((relationship) => relationship.characterIds.find((id) => id !== actor.id)!));
  const eligiblePluralPartners = followers
    .filter((person) => ageOf(world.calendar.week, person.birthWeek) >= 18 && !spouseIds.has(person.id) && person.id !== actor.partnerId)
    .slice(0, 4);
  const history = organization.history.filter((entry) => !entry.startsWith('inner-circle:') && !entry.startsWith('milestone:')).slice(-8).reverse();
  const isReligious = profile.archetype === 'religious';
  const isMilitary = profile.archetype === 'military';
  const isPolitical = profile.archetype === 'political';
  const isCommunal = profile.archetype === 'communal';

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Private" title={profile.name} subtitle="This view only appears after the path is deliberately uncovered. The movement grows alongside the rest of the world rather than replacing it." />

      <Card accent>
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 4 }}><Heading>{profile.name}</Heading><Body secondary>{profile.archetype === 'undecided' ? 'No defining structure yet' : `${profile.archetype} movement`}</Body></View>
          <StatusPill tone={profile.publicStanding >= 60 ? 'success' : profile.publicStanding < 30 ? 'warning' : 'accent'}>{profile.followers.toLocaleString()} followers</StatusPill>
        </View>
        <View style={styles.stats}>
          <Stat label="Resources" value={formatMoney(profile.resourcesCents, true)} tone="legacy" />
          <Stat label="Influence" value={Math.round(profile.influence).toString()} />
          <Stat label="Stability" value={Math.round(profile.stability).toString()} />
          <Stat label="Public standing" value={Math.round(profile.publicStanding).toString()} />
        </View>
      </Card>

      <Card>
        <SectionHeader title="Inside the movement" />
        <View style={styles.metric}><View style={styles.row}><Body>Devotion</Body><Body secondary>{Math.round(profile.devotion)}/100</Body></View><ProgressBar value={profile.devotion} tone="legacy" /></View>
        <View style={styles.metric}><View style={styles.row}><Body>Cohesion</Body><Body secondary>{Math.round(profile.cohesion)}/100</Body></View><ProgressBar value={profile.cohesion} tone="success" /></View>
        <View style={styles.metric}><View style={styles.row}><Body>Doctrine</Body><Body secondary>{Math.round(profile.doctrine)}/100</Body></View><ProgressBar value={profile.doctrine} /></View>
        <View style={styles.metric}><View style={styles.row}><Body>Security capacity</Body><Body secondary>{Math.round(profile.security)}/100</Body></View><ProgressBar value={profile.security} tone="danger" /></View>
        <Body secondary>Security capacity is a fictional strategic stat. The game never models weapons, acquisition methods, tactical instructions, or operational violence.</Body>
      </Card>

      {profile.archetype === 'undecided' ? <View style={styles.section}>
        <SectionHeader title="What kind of movement is this?" />
        <Body secondary>This is a defining choice. It changes strengths and branches, and changing it later is intentionally not a simple toggle.</Body>
        {archetypes.map((option) => (
          <Card key={option.id}>
            <View style={styles.row}><View style={{ flex: 1, gap: 4 }}><Heading size="small">{option.label}</Heading><Body secondary>{option.detail}</Body></View></View>
            <EngineActionButton title={`Build a ${option.label.toLowerCase()} movement`} action={{ verb: 'faction.set_archetype', targetIds: [profile.organizationId], parameters: { archetype: option.id } }} tone="accent" />
          </Card>
        ))}
      </View> : null}

      <View style={styles.section}>
        <SectionHeader title="Grow the movement" />
        <Card>
          <View style={styles.actions}>
            <EngineActionButton title="Recruit followers" action={{ verb: 'faction.recruit', targetIds: [profile.organizationId], parameters: {} }} tone="accent" style={styles.button} />
            <EngineActionButton title="Hold a gathering · $250" action={{ verb: 'faction.hold_gathering', targetIds: [profile.organizationId], parameters: { amountCents: 25_000 } }} style={styles.button} />
            <EngineActionButton title="Collect contributions" action={{ verb: 'faction.collect_contributions', targetIds: [profile.organizationId], parameters: { pressure: 'normal' } }} style={styles.button} />
            <EngineActionButton title="Pressure for more money" action={{ verb: 'faction.collect_contributions', targetIds: [profile.organizationId], parameters: { pressure: 'aggressive' } }} tone="danger" style={styles.button} />
            <EngineActionButton title="Public influence · $3k" action={{ verb: 'faction.expand_public_influence', targetIds: [profile.organizationId], parameters: { amountCents: 300_000 } }} style={styles.button} />
            <EngineActionButton title="Member support · $2.5k" action={{ verb: 'faction.member_welfare', targetIds: [profile.organizationId], parameters: { amountCents: 250_000 } }} style={styles.button} />
            {!profile.landOwned ? <EngineActionButton title="Buy movement land · $50k" action={{ verb: 'faction.buy_land', targetIds: [profile.organizationId], parameters: { amountCents: 5_000_000 } }} style={styles.button} /> : null}
          </View>
          <Body secondary>Pressuring members for money produces more resources faster, but lowers devotion, cohesion, and public legitimacy and creates persistent exposure risk.</Body>
        </Card>
      </View>

      {(isReligious || isPolitical) ? <View style={styles.section}>
        <SectionHeader title={isReligious ? 'Doctrine & belief' : 'Ideology & public doctrine'} />
        <Card>
          <View style={styles.actions}>
            <EngineActionButton title={isReligious ? 'Spread the faith' : 'Spread the ideology'} action={{ verb: 'faction.spread_doctrine', targetIds: [profile.organizationId], parameters: {} }} tone="accent" style={styles.button} />
            {!profile.leaderVeneration ? <EngineActionButton title="Center the movement on yourself" action={{ verb: 'faction.elevate_leader', targetIds: [profile.organizationId], parameters: {} }} tone="danger" style={styles.button} /> : null}
          </View>
          {profile.leaderVeneration ? <Body secondary>The movement now treats you as part of its central doctrine. Devotion is stronger, but legitimacy and resilience to leadership failure are worse.</Body> : null}
        </Card>
      </View> : null}

      {(isReligious || isCommunal) ? <View style={styles.section}>
        <SectionHeader title="Household doctrine" action={profile.pluralHousehold ? <StatusPill tone="accent">{pluralSpouses.length} additional spouse{pluralSpouses.length === 1 ? '' : 's'}</StatusPill> : undefined} />
        <Card>
          {!profile.pluralHousehold ? <EngineActionButton title="Allow adult plural households" action={{ verb: 'faction.adopt_plural_household', targetIds: [profile.organizationId], parameters: {} }} tone="accent" /> : <>
            <Body secondary>Plural households are permitted inside the movement. Every additional marriage is still its own relationship: an adult NPC must accept the invitation, and attention, trust, resentment, shared plans, and separation remain individual.</Body>
            {pluralSpouses.map(({ relationship, person }) => <Card key={relationship.id}>
              <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{person.firstName} {person.lastName}</Heading><Body secondary>Additional spouse · trust {Math.round(relationship.trust)} · affection {Math.round(relationship.affection)} · resentment {Math.round(relationship.resentment)}</Body></View><StatusPill tone={relationship.resentment >= 45 ? 'warning' : 'success'}>{relationship.resentment >= 45 ? 'Strained' : 'Married'}</StatusPill></View>
              <View style={styles.actions}>
                <EngineActionButton title="Date night" action={{ verb: 'relationship.date_night', targetIds: [person.id], parameters: { amountCents: 12_000 } }} tone="accent" style={styles.button} />
                <EngineActionButton title="Weekend away" action={{ verb: 'relationship.weekend_away', targetIds: [person.id], parameters: { amountCents: 95_000 } }} style={styles.button} />
                <EngineActionButton title="Plan the future" action={{ verb: 'relationship.plan_future', targetIds: [person.id], parameters: {} }} style={styles.button} />
                <EngineActionButton title="Separate" action={{ verb: 'relationship.separate', targetIds: [person.id], parameters: {}, destructive: true }} tone="danger" style={styles.button} />
              </View>
            </Card>)}
            {eligiblePluralPartners.length > 0 ? <View style={{ gap: spacing.sm }}><Heading size="small">Invite another adult follower</Heading>{eligiblePluralPartners.map((person) => <EngineActionButton key={person.id} title={`Invite ${person.firstName}`} action={{ verb: 'faction.invite_plural_spouse', targetIds: [person.id, profile.organizationId], parameters: {} }} />)}</View> : null}
          </>}
        </Card>
      </View> : null}

      {isMilitary ? <View style={styles.section}>
        <SectionHeader title="Power & security" />
        <Card>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">Strategic readiness</Heading><Body secondary>Followers, cohesion, security capacity, influence, resources, and your faction reputation all matter.</Body></View><StatusPill tone={movementReadiness > resistance + 10 ? 'success' : movementReadiness > resistance - 5 ? 'warning' : 'danger'}>{Math.round(movementReadiness)} vs {Math.round(resistance)}</StatusPill></View>
          <View style={styles.actions}>
            <EngineActionButton title="Build security capacity · $15k" action={{ verb: 'faction.build_security', targetIds: [profile.organizationId], parameters: { amountCents: 1_500_000 } }} tone="accent" style={styles.button} />
            <EngineActionButton title="Attempt national power seizure" action={{ verb: 'faction.attempt_power_seizure', targetIds: [profile.organizationId], parameters: {}, destructive: true }} tone="danger" style={styles.button} />
          </View>
          <Body secondary>{country.name} currently has stability {Math.round(country.stability)} and rule of law {Math.round(country.ruleOfLaw)}. A takeover attempt is resolved from high-level organizational strength versus institutional resistance and uncertainty. Success creates a difficult national-government endgame; failure can devastate the movement and create severe legal exposure.</Body>
        </Card>
      </View> : null}

      <View style={styles.section}>
        <SectionHeader title="People close to it" action={<StatusPill>{followers.length} known</StatusPill>} />
        {followers.length === 0 ? <Card><Body secondary>The wider follower count is still mostly aggregate. More detailed NPCs appear as the movement grows.</Body></Card> : followers.slice(0, 6).map((person) => {
          const relationship = Object.values(world.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(person.id));
          return <Card key={person.id}><View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{person.firstName} {person.lastName}</Heading><Body secondary>Age {ageOf(world.calendar.week, person.birthWeek)} · faction reputation {Math.round(person.reputation.faction)}</Body></View><StatusPill tone={(relationship?.trust ?? 0) >= 60 ? 'success' : 'neutral'}>{relationship ? `Trust ${Math.round(relationship.trust)}` : 'Follower'}</StatusPill></View></Card>;
        })}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Movement history" />
        {history.length === 0 ? <Card><Body secondary>It is still too new to have much history.</Body></Card> : history.map((entry, index) => <Card key={`${entry}-${index}`}><Body>{entry}</Body></Card>)}
      </View>

      <OtherActionComposer domains={['organization', 'geopolitics']} placeholder="Try something else with the movement…" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  metric: { gap: 7 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  button: { flexGrow: 1, flexBasis: 150 },
});
