import { allocateId } from './createWorld';
import { recordHistory } from './history';
import { nextRandom } from './random';
import type { ActionResult, Business, IntentAction, PropertyAsset, WorldState } from './types';

const GYM_ANNUAL_COST_CENTS = 78_000;
const CEO_HIRE_COST_CENTS = 90_000;
const LOCATION_EXPANSION_COST_CENTS = 5_000_000;

const DELEGATION_VERBS = new Set([
  'health.cancel_gym_membership',
  'property.manage',
  'property.manage_portfolio',
  'property.end_management',
  'business.withdraw_funds',
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
  return { world, validation: { valid: true, requiresConfirmation: false }, message };
}

function blocked(source: WorldState, message: string): ActionResult {
  return { world: source, validation: { valid: false, reason: message, requiresConfirmation: false }, message };
}

function actor(world: WorldState) {
  return world.characters[world.playerCharacterId];
}

function ownedProperties(world: WorldState): PropertyAsset[] {
  return Object.values(world.properties).filter((property) => property.ownerId === world.playerCharacterId);
}

function ownedBusiness(world: WorldState, targetIds: string[]): Business | undefined {
  return targetIds.map((id) => world.businesses[id]).find((business) => business?.active && (business.ownerId ?? business.founderId) === world.playerCharacterId && business.playerOwnershipBps > 0)
    ?? Object.values(world.businesses).find((business) => business.active && (business.ownerId ?? business.founderId) === world.playerCharacterId && business.playerOwnershipBps > 0);
}

function gymOrganization(world: WorldState) {
  const player = actor(world);
  return Object.values(world.organizations).find((organization) => organization.kind === 'club' && organization.memberIds.includes(player.id) && organization.history.some((entry) => entry.startsWith('gym-membership:')));
}

export function propertyManagerActive(world: WorldState): boolean {
  return ownedProperties(world).some((property) => property.managed);
}

export function portfolioManagementFeeWeeklyCents(world: WorldState): number {
  return ownedProperties(world).reduce((total, property) => total + (property.occupancy === 'tenant' ? Math.round(property.weeklyRentCents * 0.09) : 0), 0);
}

export function businessRunwayReserveCents(business: Business): number {
  return Math.max(
    250_000,
    business.costWeeklyCents * 8 + (business.managerSalaryWeeklyCents ?? 0) * 8,
  );
}

export function distributableBusinessCashCents(business: Business): number {
  const excess = Math.max(0, business.cashCents - businessRunwayReserveCents(business));
  return Math.floor(excess * clamp(business.playerOwnershipBps / 10_000, 0, 1));
}

function managePortfolio(source: WorldState): ActionResult {
  const properties = ownedProperties(source);
  if (properties.length === 0) return blocked(source, 'You need at least one property before hiring portfolio management.');
  const world = clone(source);
  const nextProperties = ownedProperties(world);
  const alreadyManaged = nextProperties.every((property) => property.managed);
  nextProperties.forEach((property) => { property.managed = true; });
  if (!alreadyManaged) {
    recordHistory(world, 'property', 'Portfolio management hired', `One property manager now oversees all ${nextProperties.length} owned properties. Fees scale with rent collected across the portfolio, and newly acquired properties will join the same management relationship.`, { importance: 3, subjectIds: nextProperties.map((property) => property.id) });
  }
  return ok(world, alreadyManaged ? 'Your property manager already covers the full portfolio.' : `One property manager now covers all ${nextProperties.length} properties. The fee grows with the portfolio instead of requiring a separate manager for every asset.`);
}

function endPortfolioManagement(source: WorldState): ActionResult {
  const properties = ownedProperties(source);
  if (!properties.some((property) => property.managed)) return blocked(source, 'Your property portfolio is already self-managed.');
  const world = clone(source);
  ownedProperties(world).forEach((property) => { property.managed = false; });
  recordHistory(world, 'property', 'Portfolio management ended', 'You took property operations back in-house. Management fees stop, but maintenance and tenant decisions can reach you directly again.', { importance: 2 });
  return ok(world, 'Portfolio management ended. Every owned property is self-managed again.');
}

function cancelGymMembership(source: WorldState): ActionResult {
  const organization = gymOrganization(source);
  if (!organization) return blocked(source, 'You do not have an active gym membership to cancel.');
  const world = clone(source);
  const next = world.organizations[organization.id];
  next.history = next.history.filter((entry) => !entry.startsWith('gym-membership:'));
  next.memberIds = next.memberIds.filter((id) => id !== world.playerCharacterId);
  recordHistory(world, 'health', 'Gym membership cancelled', 'The annual membership will not renew again. No refund was issued for time already used.', { importance: 1 });
  return ok(world, 'The gym membership is cancelled and will not auto-renew.');
}

function withdrawBusinessCash(source: WorldState, action: IntentAction): ActionResult {
  const business = ownedBusiness(source, action.targetIds);
  if (!business) return blocked(source, 'Choose an active company you still own.');
  const available = distributableBusinessCashCents(business);
  if (available <= 0) return blocked(source, `${business.name} does not have cash above its operating runway yet.`);
  const requested = typeof action.parameters.amountCents === 'number' && Number.isFinite(action.parameters.amountCents)
    ? Math.max(0, Math.round(action.parameters.amountCents))
    : available;
  const payout = Math.min(available, requested || available);
  if (payout <= 0) return blocked(source, 'Choose a positive amount to withdraw.');

  const world = clone(source);
  const nextBusiness = world.businesses[business.id];
  const player = actor(world);
  nextBusiness.cashCents -= payout;
  player.cashCents += payout;
  world.transactions.push({
    id: allocateId(world, 'transaction'),
    week: world.calendar.week,
    kind: 'business-distribution',
    amountCents: payout,
    fromId: nextBusiness.id,
    toId: player.id,
    memo: `Owner distribution from ${nextBusiness.name}`,
  });
  if (payout >= Math.max(1_000_000, available * 0.5)) {
    recordHistory(world, 'business', `${nextBusiness.name} paid an owner distribution`, `${money(payout)} moved from company cash to personal cash while leaving a modeled operating reserve behind.`, { subjectIds: [nextBusiness.id, player.id], importance: 2 });
  }
  return ok(world, `You withdrew ${money(payout)} from ${nextBusiness.name}. The company kept its modeled operating runway.`);
}

export function executeDelegationDepth(source: WorldState, action: IntentAction): ActionResult | null {
  if (!DELEGATION_VERBS.has(action.verb)) return null;
  if (action.verb === 'health.cancel_gym_membership') return cancelGymMembership(source);
  if (action.verb === 'property.manage' || action.verb === 'property.manage_portfolio') return managePortfolio(source);
  if (action.verb === 'property.end_management') return endPortfolioManagement(source);
  if (action.verb === 'business.withdraw_funds') return withdrawBusinessCash(source, action);
  return null;
}

/**
 * Recurring memberships are prepared before the older supplemental pass. That
 * pass used to expire gym memberships at 52 weeks; rolling the paid-through
 * marker forward here converts the same local state into true annual renewal.
 */
export function prepareDelegationAdvance(before: WorldState, source: WorldState): WorldState {
  if (source.calendar.week <= before.calendar.week) return source;
  const organization = gymOrganization(source);
  if (!organization) return source;
  const marker = organization.history.find((entry) => entry.startsWith('gym-membership:'));
  if (!marker) return source;
  const [, startedRaw, durationRaw] = marker.split(':');
  const started = Number(startedRaw ?? source.calendar.week);
  const duration = Math.max(1, Number(durationRaw ?? 52));
  const beforePeriods = Math.max(0, Math.floor((before.calendar.week - started) / duration));
  const afterPeriods = Math.max(0, Math.floor((source.calendar.week - started) / duration));
  const renewals = Math.max(0, afterPeriods - beforePeriods);
  if (renewals <= 0) return source;

  const world = clone(source);
  const nextOrganization = world.organizations[organization.id];
  const player = actor(world);
  const total = GYM_ANNUAL_COST_CENTS * renewals;
  const markerIndex = nextOrganization.history.findIndex((entry) => entry.startsWith('gym-membership:'));
  if (player.cashCents < total) {
    if (markerIndex >= 0) nextOrganization.history.splice(markerIndex, 1);
    nextOrganization.memberIds = nextOrganization.memberIds.filter((id) => id !== player.id);
    recordHistory(world, 'health', 'Gym membership lapsed', `The ${money(GYM_ANNUAL_COST_CENTS)} annual renewal could not be covered from liquid cash, so the membership ended instead of silently pushing cash negative.`, { importance: 1 });
    return world;
  }

  player.cashCents -= total;
  nextOrganization.resourcesCents += total;
  const rolledStart = started + renewals * duration;
  if (markerIndex >= 0) nextOrganization.history[markerIndex] = `gym-membership:${rolledStart}:${duration}`;
  world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'wellness-membership', amountCents: -total, fromId: player.id, toId: nextOrganization.id, memo: `Gym membership renewal${renewals > 1 ? ` x${renewals}` : ''}` });
  return world;
}

