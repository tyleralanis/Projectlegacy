import { allocateId, playerAgeYears } from './createWorld';
import { explain, recordHistory } from './history';
import { executePluralRelationshipDepth } from './pluralRelationshipDepth';
import { nextRandom } from './random';
import type { ActionResult, Character, IntentAction, Organization, WorldState } from './types';

export type InnerCircleArchetype = 'undecided' | 'religious' | 'military' | 'political' | 'communal' | 'commercial';

export interface InnerCircleProfile {
  organizationId: string;
  name: string;
  archetype: InnerCircleArchetype;
  followers: number;
  devotion: number;
  cohesion: number;
  security: number;
  publicStanding: number;
  doctrine: number;
  landOwned: boolean;
  leaderVeneration: boolean;
  pluralHousehold: boolean;
  resourcesCents: number;
  influence: number;
  stability: number;
}

const FACTION_VERBS = new Set([
  'organization.found_inner_circle',
  'faction.set_archetype',
  'faction.recruit',
  'faction.hold_gathering',
  'faction.collect_contributions',
  'faction.buy_land',
  'faction.spread_doctrine',
  'faction.elevate_leader',
  'faction.adopt_plural_household',
  'faction.invite_plural_spouse',
  'faction.build_security',
  'faction.expand_public_influence',
  'faction.member_welfare',
  'faction.attempt_power_seizure',
  'misconduct.faction_power_seizure_attempt',
]);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function roll(world: WorldState): number {
  const next = nextRandom(world.rngState);
  world.rngState = next.state;
  return next.value;
}

function ok(world: WorldState, message: string, explanation?: ActionResult['explanation']): ActionResult {
  return { world, message, explanation, validation: { valid: true, requiresConfirmation: false } };
}

function blocked(source: WorldState, message: string, requiresConfirmation = false): ActionResult {
  return { world: source, message, validation: { valid: false, reason: message, requiresConfirmation } };
}

function markerPrefix(key: string): string {
  return `inner-circle:${key}:`;
}

function marker(org: Organization, key: string): string | undefined {
  const prefix = markerPrefix(key);
  return org.history.find((entry) => entry.startsWith(prefix))?.slice(prefix.length);
}

