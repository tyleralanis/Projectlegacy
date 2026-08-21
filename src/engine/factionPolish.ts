import { allocateId } from './createWorld';
import { getInnerCircle, innerCircleProfile } from './factionDepth';
import { recordHistory } from './history';
import { nextRandom } from './random';
import type { ActionResult, IntentAction, Organization, WorldState } from './types';

const POLISHED_FACTION_VERBS = new Set([
  'faction.recruit',
  'faction.hold_gathering',
  'faction.collect_contributions',
  'faction.spread_doctrine',
  'faction.expand_public_influence',
  'faction.member_welfare',
  'faction.leave',
  'faction.dissolve',
  'faction.cash_out',
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

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function ok(world: WorldState, message: string): ActionResult {
  return { world, message, validation: { valid: true, requiresConfirmation: false } };
}

function blocked(source: WorldState, message: string): ActionResult {
  return { world: source, message, validation: { valid: false, reason: message, requiresConfirmation: false } };
}

function confirm(source: WorldState, message: string): ActionResult {
  return { world: source, message, validation: { valid: true, requiresConfirmation: true } };
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

function setMarker(org: Organization, key: string, value: string | number | boolean): void {
  const prefix = markerPrefix(key);
  const index = org.history.findIndex((entry) => entry.startsWith(prefix));
  const encoded = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
  const entry = `${prefix}${encoded}`;
  if (index >= 0) org.history[index] = entry;
  else org.history.push(entry);
}

function setProfile(org: Organization, values: Partial<{ followers: number; devotion: number; cohesion: number; publicStanding: number; doctrine: number }>): void {
  if (values.followers !== undefined) setMarker(org, 'followers', Math.max(0, Math.round(values.followers)));
  if (values.devotion !== undefined) setMarker(org, 'devotion', Math.round(clamp(values.devotion)));
  if (values.cohesion !== undefined) setMarker(org, 'cohesion', Math.round(clamp(values.cohesion)));
  if (values.publicStanding !== undefined) setMarker(org, 'public', Math.round(clamp(values.publicStanding)));
  if (values.doctrine !== undefined) setMarker(org, 'doctrine', Math.round(clamp(values.doctrine)));
}

function weeksUntil(world: WorldState, org: Organization, markerKey: string, cadenceWeeks: number): number {
  const lastWeek = markerNumber(org, markerKey, Number.NEGATIVE_INFINITY);
  if (!Number.isFinite(lastWeek)) return 0;
  return Math.max(0, cadenceWeeks - (world.calendar.week - lastWeek));
}

function requireCadence(source: WorldState, org: Organization, markerKey: string, cadenceWeeks: number, label: string): ActionResult | null {
  const remaining = weeksUntil(source, org, markerKey, cadenceWeeks);
  if (remaining <= 0) return null;
  return blocked(source, `${label} is already saturated for now. Advance ${remaining} more week${remaining === 1 ? '' : 's'} before another push.`);
}

export interface FactionCadenceStatus {
  recruitInWeeks: number;
  gatheringInWeeks: number;
  fundraisingInWeeks: number;
  welfareInWeeks: number;
  fundraisingFatigue: number;
  recruitmentEstimate: number;
  gatheringCostCents: number;
  welfareCostCents: number;
}

export function factionRecruitmentEstimate(world: WorldState): number {
  const profile = innerCircleProfile(world);
  const org = getInnerCircle(world);
  const actor = world.characters[world.playerCharacterId];
  if (!profile || !org || !actor) return 0;
  const sizeReach = Math.sqrt(Math.max(1, profile.followers));
  const raw = 2 + org.influence / 8 + profile.publicStanding / 15 + actor.charisma / 18 + sizeReach * 1.15;
  const absorption = 0.58 + profile.cohesion / 180;
  const capacity = 6 + profile.followers * 0.06 + sizeReach * 1.5;
  return Math.max(1, Math.round(Math.min(capacity, raw * absorption)));
}

export function factionGatheringCostCents(world: WorldState): number {
  const profile = innerCircleProfile(world);
  if (!profile) return 25_000;
  return Math.max(25_000, Math.round(profile.followers * 150));
}

export function factionWelfareCostCents(world: WorldState): number {
  const profile = innerCircleProfile(world);
  if (!profile) return 250_000;
  return Math.max(250_000, Math.round(profile.followers * 400));
}

export function factionCadenceStatus(world: WorldState): FactionCadenceStatus | undefined {
  const org = getInnerCircle(world);
  if (!org) return undefined;
  return {
    recruitInWeeks: weeksUntil(world, org, 'last-outreach-week', 1),
    gatheringInWeeks: weeksUntil(world, org, 'last-gathering-week', 1),
    fundraisingInWeeks: weeksUntil(world, org, 'last-fund-week', 4),
    welfareInWeeks: weeksUntil(world, org, 'last-welfare-week', 1),
    fundraisingFatigue: clamp(markerNumber(org, 'fundraising-fatigue', 0)),
    recruitmentEstimate: factionRecruitmentEstimate(world),
    gatheringCostCents: factionGatheringCostCents(world),
    welfareCostCents: factionWelfareCostCents(world),
  };
}

function createDetailedFollower(world: WorldState, org: Organization): void {
  if (org.memberIds.length >= 18) return;
  const actor = world.characters[world.playerCharacterId];
  const firstNames = ['Mara', 'Jonah', 'Leah', 'Micah', 'Nora', 'Elias', 'June', 'Theo', 'Maya', 'Caleb'];
  const lastNames = ['Vale', 'Brooks', 'Morrow', 'Bennett', 'Reed', 'Shah', 'Park', 'Morgan', 'Price', 'Chen'];
  const index = org.memberIds.length;
  const id = allocateId(world, 'character');
  const age = 20 + Math.floor(roll(world) * 36);
  world.characters[id] = {
    id,
    firstName: firstNames[(index + Math.floor(roll(world) * firstNames.length)) % firstNames.length],
    lastName: lastNames[(index + Math.floor(roll(world) * lastNames.length)) % lastNames.length],
    birthWeek: world.calendar.week - age * 52,
    isAlive: true,
    cityId: actor.cityId,
    householdId: `household-${id}`,
    parentIds: [],
    childIds: [],
    cashCents: 50_000 + Math.round(roll(world) * 3_000_000),
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
  org.memberIds.push(id);
  const relationshipId = allocateId(world, 'relationship');
  world.relationships[relationshipId] = { id: relationshipId, characterIds: [actor.id, id], kind: 'acquaintance', trust: 38, affection: 30, respect: 42, resentment: 1, lastInteractionWeek: world.calendar.week };
}

function chooseSuccessor(world: WorldState, org: Organization): string | undefined {
  const actorId = world.playerCharacterId;
  return org.memberIds
    .filter((id) => id !== actorId && world.characters[id]?.isAlive)
    .sort((left, right) => (world.characters[right]?.reputation.faction ?? 0) - (world.characters[left]?.reputation.faction ?? 0))[0];
}

function leaveLeadership(world: WorldState, org: Organization, severity: 'ordinary' | 'cashout'): string | undefined {
  const actor = world.characters[world.playerCharacterId];
  const successorId = chooseSuccessor(world, org);
  org.leaderId = successorId;
  org.memberIds = org.memberIds.filter((id) => id !== actor.id);
  setMarker(org, 'player-left-week', world.calendar.week);
  setMarker(org, 'former-leader', actor.id);
  const successor = successorId ? world.characters[successorId] : undefined;
  if (severity === 'ordinary') {
    const venerationPenalty = marker(org, 'veneration') === '1' ? 12 : 0;
    setProfile(org, {
      devotion: markerNumber(org, 'devotion', 35) - 10 - venerationPenalty,
      cohesion: markerNumber(org, 'cohesion', 40) - 18 - venerationPenalty,
      publicStanding: markerNumber(org, 'public', 35) - 2,
    });
    org.stability = clamp(org.stability - 12 - venerationPenalty * 0.5);
  }
  return successor ? `${successor.firstName} ${successor.lastName}` : undefined;
}

function executeRecruitment(source: WorldState): ActionResult {
  const organization = getInnerCircle(source);
  const profile = innerCircleProfile(source);
  if (!organization || !profile) return blocked(source, 'You do not currently lead a private movement.');
  const cadence = requireCadence(source, organization, 'last-outreach-week', 1, 'Recruitment');
  if (cadence) return cadence;

  const world = clone(source);
  const org = world.organizations[organization.id];
  const nextProfile = innerCircleProfile(world)!;
  const actor = world.characters[world.playerCharacterId];
  const sizeReach = Math.sqrt(Math.max(1, nextProfile.followers));
  const raw = 2 + org.influence / 8 + nextProfile.publicStanding / 15 + actor.charisma / 18 + sizeReach * (0.8 + roll(world) * 0.75);
  const absorption = 0.58 + nextProfile.cohesion / 180;
  const capacity = 6 + nextProfile.followers * 0.06 + sizeReach * 1.5;
  const gain = Math.max(1, Math.round(Math.min(capacity, raw * absorption)));
  const strain = Math.min(7, Math.max(0.4, gain / Math.max(12, nextProfile.followers) * 4.5));
  setProfile(org, {
    followers: nextProfile.followers + gain,
    devotion: nextProfile.devotion + (nextProfile.archetype === 'religious' ? 0.8 : 0.25),
    cohesion: nextProfile.cohesion - strain,
  });
  org.influence = clamp(org.influence + Math.min(2.5, Math.log10(gain + 1)));
  setMarker(org, 'last-outreach-week', world.calendar.week);
  setMarker(org, 'outreach-fatigue', clamp(markerNumber(org, 'outreach-fatigue', 0) + 10));
  if (gain >= 4) createDetailedFollower(world, org);
  org.history.push(`Recruitment campaign added ${gain} followers in week ${world.calendar.week}.`);
  return ok(world, `${gain} new followers joined. Recruitment now scales with the movement’s reach, but only one serious outreach push can be absorbed each week. Rapid growth cost ${Math.round(strain * 10) / 10} cohesion.`);
}

function executeGathering(source: WorldState, action: IntentAction): ActionResult {
  const organization = getInnerCircle(source);
  const profile = innerCircleProfile(source);
  if (!organization || !profile) return blocked(source, 'You do not currently lead a private movement.');
  const cadence = requireCadence(source, organization, 'last-gathering-week', 1, 'A full movement gathering');
  if (cadence) return cadence;
  const requested = typeof action.parameters.amountCents === 'number' ? Math.max(0, Math.round(action.parameters.amountCents)) : 0;
  const cost = Math.max(requested, factionGatheringCostCents(source));
  if (organization.resourcesCents < cost) return blocked(source, `${organization.name} needs ${money(cost)} in organization resources for a gathering at its current size.`);

  const world = clone(source);
  const org = world.organizations[organization.id];
  const nextProfile = innerCircleProfile(world)!;
  const actor = world.characters[world.playerCharacterId];
  org.resourcesCents -= cost;
  const base = 2.2 + Math.min(3.2, actor.charisma / 32);
  const cohesionGain = Math.max(0.6, base * Math.max(0.16, 1 - nextProfile.cohesion / 112));
  const devotionGain = Math.max(0.5, base * Math.max(0.2, 1 - nextProfile.devotion / 125));
  setProfile(org, {
    devotion: nextProfile.devotion + devotionGain,
    cohesion: nextProfile.cohesion + cohesionGain,
    publicStanding: nextProfile.publicStanding + (nextProfile.archetype === 'military' ? -0.4 : 0.5),
  });
  setMarker(org, 'last-gathering-week', world.calendar.week);
  org.history.push(`Movement gathering held for ${money(cost)} in week ${world.calendar.week}.`);
  return ok(world, `The gathering cost ${money(cost)}. Cohesion rose ${Math.round(cohesionGain * 10) / 10} points and devotion rose ${Math.round(devotionGain * 10) / 10}; both have diminishing returns near 100.`);
}

function executeFundraising(source: WorldState, action: IntentAction): ActionResult {
  const organization = getInnerCircle(source);
  const profile = innerCircleProfile(source);
  if (!organization || !profile) return blocked(source, 'You do not currently lead a private movement.');
  const cadence = requireCadence(source, organization, 'last-fund-week', 4, 'A movement-wide contribution drive');
  if (cadence) return cadence;
  const pressure = typeof action.parameters.pressure === 'string' ? action.parameters.pressure : 'normal';
  const aggressive = pressure === 'aggressive';

  const world = clone(source);
  const org = world.organizations[organization.id];
  const nextProfile = innerCircleProfile(world)!;
  const fatigue = clamp(markerNumber(org, 'fundraising-fatigue', 0));
  const fatigueFactor = Math.max(0.22, 1 - fatigue / 115);
  const perFollower = aggressive ? 4_500 : 1_500;
  const collected = Math.max(5_000, Math.round(nextProfile.followers * perFollower * (0.55 + nextProfile.devotion / 170) * fatigueFactor));
  org.resourcesCents += collected;
  const fatigueDamage = fatigue / 35;
  setProfile(org, {
    devotion: nextProfile.devotion - (aggressive ? 5 : 0.8) - fatigueDamage * 0.3,
    cohesion: nextProfile.cohesion - (aggressive ? 6 : 0.7) - fatigueDamage * 0.45,
    publicStanding: nextProfile.publicStanding - (aggressive ? 5 : 0.5),
  });
  setMarker(org, 'last-fund-week', world.calendar.week);
  setMarker(org, 'fundraising-fatigue', clamp(fatigue + (aggressive ? 38 : 16)));
  if (aggressive) {
    const exposureId = allocateId(world, 'exposure');
    world.exposures[exposureId] = {
      id: exposureId,
      characterId: world.playerCharacterId,
      category: 'coercive-organization-finance',
      severity: clamp(38 + fatigue * 0.25),
      evidence: clamp(30 + roll(world) * 35),
      discoverability: clamp(24 + roll(world) * 36),
      createdWeek: world.calendar.week,
      discovered: false,
      resolved: false,
    };
  }
  org.history.push(`${aggressive ? 'Aggressive' : 'Routine'} contribution drive raised ${money(collected)} in week ${world.calendar.week}.`);
  return ok(world, `${organization.name} raised ${money(collected)}. Another movement-wide drive is unavailable for four weeks, and repeated fundraising now creates donor fatigue${aggressive ? ', sharper cohesion damage, and persistent exposure risk' : ''}.`);
}

function executeDoctrine(source: WorldState): ActionResult {
  const organization = getInnerCircle(source);
  const profile = innerCircleProfile(source);
  if (!organization || !profile) return blocked(source, 'You do not currently lead a private movement.');
  if (profile.archetype !== 'religious' && profile.archetype !== 'political') return blocked(source, 'Doctrine expansion is strongest for religious or political movements.');
  const cadence = requireCadence(source, organization, 'last-outreach-week', 1, 'Public outreach');
  if (cadence) return cadence;

  const world = clone(source);
  const org = world.organizations[organization.id];
  const nextProfile = innerCircleProfile(world)!;
  const estimate = factionRecruitmentEstimate(world);
  const gain = Math.max(2, Math.round(estimate * (0.45 + roll(world) * 0.3)));
  setProfile(org, {
    followers: nextProfile.followers + gain,
    doctrine: nextProfile.doctrine + Math.max(0.8, 3.5 * (1 - nextProfile.doctrine / 120)),
    publicStanding: nextProfile.publicStanding + (nextProfile.archetype === 'religious' ? 0.8 : 1.5),
    cohesion: nextProfile.cohesion - Math.min(2.5, gain / Math.max(20, nextProfile.followers) * 3),
  });
  org.influence = clamp(org.influence + 1.6);
  setMarker(org, 'last-outreach-week', world.calendar.week);
  return ok(world, `${organization.name} pushed its doctrine publicly and added roughly ${gain} followers. That used this week’s outreach capacity, so recruitment cannot be stacked repeatedly in the same week.`);
}

function executePublicInfluence(source: WorldState, action: IntentAction): ActionResult {
  const organization = getInnerCircle(source);
  const profile = innerCircleProfile(source);
  if (!organization || !profile) return blocked(source, 'You do not currently lead a private movement.');
  const cadence = requireCadence(source, organization, 'last-outreach-week', 1, 'Public outreach');
  if (cadence) return cadence;
  const spend = typeof action.parameters.amountCents === 'number' ? Math.max(0, Math.round(action.parameters.amountCents)) : 300_000;
  if (organization.resourcesCents < spend) return blocked(source, `${organization.name} cannot afford that public campaign.`);

  const world = clone(source);
  const org = world.organizations[organization.id];
  const nextProfile = innerCircleProfile(world)!;
  const actor = world.characters[world.playerCharacterId];
  org.resourcesCents -= spend;
  const gain = 1.4 + actor.charisma / 42 + Math.log10(Math.max(10, spend / 100)) * 0.75;
  const followers = Math.max(1, Math.round(factionRecruitmentEstimate(world) * 0.45));
  org.influence = clamp(org.influence + gain);
  setProfile(org, { publicStanding: nextProfile.publicStanding + gain * 0.65, followers: nextProfile.followers + followers });
  setMarker(org, 'last-outreach-week', world.calendar.week);
  return ok(world, `${organization.name} spent ${money(spend)} on public legitimacy. Influence rose and about ${followers} followers joined, using this week’s outreach capacity.`);
}

function executeWelfare(source: WorldState, action: IntentAction): ActionResult {
  const organization = getInnerCircle(source);
  const profile = innerCircleProfile(source);
  if (!organization || !profile) return blocked(source, 'You do not currently lead a private movement.');
  const cadence = requireCadence(source, organization, 'last-welfare-week', 1, 'A movement-wide welfare program');
  if (cadence) return cadence;
  const requested = typeof action.parameters.amountCents === 'number' ? Math.max(0, Math.round(action.parameters.amountCents)) : 0;
  const spend = Math.max(requested, factionWelfareCostCents(source));
  if (organization.resourcesCents < spend) return blocked(source, `${organization.name} needs ${money(spend)} for member support at its current size.`);

  const world = clone(source);
  const org = world.organizations[organization.id];
  const nextProfile = innerCircleProfile(world)!;
  org.resourcesCents -= spend;
  const cohesionGain = Math.max(0.8, 5.5 * Math.max(0.16, 1 - nextProfile.cohesion / 112));
  const devotionGain = Math.max(0.5, 3.2 * Math.max(0.16, 1 - nextProfile.devotion / 120));
  setProfile(org, { cohesion: nextProfile.cohesion + cohesionGain, devotion: nextProfile.devotion + devotionGain, publicStanding: nextProfile.publicStanding + 1.4 });
  setMarker(org, 'last-welfare-week', world.calendar.week);
  for (const memberId of org.memberIds.slice(0, 14)) {
    const member = world.characters[memberId];
    if (!member || member.id === world.playerCharacterId) continue;
    member.mood = clamp(member.mood + 1.5);
    member.stress = clamp(member.stress - 1);
  }
  return ok(world, `${organization.name} spent ${money(spend)} supporting members. Cohesion rose ${Math.round(cohesionGain * 10) / 10} points, with smaller gains as the movement becomes healthier.`);
}

function executeLeave(source: WorldState, confirmed: boolean): ActionResult {
  const organization = getInnerCircle(source);
  const profile = innerCircleProfile(source);
  if (!organization || !profile) return blocked(source, 'You do not currently lead a private movement.');
  if (!confirmed) return confirm(source, `Leave ${organization.name}? A successor will take over if one is available, and the leadership transition will hurt devotion and cohesion.`);
  const world = clone(source);
  const org = world.organizations[organization.id];
  const successorName = leaveLeadership(world, org, 'ordinary');
  org.history.push(`${world.characters[world.playerCharacterId].firstName} left leadership in week ${world.calendar.week}.`);
  recordHistory(world, 'organization', `You left ${organization.name}`, successorName ? `${successorName} took over. The movement continues without you, but the transition damaged cohesion and devotion.` : 'No clear successor emerged. The movement continues as a leaderless organization and may unravel on its own.', { important: true, importance: 4, subjectIds: [organization.id, world.playerCharacterId] });
  return ok(world, successorName ? `You left ${organization.name}. ${successorName} is now leading it.` : `You left ${organization.name}. No clear successor took over.`);
}

function executeDissolve(source: WorldState, confirmed: boolean): ActionResult {
  const organization = getInnerCircle(source);
  const profile = innerCircleProfile(source);
  if (!organization || !profile) return blocked(source, 'You do not currently lead a private movement.');
  if (!confirmed) return confirm(source, `End ${organization.name}? The movement will be dissolved. You will not personally receive its remaining funds.`);
  const world = clone(source);
  const org = world.organizations[organization.id];
  const remaining = Math.max(0, org.resourcesCents);
  org.resourcesCents = 0;
  org.influence = 0;
  org.stability = 0;
  org.leaderId = undefined;
  org.memberIds = [];
  setProfile(org, { followers: 0, devotion: 0, cohesion: 0, publicStanding: 0, doctrine: markerNumber(org, 'doctrine', 0) });
  setMarker(org, 'ended', true);
  setMarker(org, 'ended-week', world.calendar.week);
  org.history.push(`Movement dissolved by its founder in week ${world.calendar.week}. ${money(remaining)} in organization resources was settled or dispersed rather than paid personally.`);
  recordHistory(world, 'organization', `${organization.name} ended`, `You formally dissolved the movement. Its people and history remain part of the world, but it no longer has active followers, influence, or a leader. ${money(remaining)} in organizational resources was settled or dispersed.`, { important: true, importance: 5, subjectIds: [organization.id, world.playerCharacterId] });
  return ok(world, `${organization.name} has been dissolved. You did not personally receive its remaining ${money(remaining)}.`);
}

function executeCashOut(source: WorldState, confirmed: boolean): ActionResult {
  const organization = getInnerCircle(source);
  const profile = innerCircleProfile(source);
  if (!organization || !profile) return blocked(source, 'You do not currently lead a private movement.');
  if (organization.resourcesCents <= 0) return blocked(source, `${organization.name} has no liquid organization resources to cash out.`);
  if (!confirmed) return confirm(source, `Cash out and leave ${organization.name}? Most liquid movement funds will become personal cash. Cohesion and devotion will collapse, many followers will leave, and the move creates persistent exposure risk.`);

  const world = clone(source);
  const org = world.organizations[organization.id];
  const nextProfile = innerCircleProfile(world)!;
  const actor = world.characters[world.playerCharacterId];
  const payout = Math.max(0, Math.round(org.resourcesCents * 0.82));
  org.resourcesCents -= payout;
  actor.cashCents += payout;
  world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'faction-leader-cashout', amountCents: payout, fromId: org.id, toId: actor.id, memo: `Leader cash-out from ${org.name}` });
  setProfile(org, {
    followers: Math.round(nextProfile.followers * 0.55),
    devotion: nextProfile.devotion - 45,
    cohesion: nextProfile.cohesion - 60,
    publicStanding: nextProfile.publicStanding - 22,
  });
  org.stability = clamp(org.stability - 38);
  const exposureId = allocateId(world, 'exposure');
  world.exposures[exposureId] = {
    id: exposureId,
    characterId: actor.id,
    category: 'faction-fund-misappropriation',
    severity: 62,
    evidence: clamp(55 + roll(world) * 35),
    discoverability: clamp(48 + roll(world) * 42),
    createdWeek: world.calendar.week,
    discovered: false,
    resolved: false,
  };
  const successorName = leaveLeadership(world, org, 'cashout');
  org.history.push(`${actor.firstName} cashed out ${money(payout)} and left in week ${world.calendar.week}.`);
  recordHistory(world, 'organization', `${organization.name} fractured after your exit`, `You moved ${money(payout)} of movement cash into personal funds and left leadership. Cohesion, devotion, stability, public standing, and follower count all fell sharply${successorName ? `; ${successorName} inherited what remained` : ''}.`, { important: true, importance: 5, subjectIds: [organization.id, actor.id] });
  return ok(world, `You cashed out ${money(payout)} and left ${organization.name}. The movement fractured badly${successorName ? ` under ${successorName}` : ''}.`);
}

export function executeFactionPolish(source: WorldState, action: IntentAction, confirmed = false): ActionResult | null {
  if (!POLISHED_FACTION_VERBS.has(action.verb)) return null;
  if (action.verb === 'faction.recruit') return executeRecruitment(source);
  if (action.verb === 'faction.hold_gathering') return executeGathering(source, action);
  if (action.verb === 'faction.collect_contributions') return executeFundraising(source, action);
  if (action.verb === 'faction.spread_doctrine') return executeDoctrine(source);
  if (action.verb === 'faction.expand_public_influence') return executePublicInfluence(source, action);
  if (action.verb === 'faction.member_welfare') return executeWelfare(source, action);
  if (action.verb === 'faction.leave') return executeLeave(source, confirmed);
  if (action.verb === 'faction.dissolve') return executeDissolve(source, confirmed);
  if (action.verb === 'faction.cash_out') return executeCashOut(source, confirmed);
  return null;
}

export function applyFactionPolishAdvance(before: WorldState, source: WorldState): WorldState {
  const weeks = Math.max(0, source.calendar.week - before.calendar.week);
  if (weeks <= 0) return source;
  const profile = innerCircleProfile(source);
  const organization = getInnerCircle(source);
  if (!profile || !organization) return source;

  const world = clone(source);
  const org = world.organizations[organization.id];
  const nextProfile = innerCircleProfile(world)!;
  const fundraisingFatigue = Math.max(0, markerNumber(org, 'fundraising-fatigue', 0) - weeks * 4);
  const outreachFatigue = Math.max(0, markerNumber(org, 'outreach-fatigue', 0) - weeks * 5);
  setMarker(org, 'fundraising-fatigue', fundraisingFatigue);
  setMarker(org, 'outreach-fatigue', outreachFatigue);

  const overhead = Math.max(0, Math.round(nextProfile.followers * 55 * weeks * (1 + Math.max(0, 55 - nextProfile.cohesion) / 180)));
  if (overhead > 0) {
    const paid = Math.min(Math.max(0, org.resourcesCents), overhead);
    org.resourcesCents -= paid;
    if (paid < overhead) {
      const shortfall = 1 - paid / overhead;
      setProfile(org, { cohesion: nextProfile.cohesion - Math.min(8, shortfall * Math.max(1, weeks / 2)) });
    }
  }

  const refreshed = innerCircleProfile(world)!;
  if (refreshed.followers >= 50 && refreshed.cohesion < 45) {
    const quarters = weeks / 13;
    const cohesionPressure = (45 - refreshed.cohesion) / 45;
    const scalePressure = Math.min(2.5, Math.log10(Math.max(10, refreshed.followers)) / 2.2);
    const churnRate = Math.min(0.35, cohesionPressure * scalePressure * 0.055 * quarters);
    const lost = Math.max(0, Math.round(refreshed.followers * churnRate));
    if (lost > 0) {
      setProfile(org, { followers: Math.max(1, refreshed.followers - lost), publicStanding: refreshed.publicStanding - Math.min(3, lost / Math.max(25, refreshed.followers) * 20) });
      org.influence = clamp(org.influence - Math.min(3, lost / Math.max(20, refreshed.followers) * 15));
      if (weeks >= 4 || lost >= 10) org.history.push(`${lost} followers drifted away during a low-cohesion period ending week ${world.calendar.week}.`);
    }
  }

  const finalProfile = innerCircleProfile(world)!;
  org.stability = clamp(org.stability + (finalProfile.cohesion - org.stability) * Math.min(0.35, weeks / 90));
  return world;
}