function maintainManagedPortfolio(world: WorldState, weeks: number): void {
  const properties = ownedProperties(world);
  if (!properties.some((property) => property.managed)) return;
  properties.forEach((property) => {
    property.managed = true;
    if (property.condition < 70) property.condition = clamp(property.condition + Math.min(2.5, weeks * 0.04));
  });
}

function managerFailureChance(quality: number): number {
  if (quality >= 90) return 0.008;
  if (quality >= 80) return 0.012;
  if (quality >= 70) return 0.025;
  if (quality >= 60) return 0.045;
  if (quality >= 50) return 0.075;
  return 0.12;
}

function autoManageBusiness(world: WorldState, business: Business, weeks: number, crossedQuarters: number): void {
  const quality = clamp(business.managerQuality ?? 55);
  const player = actor(world);
  const baseRevenue = Math.max(0, business.revenueWeeklyCents);
  const baseCost = Math.max(0, business.costWeeklyCents);
  const baseProfit = baseRevenue - baseCost;

  // Strong executives improve pricing, mix, execution and cost control. Weak
  // executives do the opposite. This makes an 80+ hire economically meaningful
  // rather than merely reducing the player's time commitment.
  const revenueLift = clamp((quality - 55) * 0.012, -0.22, 0.45);
  const costEfficiency = clamp((quality - 55) * 0.006, -0.12, 0.18);
  const adjustedRevenue = Math.round(baseRevenue * (1 + revenueLift));
  const adjustedCost = Math.round(baseCost * (1 - costEfficiency));
  const adjustedProfit = adjustedRevenue - adjustedCost;
  const executionDelta = (adjustedProfit - baseProfit) * weeks;
  business.cashCents += executionDelta;
  business.revenueWeeklyCents = adjustedRevenue;
  business.costWeeklyCents = adjustedCost;
  business.quality = clamp(business.quality + (quality - 60) * 0.003 * weeks);
  business.reputation = clamp(business.reputation + (quality - 62) * 0.0025 * weeks);
  business.culture = clamp((business.culture ?? 55) + (quality - 58) * 0.003 * weeks);
  business.valuationCents = Math.max(0, Math.round(business.valuationCents + adjustedProfit * Math.min(weeks, 13) * (quality >= 80 ? 28 : quality >= 65 ? 16 : 6)));

  const reserve = businessRunwayReserveCents(business);
  const buffer = quality >= 80 ? 1.35 : quality >= 65 ? 1.22 : quality >= 50 ? 1.08 : 0.96;
  const desiredCapacity = Math.ceil(business.demand * buffer);
  if (desiredCapacity > business.capacity && business.cashCents > reserve) {
    const needed = Math.ceil((desiredCapacity - business.capacity) / 8);
    const execution = quality >= 80 ? 1 : quality >= 65 ? 0.8 : quality >= 50 ? 0.55 : 0.35;
    const hires = Math.max(1, Math.min(50, Math.ceil(needed * execution)));
    const cost = hires * CEO_HIRE_COST_CENTS;
    if (business.cashCents - cost >= reserve || quality < 45) {
      business.cashCents -= cost;
      business.employees += hires;
      business.capacity += hires * 8;
      world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'business-hiring', amountCents: -cost, fromId: business.id, memo: `${business.managerName ?? 'CEO'} automated hiring: ${hires}` });
      if (hires >= 3) recordHistory(world, 'business', `${business.name} staffed ahead of demand`, `${business.managerName ?? 'The CEO'} hired ${hires} people without asking you to approve routine headcount. Capacity rose to ${Math.round(business.capacity)}.`, { subjectIds: [business.id], importance: 2 });
    }
  }

  const capacityRatio = business.demand / Math.max(1, business.capacity);
  if (quality >= 65 && capacityRatio > 0.95) business.marketingBps = Math.max(150, business.marketingBps - 100);
  else if (quality >= 70 && capacityRatio < 0.58 && business.cashCents > reserve) business.marketingBps = Math.min(1_500, business.marketingBps + 100);

  if (crossedQuarters > 0 && quality >= 65 && business.growthPosture !== 'conservative' && (business.locations ?? 1) < 25) {
    const expansionChance = quality >= 80 ? 0.7 : 0.42;
    const hasRoom = business.cashCents - LOCATION_EXPANSION_COST_CENTS >= reserve;
    const wantsSpace = business.demand / Math.max(1, business.capacity) >= (business.growthPosture === 'aggressive' ? 0.62 : 0.76);
    if (hasRoom && wantsSpace && roll(world) < 1 - Math.pow(1 - expansionChance, crossedQuarters)) {
      business.cashCents -= LOCATION_EXPANSION_COST_CENTS;
      business.locations = (business.locations ?? 1) + 1;
      business.capacity = Math.round(business.capacity * 1.18 + 8);
      business.complexity = clamp((business.complexity ?? 20) + 5);
      world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'business-expansion', amountCents: -LOCATION_EXPANSION_COST_CENTS, fromId: business.id, memo: `${business.managerName ?? 'CEO'} opened a location` });
      recordHistory(world, 'business', `${business.name} expanded automatically`, `${business.managerName ?? 'The CEO'} used available company capital to open location ${business.locations}. You set the growth posture; management handled the routine expansion decision.`, { subjectIds: [business.id], importance: 3 });
    }
  }

  if (crossedQuarters > 0) {
    const failureChance = 1 - Math.pow(1 - managerFailureChance(quality), crossedQuarters);
    if (roll(world) < failureChance) {
      const lossRate = quality >= 80 ? 0.02 : quality >= 60 ? 0.06 : clamp(0.11 + (55 - quality) / 220, 0.11, 0.26);
      const loss = Math.max(50_000, Math.round(Math.max(0, business.cashCents) * lossRate));
      business.cashCents -= loss;
      business.quality = clamp(business.quality - (quality >= 80 ? 1.2 : 4 + (60 - quality) * 0.08));
      business.reputation = clamp(business.reputation - (quality >= 80 ? 1 : 3.5 + (60 - quality) * 0.06));
      business.culture = clamp((business.culture ?? 55) - (quality >= 80 ? 0.8 : 4));
      recordHistory(world, 'business', `${business.name} had an executive miss`, `${business.managerName ?? 'The CEO'} made a costly operating call that burned ${money(loss)}. Strong CEOs can still miss; weak CEOs create this kind of damage much more often.`, { subjectIds: [business.id], importance: quality < 60 ? 4 : 2, important: quality < 50 });
    }
  }

  if (quality < 45 && business.cashCents < -Math.max(2_500_000, business.costWeeklyCents * 8)) {
    business.active = false;
    recordHistory(world, 'business', `${business.name} failed under management`, `${business.managerName ?? 'The CEO'} ran the company through its remaining runway. Delegation removed routine decisions from you; it did not remove the risk of choosing the wrong executive.`, { subjectIds: [business.id, player.id], importance: 5, important: true });
  }
}