function markerNumber(org: Organization, key: string, fallback: number): number {
  const parsed = Number(marker(org, key));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function markerBoolean(org: Organization, key: string, fallback = false): boolean {
  const value = marker(org, key);
  return value === undefined ? fallback : value === '1' || value === 'true';
}

function setMarker(org: Organization, key: string, value: string | number | boolean): void {
  const prefix = markerPrefix(key);
  const index = org.history.findIndex((entry) => entry.startsWith(prefix));
  const encoded = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
  const entry = `${prefix}${encoded}`;
  if (index >= 0) org.history[index] = entry;
  else org.history.push(entry);
}

export function isInnerCircleOrganization(org: Organization): boolean {
  return org.history.some((entry) => entry.startsWith('inner-circle:archetype:'));
}

export function getInnerCircle(world: WorldState): Organization | undefined {
  const actorId = world.playerCharacterId;
  return Object.values(world.organizations).find((org) => isInnerCircleOrganization(org) && org.leaderId === actorId);
}

export function innerCircleProfile(world: WorldState): InnerCircleProfile | undefined {
  const org = getInnerCircle(world);
  if (!org) return undefined;
  const rawArchetype = marker(org, 'archetype');
  const archetype: InnerCircleArchetype = ['religious', 'military', 'political', 'communal', 'commercial'].includes(rawArchetype ?? '') ? rawArchetype as InnerCircleArchetype : 'undecided';
  return {
    organizationId: org.id,
    name: org.name,
    archetype,
    followers: Math.max(org.memberIds.length, Math.round(markerNumber(org, 'followers', org.memberIds.length))),
    devotion: clamp(markerNumber(org, 'devotion', 28)),
    cohesion: clamp(markerNumber(org, 'cohesion', 38)),
    security: clamp(markerNumber(org, 'security', 4)),
    publicStanding: clamp(markerNumber(org, 'public', 35)),
    doctrine: clamp(markerNumber(org, 'doctrine', 22)),
    landOwned: markerBoolean(org, 'land'),
    leaderVeneration: markerBoolean(org, 'veneration'),
    pluralHousehold: markerBoolean(org, 'plural'),
    resourcesCents: org.resourcesCents,
    influence: org.influence,
    stability: org.stability,
  };
}

function targetInnerCircle(source: WorldState, action: IntentAction): Organization | undefined {
  const explicit = action.targetIds.map((id) => source.organizations[id]).find((org) => org && isInnerCircleOrganization(org));
  return explicit ?? getInnerCircle(source);
}

function amount(action: IntentAction, fallback: number): number {
  const value = action.parameters.amountCents;
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;
}

function addExposure(world: WorldState, severity: number, evidence: number, discoverability: number, category: string): void {
  const actor = world.characters[world.playerCharacterId];
  const id = allocateId(world, 'exposure');
  world.exposures[id] = { id, characterId: actor.id, category, severity: clamp(severity), evidence: clamp(evidence), discoverability: clamp(discoverability), createdWeek: world.calendar.week, discovered: false, resolved: false };
}

function createFollower(world: WorldState, organization: Organization, index: number): string {
  const actor = world.characters[world.playerCharacterId];
  const firstNames = ['Mara', 'Jonah', 'Leah', 'Micah', 'Nora', 'Elias', 'June', 'Theo', 'Maya', 'Caleb'];
  const lastNames = ['Vale', 'Brooks', 'Morrow', 'Bennett', 'Reed', 'Shah', 'Park', 'Morgan', 'Price', 'Chen'];
  const id = allocateId(world, 'character');
  const age = 20 + Math.floor(roll(world) * 32);
  const person: Character = {
    id,
    firstName: firstNames[(index + Math.floor(roll(world) * firstNames.length)) % firstNames.length],
    lastName: lastNames[(index + Math.floor(roll(world) * lastNames.length)) % lastNames.length],
    birthWeek: world.calendar.week - age * 52,
    isAlive: true,
    cityId: actor.cityId,
    householdId: `household-${id}`,
    parentIds: [],
    childIds: [],
    cashCents: 50_000 + Math.round(roll(world) * 2_500_000),
    health: 58 + roll(world) * 35,
    mood: 48 + roll(world) * 40,
    stress: 18 + roll(world) * 42,
    discipline: 35 + roll(world) * 55,
    ambition: 25 + roll(world) * 65,
    empathy: 30 + roll(world) * 60,
    riskTolerance: 25 + roll(world) * 65,
    ethics: 28 + roll(world) * 64,
    knowledge: 30 + roll(world) * 60,
    charisma: 30 + roll(world) * 62,
    fitness: 30 + roll(world) * 60,
    focuses: ['Networking', 'Family', 'Health'],
    reputation: { public: 42, business: 38, employee: 45, political: 30, professional: 42, family: 48, faction: 55 },
    detailTier: 'standard',
    lastMeaningfulWeek: world.calendar.week,
  };
  world.characters[id] = person;
  if (!organization.memberIds.includes(id)) organization.memberIds.push(id);
  const relationshipId = allocateId(world, 'relationship');
  world.relationships[relationshipId] = { id: relationshipId, characterIds: [actor.id, id], kind: 'acquaintance', trust: 38, affection: 30, respect: 42, resentment: 1, lastInteractionWeek: world.calendar.week };
  return id;
}

function setProfileNumbers(org: Organization, profile: Partial<Pick<InnerCircleProfile, 'followers' | 'devotion' | 'cohesion' | 'security' | 'publicStanding' | 'doctrine'>>): void {
  if (profile.followers !== undefined) setMarker(org, 'followers', Math.max(1, Math.round(profile.followers)));
  if (profile.devotion !== undefined) setMarker(org, 'devotion', Math.round(clamp(profile.devotion)));
  if (profile.cohesion !== undefined) setMarker(org, 'cohesion', Math.round(clamp(profile.cohesion)));
  if (profile.security !== undefined) setMarker(org, 'security', Math.round(clamp(profile.security)));
  if (profile.publicStanding !== undefined) setMarker(org, 'public', Math.round(clamp(profile.publicStanding)));
  if (profile.doctrine !== undefined) setMarker(org, 'doctrine', Math.round(clamp(profile.doctrine)));
}

function initialProfile(archetype: InnerCircleArchetype): Pick<InnerCircleProfile, 'followers' | 'devotion' | 'cohesion' | 'security' | 'publicStanding' | 'doctrine'> {
  if (archetype === 'religious') return { followers: 6, devotion: 38, cohesion: 40, security: 4, publicStanding: 32, doctrine: 36 };
  if (archetype === 'military') return { followers: 6, devotion: 29, cohesion: 46, security: 16, publicStanding: 29, doctrine: 24 };
  if (archetype === 'political') return { followers: 6, devotion: 29, cohesion: 39, security: 5, publicStanding: 42, doctrine: 29 };
  if (archetype === 'communal') return { followers: 6, devotion: 34, cohesion: 50, security: 4, publicStanding: 36, doctrine: 27 };
  if (archetype === 'commercial') return { followers: 6, devotion: 25, cohesion: 37, security: 4, publicStanding: 40, doctrine: 20 };
  return { followers: 6, devotion: 28, cohesion: 38, security: 4, publicStanding: 34, doctrine: 22 };
}

function isPowerSeizureVerb(verb: string): boolean {
  return verb === 'faction.attempt_power_seizure' || verb === 'misconduct.faction_power_seizure_attempt';
}

export function executeFactionDepth(source: WorldState, action: IntentAction, confirmed = false): ActionResult | null {
  const pluralRelationshipResult = executePluralRelationshipDepth(source, action, confirmed);
  if (pluralRelationshipResult) return pluralRelationshipResult;
  if (!FACTION_VERBS.has(action.verb)) return null;
  const actor = source.characters[source.playerCharacterId];

  if (action.verb === 'organization.found_inner_circle') {
    if (playerAgeYears(source) < 18) return blocked(source, 'This path is only available to adult characters.');
    if (getInnerCircle(source)) return blocked(source, 'You already lead a hidden movement. Open its private view instead of founding another one.');
    const startup = amount(action, 50_000);
    if (actor.cashCents < startup) return blocked(source, `You need ${(startup / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} in personal cash to get the first private meetings off the ground.`);
    const world = clone(source);
    const nextActor = world.characters[world.playerCharacterId];
    const organizationId = allocateId(world, 'organization');
    const name = typeof action.parameters.name === 'string' && action.parameters.name.trim() ? action.parameters.name.trim().slice(0, 50) : 'The Inner Circle';
    const requested = typeof action.parameters.archetype === 'string' ? action.parameters.archetype : 'undecided';
    const archetype: InnerCircleArchetype = ['religious', 'military', 'political', 'communal', 'commercial'].includes(requested) ? requested as InnerCircleArchetype : 'undecided';
    nextActor.cashCents -= startup;
    const organization: Organization = {
      id: organizationId,
      kind: 'faction',
      name,
      resourcesCents: archetype === 'commercial' ? startup + 300_000 : startup,
      influence: archetype === 'political' ? 16 : archetype === 'commercial' ? 12 : 7,
      stability: 48,
      memberIds: [nextActor.id],
      leaderId: nextActor.id,
      history: [`Founded privately by ${nextActor.firstName} ${nextActor.lastName} in week ${world.calendar.week}.`],
    };
    setMarker(organization, 'archetype', archetype);
    setProfileNumbers(organization, initialProfile(archetype));
    setMarker(organization, 'land', false);
    setMarker(organization, 'veneration', false);
    setMarker(organization, 'plural', false);
    world.organizations[organizationId] = organization;
    for (let index = 0; index < 3; index += 1) createFollower(world, organization, index);
    world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'private-movement-startup', amountCents: -startup, fromId: nextActor.id, toId: organizationId, memo: `Founded ${name}` });
    nextActor.reputation.faction = clamp(nextActor.reputation.faction + 5);
    recordHistory(world, 'organization', 'A private movement begins', `${name} exists now, but it is intentionally absent from the normal organization menus. Its structure only becomes visible because you asked to create it.`, { subjectIds: [organizationId], importance: 3 });
    return ok(world, `${name} has started quietly${archetype === 'undecided' ? '' : ` as a ${archetype} movement`}. A private Inner Circle view is now available under Work & ambition.`);
  }

  const organization = targetInnerCircle(source, action);
  if (!organization && action.verb === 'misconduct.faction_power_seizure_attempt') return null;
  if (!organization || organization.leaderId !== actor.id) return blocked(source, 'You do not currently lead an unlocked private movement.');
  const profile = innerCircleProfile(source)!;

  if (isPowerSeizureVerb(action.verb) && !confirmed) {
    return { world: source, message: 'This is a high-stakes fictional attempt to seize national power. The game models only strategic readiness, institutional resistance, and consequences—not tactics.', validation: { valid: true, requiresConfirmation: true } };
  }

  const world = clone(source);
  const org = world.organizations[organization.id];
  const nextActor = world.characters[world.playerCharacterId];

  if (action.verb === 'faction.set_archetype') {
    const archetype = typeof action.parameters.archetype === 'string' ? action.parameters.archetype : 'undecided';
    if (!['religious', 'military', 'political', 'communal', 'commercial'].includes(archetype)) return blocked(source, 'Choose religious, military, political, communal, or commercial.');
    if (profile.archetype !== 'undecided') return blocked(source, 'The movement already has a defining structure. Changing it later would require a schism, not a menu toggle.');
    setMarker(org, 'archetype', archetype);
    if (archetype === 'religious') setProfileNumbers(org, { devotion: profile.devotion + 10, doctrine: profile.doctrine + 14 });
    if (archetype === 'military') setProfileNumbers(org, { security: profile.security + 12, cohesion: profile.cohesion + 8, publicStanding: profile.publicStanding - 4 });
    if (archetype === 'political') { org.influence = clamp(org.influence + 9); setProfileNumbers(org, { publicStanding: profile.publicStanding + 8, doctrine: profile.doctrine + 5 }); }
    if (archetype === 'communal') setProfileNumbers(org, { cohesion: profile.cohesion + 12, devotion: profile.devotion + 4, publicStanding: profile.publicStanding + 2 });
    if (archetype === 'commercial') { org.resourcesCents += 300_000; org.influence = clamp(org.influence + 5); setProfileNumbers(org, { devotion: profile.devotion - 3, publicStanding: profile.publicStanding + 5 }); }
    org.history.push(`Adopted a ${archetype} structure in week ${world.calendar.week}.`);
    return ok(world, `${org.name} is now organized around a ${archetype} model. That changes which branches are strongest, but it does not lock out every other kind of ambition.`);
  }

  if (action.verb === 'faction.recruit') {
    const gain = Math.max(2, Math.round(2 + org.influence / 7 + profile.publicStanding / 13 + nextActor.charisma / 16 + roll(world) * 9));
    const newFollowers = profile.followers + gain;
    setProfileNumbers(org, { followers: newFollowers, devotion: profile.devotion + (profile.archetype === 'religious' ? 1.5 : 0.6), cohesion: profile.cohesion - Math.max(0, gain - 8) * 0.12 });
    org.influence = clamp(org.influence + Math.min(3, gain / 5));
    if (org.memberIds.length < 12 && gain >= 4) createFollower(world, org, org.memberIds.length);
    return ok(world, `${gain} new followers joined the broader movement. Growth helps influence, but recruiting faster than culture can absorb people slowly strains cohesion.`);
  }

  if (action.verb === 'faction.hold_gathering') {
    const cost = amount(action, 25_000);
    if (org.resourcesCents < cost) return blocked(source, `${org.name} needs ${(cost / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} in organization resources for the gathering.`);
    org.resourcesCents -= cost;
    const boost = 2.5 + Math.min(5, nextActor.charisma / 25);
    setProfileNumbers(org, { devotion: profile.devotion + boost, cohesion: profile.cohesion + boost * 0.8, publicStanding: profile.publicStanding + (profile.archetype === 'military' ? -0.5 : 0.7) });
    return ok(world, `The gathering cost ${(cost / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}. Devotion and cohesion rose because people experienced the movement as a community instead of an abstract idea.`);
  }

  if (action.verb === 'faction.collect_contributions') {
    const pressure = typeof action.parameters.pressure === 'string' ? action.parameters.pressure : 'normal';
    const aggressive = pressure === 'aggressive';
    const perFollower = aggressive ? 4_000 : 1_500;
    const collected = Math.max(5_000, Math.round(profile.followers * perFollower * (0.65 + profile.devotion / 180)));
    org.resourcesCents += collected;
    setProfileNumbers(org, { devotion: profile.devotion - (aggressive ? 3.5 : 0.5), cohesion: profile.cohesion - (aggressive ? 2.5 : 0.3), publicStanding: profile.publicStanding - (aggressive ? 4 : 0.4) });
    if (aggressive) addExposure(world, 35, 28 + roll(world) * 28, 22 + roll(world) * 30, 'coercive-organization-finance');
    org.history.push(`${aggressive ? 'Aggressive' : 'Routine'} contributions raised ${(collected / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} in week ${world.calendar.week}.`);
    return ok(world, `${org.name} collected ${(collected / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}. ${aggressive ? 'The faster money came with lower devotion, lower legitimacy, and a persistent exposure risk.' : 'Routine contributions raised less money with much less social damage.'}`);
  }

  if (action.verb === 'faction.buy_land') {
    if (profile.landOwned) return blocked(source, 'The movement already owns a dedicated compound property.');
    const cost = amount(action, 5_000_000);
    if (org.resourcesCents < cost) return blocked(source, `${org.name} needs ${(cost / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} in organization resources to buy land.`);
    org.resourcesCents -= cost;
    const propertyId = allocateId(world, 'property');
    world.properties[propertyId] = { id: propertyId, name: `${org.name} grounds`, kind: 'land', cityId: nextActor.cityId, ownerId: org.id, valueCents: cost, debtCents: 0, condition: 68, occupancy: 'vacant', weeklyRentCents: 0, weeklyCostsCents: Math.round(cost * 0.00022), managed: false };
    setMarker(org, 'land', true);
    setProfileNumbers(org, { cohesion: profile.cohesion + 5, publicStanding: profile.publicStanding - (profile.archetype === 'communal' ? 0 : 1.5) });
    recordHistory(world, 'property', `${org.name} acquired land`, 'The movement now has a physical base. Land creates permanence, costs, visibility, and a place future stories can attach to.', { subjectIds: [org.id, propertyId], importance: 3 });
    return ok(world, `${org.name} bought land for ${(cost / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}. The movement now has a physical base and recurring property costs.`);
  }

  if (action.verb === 'faction.spread_doctrine') {
    if (profile.archetype !== 'religious' && profile.archetype !== 'political') return blocked(source, 'Doctrine expansion is strongest for religious or political movements.');
    const gain = Math.max(3, Math.round(profile.doctrine / 12 + profile.publicStanding / 18 + roll(world) * 7));
    setProfileNumbers(org, { followers: profile.followers + gain, doctrine: profile.doctrine + 4, publicStanding: profile.publicStanding + (profile.archetype === 'religious' ? 1 : 2) });
    org.influence = clamp(org.influence + 2.2);
    return ok(world, `${org.name} spread its doctrine and added roughly ${gain} followers. Influence grew because the movement is becoming an idea people recognize outside the inner circle.`);
  }

  if (action.verb === 'faction.elevate_leader') {
    if (profile.leaderVeneration) return blocked(source, 'The movement already centers its doctrine on the leader.');
    setMarker(org, 'veneration', true);
    setProfileNumbers(org, { devotion: profile.devotion + 13, doctrine: profile.doctrine + 8, cohesion: profile.cohesion + 3, publicStanding: profile.publicStanding - 9 });
    nextActor.reputation.faction = clamp(nextActor.reputation.faction + 8);
    addExposure(world, 28, 22 + roll(world) * 24, 20 + roll(world) * 26, 'leader-veneration');
    return ok(world, 'The movement now openly centers its identity on you. Devotion rose sharply, while outside legitimacy and resilience to leadership failure got worse.');
  }

  if (action.verb === 'faction.adopt_plural_household') {
    if (profile.pluralHousehold) return blocked(source, 'Plural partnership is already part of the movement’s household doctrine.');
    if (profile.archetype !== 'religious' && profile.archetype !== 'communal') return blocked(source, 'Plural-household doctrine is currently tied to religious or communal movements.');
    setMarker(org, 'plural', true);
    setProfileNumbers(org, { devotion: profile.devotion + 3, publicStanding: profile.publicStanding - 5, cohesion: profile.cohesion - 1 });
    return ok(world, 'The movement adopted an adult plural-household doctrine. It unlocks consensual additional spouse invitations while creating outside scrutiny and internal jealousy risk.');
  }

  if (action.verb === 'faction.invite_plural_spouse') {
    if (!profile.pluralHousehold) return blocked(source, 'Adopt plural-household doctrine before inviting an additional spouse.');
    const candidateId = action.targetIds.find((id) => id !== org.id && world.characters[id]?.isAlive) ?? org.memberIds.find((id) => id !== nextActor.id && world.characters[id]?.isAlive);
    const candidate = candidateId ? world.characters[candidateId] : undefined;
    if (!candidate || Math.floor((world.calendar.week - candidate.birthWeek) / 52) < 18) return blocked(source, 'Choose an adult follower for the invitation.');
    const existing = Object.values(world.relationships).find((relationship) => relationship.characterIds.includes(nextActor.id) && relationship.characterIds.includes(candidate.id));
    const consentScore = candidate.empathy * 0.18 + candidate.riskTolerance * 0.18 + profile.devotion * 0.25 + (existing?.trust ?? 30) * 0.2 + (existing?.affection ?? 25) * 0.19;
    if (consentScore + roll(world) * 38 < 60) {
      if (existing) existing.resentment = clamp(existing.resentment + 6);
      return ok(world, `${candidate.firstName} declined the invitation. The movement’s doctrine does not override an individual adult’s choice.`);
    }
    if (existing) {
      existing.kind = 'spouse';
      existing.trust = clamp(existing.trust + 4);
      existing.affection = clamp(existing.affection + 8);
    } else {
      const relationshipId = allocateId(world, 'relationship');
      world.relationships[relationshipId] = { id: relationshipId, characterIds: [nextActor.id, candidate.id], kind: 'spouse', trust: 52, affection: 62, respect: 48, resentment: 2, lastInteractionWeek: world.calendar.week };
    }
    if (!nextActor.partnerId) {
      nextActor.partnerId = candidate.id;
      candidate.partnerId = nextActor.id;
    }
    org.history.push(`Plural spouse:${candidate.id}:week:${world.calendar.week}`);
    setProfileNumbers(org, { devotion: profile.devotion + 2, publicStanding: profile.publicStanding - 2 });
    recordHistory(world, 'relationship', `${candidate.firstName} joined the plural household`, 'An additional adult spouse relationship now exists alongside the movement’s doctrine. Consent mattered to the outcome, and the relationship can develop independently from the organization.', { subjectIds: [nextActor.id, candidate.id, org.id], importance: 4, important: true });
    return ok(world, `${candidate.firstName} accepted the invitation and is now an additional spouse in the household.`);
  }

  if (action.verb === 'faction.build_security') {
    const cost = amount(action, 1_500_000);
    if (org.resourcesCents < cost) return blocked(source, `${org.name} needs ${(cost / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} in organization resources.`);
    org.resourcesCents -= cost;
    const gain = clamp(4 + Math.log10(Math.max(10, cost / 100)) * 1.7 + (profile.archetype === 'military' ? 4 : 0), 4, 18);
    setProfileNumbers(org, { security: profile.security + gain, cohesion: profile.cohesion + (profile.archetype === 'military' ? 2 : 0.5), publicStanding: profile.publicStanding - 1.5 });
    addExposure(world, 30 + gain, 18 + roll(world) * 30, 18 + roll(world) * 32, 'private-security-capacity');
    return ok(world, `${org.name} increased its abstract security capacity by ${Math.round(gain)} points. The game tracks readiness, cost, visibility, and institutional consequences without modeling real-world weapons or tactics.`);
  }

  if (action.verb === 'faction.expand_public_influence') {
    const spend = amount(action, 300_000);
    if (org.resourcesCents < spend) return blocked(source, `${org.name} cannot afford that public campaign.`);
    org.resourcesCents -= spend;
    const gain = 2 + nextActor.charisma / 30 + Math.log10(Math.max(10, spend / 100));
    org.influence = clamp(org.influence + gain);
    setProfileNumbers(org, { publicStanding: profile.publicStanding + gain * 0.75, followers: profile.followers + Math.round(gain * 1.5) });
    return ok(world, `${org.name} spent ${(spend / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} becoming more publicly legitimate and recognizable. Influence and follower growth improved.`);
  }

  if (action.verb === 'faction.member_welfare') {
    const spend = amount(action, 250_000);
    if (org.resourcesCents < spend) return blocked(source, `${org.name} cannot afford that member-support program.`);
    org.resourcesCents -= spend;
    setProfileNumbers(org, { devotion: profile.devotion + 3.5, cohesion: profile.cohesion + 5, publicStanding: profile.publicStanding + 2.5 });
    for (const memberId of org.memberIds.slice(0, 10)) {
      const member = world.characters[memberId];
      if (!member || member.id === nextActor.id) continue;
      member.mood = clamp(member.mood + 2);
      member.stress = clamp(member.stress - 1.5);
    }
    return ok(world, `${org.name} spent resources on member welfare. It grows slower this way, but people are more stable and cohesion is less dependent on fear or charisma.`);
  }

  if (isPowerSeizureVerb(action.verb)) {
    const country = world.countries[world.activeCountryId];
    const readiness = clamp(
      Math.log10(Math.max(10, profile.followers)) * 10
      + profile.security * 0.3
      + profile.cohesion * 0.2
      + org.influence * 0.18
      + nextActor.reputation.faction * 0.14
      + Math.min(12, Math.log10(Math.max(100, org.resourcesCents / 100)) * 1.8)
      + (profile.archetype === 'military' ? 8 : profile.archetype === 'political' ? 4 : 0),
    );
    const institutionalResistance = clamp(country.stability * 0.34 + country.ruleOfLaw * 0.36 + country.marketAccess * 0.08 + country.educationIndex * 0.07 + 10);
    const margin = readiness - institutionalResistance + (roll(world) - 0.5) * 24;
    const success = margin >= 10;
    const exposureSeverity = success ? 100 : clamp(76 + Math.max(0, -margin) * 0.2);
    addExposure(world, exposureSeverity, success ? 96 : 70 + roll(world) * 25, 88 + roll(world) * 12, 'faction-power-seizure');

    if (success) {
      world.politics[nextActor.id] = {
        characterId: nextActor.id,
        office: 'National executive (seized power)',
        officeLevel: 'national',
        authority: 95,
        approval: clamp(22 + profile.publicStanding * 0.22),
      };
      country.stability = clamp(country.stability - 24);
      country.ruleOfLaw = clamp(country.ruleOfLaw - 30);
      org.influence = clamp(org.influence + 24);
      setProfileNumbers(org, { devotion: profile.devotion + 10, cohesion: profile.cohesion - 8, publicStanding: profile.publicStanding - 10 });
      org.history.push(`National power seizure succeeded in week ${world.calendar.week}.`);
      recordHistory(world, 'geopolitics', 'The movement seized national power', `${org.name} overcame institutional resistance and put ${nextActor.firstName} at the center of the national government. The victory immediately created legitimacy, governance, legal, economic, and succession problems rather than ending the game.`, { important: true, importance: 5, subjectIds: [nextActor.id, org.id, country.id] });
      return ok(world, 'The fictional seizure of power succeeded. You now control the national executive, but stability and rule of law fell sharply and the state has become a much harder system to govern.', explain('Success came from broad strategic strength, not a modeled tactical recipe.', [
        { label: 'Movement scale', impact: profile.followers >= 5_000 ? 'positive' : 'neutral', detail: `${profile.followers.toLocaleString()} followers contributed to organizational reach.` },
        { label: 'Cohesion & security', impact: profile.cohesion + profile.security >= 120 ? 'positive' : 'neutral', detail: 'Abstract organizational readiness mattered without modeling weapons or tactics.' },
        { label: 'Institutional resistance', impact: 'negative', detail: `Country stability ${Math.round(country.stability)} and rule of law ${Math.round(country.ruleOfLaw)} resisted the attempt.` },
      ]));
    }

    org.resourcesCents = Math.round(org.resourcesCents * 0.45);
    org.stability = clamp(org.stability - 18);
    setProfileNumbers(org, { followers: Math.max(1, Math.round(profile.followers * 0.72)), devotion: profile.devotion - 12, cohesion: profile.cohesion - 18, security: profile.security - 8, publicStanding: profile.publicStanding - 22 });
    nextActor.reputation.public = clamp(nextActor.reputation.public - 18);
    nextActor.reputation.faction = clamp(nextActor.reputation.faction + 5);
    org.history.push(`National power seizure failed in week ${world.calendar.week}.`);
    recordHistory(world, 'geopolitics', 'The power seizure failed', `${org.name} could not overcome the country’s institutions. Followers scattered, money disappeared, public legitimacy collapsed, and a severe evidence trail remains.`, { important: true, importance: 5, subjectIds: [nextActor.id, org.id, country.id] });
    return ok(world, 'The fictional power seizure failed. The movement lost followers, resources, cohesion, and public standing, and the attempt left severe persistent exposure.', explain('The attempt failed because strategic readiness did not overcome institutional resistance.', [
      { label: 'Movement readiness', impact: readiness >= institutionalResistance ? 'neutral' : 'negative', detail: `Readiness score ${Math.round(readiness)} versus institutional resistance ${Math.round(institutionalResistance)}.` },
      { label: 'Uncertainty', impact: 'neutral', detail: 'Even a powerful faction cannot guarantee an outcome.' },
      { label: 'Consequences', impact: 'negative', detail: 'Resources, followers, legitimacy, and legal exposure all persist after failure.' },
    ]));
  }

  return null;
}

export function applyFactionAdvance(before: WorldState, source: WorldState): WorldState {
  const weeks = Math.max(0, source.calendar.week - before.calendar.week);
  if (weeks <= 0) return source;
  const profile = innerCircleProfile(source);
  if (!profile) return source;
  const world = clone(source);
  const org = world.organizations[profile.organizationId];
  const nextProfile = innerCircleProfile(world)!;
  const periods = weeks / 13;
  const passiveContributions = Math.max(0, Math.round(nextProfile.followers * 180 * weeks * (0.35 + nextProfile.devotion / 200)));
  org.resourcesCents += passiveContributions;
  const growth = Math.max(0, periods * (org.influence / 9 + nextProfile.publicStanding / 18 + nextProfile.doctrine / 24));
  setProfileNumbers(org, {
    followers: nextProfile.followers + growth,
    devotion: nextProfile.devotion + (nextProfile.leaderVeneration ? periods * 0.8 : -periods * 0.18),
    cohesion: nextProfile.cohesion - Math.max(0, growth / Math.max(10, nextProfile.followers) * 20),
    publicStanding: nextProfile.publicStanding + (nextProfile.archetype === 'political' ? periods * 0.35 : 0),
  });
  if (weeks >= 26 && nextProfile.followers >= 250 && !org.history.some((entry) => entry.startsWith('milestone:250'))) {
    org.history.push(`milestone:250:week:${world.calendar.week}`);
    recordHistory(world, 'organization', `${org.name} stopped being small`, 'The movement has enough followers, money, and internal history that leadership mistakes can now become organizational crises instead of personal disagreements.', { subjectIds: [org.id], importance: 3 });
  }
  return world;
}