function handleDelegatedEvents(world: WorldState): void {
  for (const event of world.events.filter((item) => !item.resolved)) {
    if (event.templateId === 'business.capacity') {
      const business = Object.values(world.businesses).find((item) => event.participantIds.includes(item.organizationId));
      if (!business?.delegated) continue;
      event.resolved = true;
      event.selectedChoiceId = 'delegate';
      recordHistory(world, 'business', `${business.managerName ?? 'The CEO'} handled the capacity problem`, 'Routine staffing and capacity decisions stayed with management instead of interrupting you.', { subjectIds: [business.id], importance: 1 });
    }
    if (event.templateId === 'property.condition') {
      const property = event.participantIds.map((id) => world.properties[id]).find((item) => item?.managed);
      if (!property) continue;
      const player = actor(world);
      const properRepair = Math.round(property.valueCents * 0.012);
      const patch = Math.round(property.valueCents * 0.004);
      const spend = player.cashCents >= properRepair ? properRepair : Math.min(Math.max(0, player.cashCents), patch);
      player.cashCents -= spend;
      property.condition = clamp(property.condition + (spend >= properRepair ? 30 : spend > 0 ? 10 : 0));
      event.resolved = true;
      event.selectedChoiceId = spend >= properRepair ? 'repair' : 'patch';
      if (spend > 0) world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'property-repair', amountCents: -spend, fromId: player.id, toId: property.id, memo: `Manager-arranged repair at ${property.name}` });
      recordHistory(world, 'property', `Management handled ${property.name}`, spend > 0 ? `Your property manager arranged ${money(spend)} of maintenance without turning it into a routine player interruption.` : 'The manager could not fund a repair from available personal cash, so condition remains a risk worth reviewing.', { subjectIds: [property.id], importance: spend > 0 ? 1 : 3 });
    }
  }
}

export function applyDelegationAdvance(before: WorldState, source: WorldState): WorldState {
  const weeks = Math.max(0, source.calendar.week - before.calendar.week);
  if (weeks <= 0) return source;
  const world = clone(source);
  maintainManagedPortfolio(world, weeks);
  const crossedQuarters = Math.max(0, Math.floor(world.calendar.week / 13) - Math.floor(before.calendar.week / 13));
  for (const business of Object.values(world.businesses)) {
    if (!business.active || !business.delegated || (business.ownerId ?? business.founderId) !== world.playerCharacterId || business.playerOwnershipBps <= 0) continue;
    autoManageBusiness(world, business, weeks, crossedQuarters);
  }
  handleDelegatedEvents(world);
  return world;
}
