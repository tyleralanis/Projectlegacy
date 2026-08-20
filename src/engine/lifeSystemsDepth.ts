import { competency, ensureCompetencies, gainCompetency } from './competencies';
import { allocateId, playerAgeYears } from './createWorld';
import { recordHistory } from './history';
import { netWorthCents } from './money';
import { nextRandom } from './random';
import type { ActionResult, CareerState, Character, IntentAction, MemoryRecord, PropertyAsset, WorldState } from './types';

import { ADVISOR_OPTIONS } from '@/content/lifeCatalogs';

const LIFE_SYSTEM_VERBS = new Set([
  'career.negotiate_hours',
  'health.sleep',
  'health.nutrition',
  'health.checkup',
  'health.rehab',
  'health.rest_week',
  'property.screen_tenant',
  'property.repair',
  'property.develop',
  'sports.sign_endorsement',
  'sports.recover',
  'sports.retire',
  'sports.coach',
  'wealth.set_lifestyle',
  'wealth.create_family_office',
]);

export interface LifestyleProfile {
  posture: 'frugal' | 'comfortable' | 'luxury' | 'opulent';
  weeklyCostCents: number;
  label: string;
}

const LIFESTYLES: Record<LifestyleProfile['posture'], Omit<LifestyleProfile, 'posture'>> = {
  frugal: { weeklyCostCents: 0, label: 'Frugal' },
  comfortable: { weeklyCostCents: 35_000, label: 'Comfortable' },
  luxury: { weeklyCostCents: 150_000, label: 'Luxury' },
  opulent: { weeklyCostCents: 600_000, label: 'Opulent' },
};

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

function ok(world: WorldState, message: string): ActionResult {
  return { world, message, validation: { valid: true, requiresConfirmation: false } };
}

function blocked(source: WorldState, message: string): ActionResult {
  return { world: source, message, validation: { valid: false, reason: message, requiresConfirmation: false } };
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function amount(action: IntentAction, fallback: number): number {
  const value = action.parameters.amountCents;
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;
}

function activeCareer(world: WorldState, characterId: string): CareerState | undefined {
  return Object.values(world.careers).find((career) => career.characterId === characterId && career.active);
}

function activeSportsCareer(world: WorldState): CareerState | undefined {
  const actor = world.characters[world.playerCharacterId];
  return Object.values(world.careers).find((career) => career.characterId === actor.id && career.active && (career.sector === 'Sports' || /athlete/i.test(career.title)));
}

function ownedProperty(world: WorldState, targetIds: string[]): PropertyAsset | undefined {
  const actor = world.characters[world.playerCharacterId];
  return targetIds.map((id) => world.properties[id]).find((property) => property?.ownerId === actor.id)
    ?? Object.values(world.properties).find((property) => property.ownerId === actor.id);
}

function upsertMemory(world: WorldState, category: string, participantIds: string[], narrative: string, importance: number, unresolved = true, permanent = false): MemoryRecord {
  const existing = Object.values(world.memories).find((memory) => memory.category === category && participantIds.every((id) => memory.participantIds.includes(id)));
  if (existing) {
    existing.narrative = narrative;
    existing.importance = Math.max(existing.importance, importance);
    existing.week = world.calendar.week;
    existing.unresolved = unresolved;
    existing.permanent = existing.permanent || permanent;
    return existing;
  }
  const id = allocateId(world, 'memory');
  const memory: MemoryRecord = { id, participantIds, category, week: world.calendar.week, valence: unresolved ? -0.25 : 0.25, importance, permanent, unresolved, visibility: 'private', narrative };
  world.memories[id] = memory;
  return memory;
}

function tenantMemory(world: WorldState, propertyId: string): MemoryRecord | undefined {
  return Object.values(world.memories).find((memory) => memory.category === `Property · Tenant · ${propertyId}` && memory.participantIds.includes(propertyId));
}

function developmentMemory(world: WorldState, propertyId: string): MemoryRecord | undefined {
  return Object.values(world.memories).find((memory) => memory.category.startsWith(`Property · Development · ${propertyId} ·`) && memory.unresolved);
}

function sportsInjury(world: WorldState): MemoryRecord | undefined {
  const actor = world.characters[world.playerCharacterId];
  return Object.values(world.memories).find((memory) => memory.category.startsWith('Health · Sports injury') && memory.participantIds.includes(actor.id) && memory.unresolved);
}

function retiredAthleteMemory(world: WorldState): MemoryRecord | undefined {
  const actor = world.characters[world.playerCharacterId];
  return Object.values(world.memories).find((memory) => memory.category === 'Athletics · Retired professional' && memory.participantIds.includes(actor.id));
}

function lifestyleMemory(world: WorldState): MemoryRecord | undefined {
  const actor = world.characters[world.playerCharacterId];
  return Object.values(world.memories).find((memory) => memory.category === 'Wealth · Lifestyle posture' && memory.participantIds.includes(actor.id));
}

export function lifestyleProfile(world: WorldState): LifestyleProfile {
  const memory = lifestyleMemory(world);
  const raw = memory?.narrative.match(/^posture:(frugal|comfortable|luxury|opulent)\b/)?.[1] as LifestyleProfile['posture'] | undefined;
  const posture = raw ?? 'frugal';
  return { posture, ...LIFESTYLES[posture] };
}

function advisorAnnualCost(organizationName: string): number | undefined {
  const normalized = organizationName.toLowerCase();
  return ADVISOR_OPTIONS.find((option) => normalized.includes(option.role.toLowerCase()))?.annualCostCents;
}

function advisorStartWeek(world: WorldState, organizationId: string): number | undefined {
  return world.transactions.filter((transaction) => transaction.kind === 'advisor-retainer' && transaction.toId === organizationId).sort((left, right) => left.week - right.week)[0]?.week;
}

function createTenant(world: WorldState, property: PropertyAsset): Character {
  const actor = world.characters[world.playerCharacterId];
  const firstNames = ['Avery', 'Maya', 'Jordan', 'Nora', 'Eli', 'Sofia', 'Cameron', 'Mina', 'Quinn', 'Theo'];
  const lastNames = ['Brooks', 'Patel', 'Nguyen', 'Rivera', 'Bennett', 'Okafor', 'Kim', 'Morgan', 'Price', 'Shah'];
  const id = allocateId(world, 'character');
  const age = 22 + Math.floor(roll(world) * 38);
  const person: Character = {
    id,
    firstName: firstNames[Math.floor(roll(world) * firstNames.length) % firstNames.length],
    lastName: lastNames[Math.floor(roll(world) * lastNames.length) % lastNames.length],
    birthWeek: world.calendar.week - age * 52,
    isAlive: true,
    cityId: property.cityId,
    householdId: `household-${id}`,
    parentIds: [],
    childIds: [],
    cashCents: Math.round(400_000 + roll(world) * 4_500_000),
    health: 62 + roll(world) * 30,
    mood: 52 + roll(world) * 34,
    stress: 18 + roll(world) * 46,
    discipline: 38 + roll(world) * 52,
    ambition: 34 + roll(world) * 58,
    empathy: 35 + roll(world) * 56,
    riskTolerance: 25 + roll(world) * 60,
    ethics: 38 + roll(world) * 56,
    knowledge: 35 + roll(world) * 55,
    charisma: 35 + roll(world) * 55,
    fitness: 34 + roll(world) * 56,
    focuses: ['Job', 'Family', 'Health'],
    reputation: { public: 45, business: 42, employee: 52, political: 32, professional: 48, family: 55, faction: 12 },
    detailTier: 'standard',
    lastMeaningfulWeek: world.calendar.week,
  };
  ensureCompetencies(person);
  world.characters[id] = person;
  const relationshipId = allocateId(world, 'relationship');
  world.relationships[relationshipId] = { id: relationshipId, characterIds: [actor.id, id], kind: 'professional', trust: 42, affection: 18, respect: 48, resentment: 0, lastInteractionWeek: world.calendar.week };
  return person;
}

function careerHours(source: WorldState, action: IntentAction): ActionResult {
  const actor = source.characters[source.playerCharacterId];
  const career = activeCareer(source, actor.id);
  if (!career) return blocked(source, 'You need an active job before negotiating the schedule.');
  const requested = typeof action.parameters.hours === 'number' ? Math.round(action.parameters.hours) : 32;
  if (![20, 32, 40, 50].includes(requested)) return blocked(source, 'Choose 20, 32, 40, or 50 hours per week.');
  const currentHours = career.hoursPerWeek ?? 40;
  if (requested === currentHours) return blocked(source, `The role is already set at ${requested} hours per week.`);
  const world = clone(source);
  const nextCareer = world.careers[career.id];
  const nextActor = world.characters[actor.id];
  const standing = nextCareer.organizationStanding ?? 48;
  const leverage = nextCareer.performance * 0.28 + standing * 0.25 + competency(world, actor.id, 'negotiation') * 0.27 + nextActor.reputation.professional * 0.2;

  if (requested < currentHours) {
    const levelPenalty = (nextCareer.level ?? 2) >= 5 && requested < 40 ? 14 : 0;
    const cut = currentHours - requested;
    const threshold = 48 + cut * 0.8 + levelPenalty;
    if (leverage + roll(world) * 22 < threshold) {
      nextCareer.satisfaction = clamp(nextCareer.satisfaction - 2);
      return ok(world, `You asked to reduce the job to ${requested} hours, but the organization said no. Seniority, performance, internal standing, and negotiation skill were not enough for that much flexibility.`);
    }
    const ratio = requested / Math.max(1, currentHours);
    nextCareer.hoursPerWeek = requested;
    nextCareer.weeklySalaryCents = Math.round(nextCareer.weeklySalaryCents * (0.16 + ratio * 0.84));
    nextCareer.promotionProgress = clamp((nextCareer.promotionProgress ?? 0) - Math.max(1, cut * 0.35));
    nextCareer.satisfaction = clamp(nextCareer.satisfaction + 6);
    gainCompetency(nextActor, 'negotiation', 1.1);
    recordHistory(world, 'career', 'Bought back some of the week', `You negotiated ${requested} hours per week in ${nextCareer.title}. Pay and promotion velocity gave up ground so the rest of the life could have more room.`, { importance: 3 });
    return ok(world, `The job is now ${requested} hours per week. Pay fell, but those hours are genuinely available to the rest of your life.`);
  }

  nextCareer.hoursPerWeek = requested;
  const ratio = requested / Math.max(1, currentHours);
  nextCareer.weeklySalaryCents = Math.round(nextCareer.weeklySalaryCents * Math.min(1.18, 0.92 + ratio * 0.08));
  nextCareer.performance = clamp(nextCareer.performance + 2);
  nextCareer.promotionProgress = clamp((nextCareer.promotionProgress ?? 0) + 3);
  nextActor.stress = clamp(nextActor.stress + 2.5);
  recordHistory(world, 'career', 'Work took more of the week', `You increased the role to ${requested} hours. The career gets more of you now, which means the opportunity-cost system will decide what gets less.`, { importance: 2 });
  return ok(world, `The job now expects roughly ${requested} hours per week. Career momentum improved a little and the rest of your schedule got tighter.`);
}

function healthAction(source: WorldState, action: IntentAction): ActionResult {
  const actor = source.characters[source.playerCharacterId];
  const world = clone(source);
  const nextActor = world.characters[actor.id];

  if (action.verb === 'health.sleep') {
    nextActor.stress = clamp(nextActor.stress - 4.5);
    nextActor.mood = clamp(nextActor.mood + 2.2);
    nextActor.health = clamp(nextActor.health + 0.7);
    return ok(world, 'You protected sleep and recovery instead of treating exhaustion as free productivity. Stress fell and the body got a little room to recover.');
  }

  if (action.verb === 'health.nutrition') {
    const cost = amount(action, 12_000);
    if (nextActor.cashCents < cost) return blocked(source, `You need ${money(cost)} for the planned food and preparation costs.`);
    nextActor.cashCents -= cost;
    nextActor.health = clamp(nextActor.health + 1.1);
    nextActor.fitness = clamp(nextActor.fitness + 0.5);
    nextActor.mood = clamp(nextActor.mood + 0.5);
    world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'wellness-nutrition', amountCents: -cost, fromId: actor.id, memo: 'Deliberate nutrition and meal preparation' });
    return ok(world, `You spent ${money(cost)} making food and routine more deliberate. Health improved slightly without pretending one week of eating well changes a life.`);
  }

  if (action.verb === 'health.checkup') {
    const cost = amount(action, 25_000);
    if (nextActor.cashCents < cost) return blocked(source, `You need ${money(cost)} for the checkup.`);
    nextActor.cashCents -= cost;
    world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'healthcare', amountCents: -cost, fromId: actor.id, memo: 'Routine health checkup' });
    nextActor.health = clamp(nextActor.health + 0.5);
    const unresolved = Object.values(world.memories).filter((memory) => memory.participantIds.includes(actor.id) && memory.unresolved && memory.category.startsWith('Health ·'));
    if (unresolved.length > 0) {
      for (const memory of unresolved) {
        memory.importance = Math.max(35, memory.importance - 8);
        memory.narrative = `${memory.narrative} A routine checkup added monitoring and a clearer plan rather than leaving the issue completely unmanaged.`;
      }
      return ok(world, `The checkup did not magically erase anything, but ${unresolved.length} active health issue${unresolved.length === 1 ? '' : 's'} became better monitored.`);
    }
    if (playerAgeYears(world) >= 40 || nextActor.health < 65 || nextActor.stress > 72) {
      upsertMemory(world, 'Health · Preventive monitoring', [actor.id], 'A routine checkup did not find a crisis, but age, stress, and ordinary risk are now something you are actually monitoring instead of assuming health will always be background.', 48, false);
    }
    return ok(world, 'The checkup was reassuring enough. Preventive care is now part of the health story rather than something that only appears after a crisis.');
  }

  if (action.verb === 'health.rehab') {
    const injury = sportsInjury(world) ?? Object.values(world.memories).find((memory) => memory.participantIds.includes(actor.id) && memory.unresolved && memory.category.startsWith('Health ·'));
    if (!injury) return blocked(source, 'There is no active injury or health issue that currently needs structured rehab.');
    const cost = amount(action, 18_000);
    if (nextActor.cashCents < cost) return blocked(source, `You need ${money(cost)} for the rehab session.`);
    nextActor.cashCents -= cost;
    nextActor.health = clamp(nextActor.health + 1.3);
    nextActor.fitness = clamp(nextActor.fitness + 1);
    nextActor.stress = clamp(nextActor.stress - 1.4);
    injury.importance = Math.max(30, injury.importance - 12);
    if (injury.importance <= 42) injury.unresolved = false;
    injury.narrative = `${injury.narrative} Structured rehab improved the recovery trajectory.`;
    world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'healthcare', amountCents: -cost, fromId: actor.id, memo: 'Rehabilitation' });
    return ok(world, injury.unresolved ? 'Rehab helped, but the issue still needs time and management.' : 'The rehab work was enough to move the issue out of active recovery.');
  }

  nextActor.stress = clamp(nextActor.stress - 7);
  nextActor.mood = clamp(nextActor.mood + 4);
  nextActor.health = clamp(nextActor.health + 1.2);
  const career = activeCareer(world, actor.id);
  if (career) career.performance = clamp(career.performance - 0.8);
  return ok(world, 'You deliberately took a low-output recovery week. Work gave up a little momentum so stress, mood, and health could recover.');
}

function propertyAction(source: WorldState, action: IntentAction): ActionResult {
  const actor = source.characters[source.playerCharacterId];
  const property = ownedProperty(source, action.targetIds);
  if (!property) return blocked(source, 'Choose a property you own.');

  if (action.verb === 'property.screen_tenant') {
    if (property.occupancy === 'owner') return blocked(source, 'Move out before screening tenants for your own residence.');
    if (property.occupancy === 'tenant' && tenantMemory(source, property.id)?.unresolved) return blocked(source, 'This property already has an active tenant relationship.');
    if (property.weeklyRentCents <= 0) return blocked(source, 'Set a viable rent before screening a tenant.');
    const world = clone(source);
    const nextProperty = world.properties[property.id];
    const tenant = createTenant(world, nextProperty);
    const affordability = tenant.cashCents * 0.08 + tenant.discipline * 4_000;
    const asking = nextProperty.weeklyRentCents * 4.33;
    const fit = tenant.discipline * 0.33 + tenant.ethics * 0.27 + tenant.reputation.professional * 0.18 + Math.min(30, affordability / Math.max(1, asking) * 10) + roll(world) * 18;
    if (fit < 47) {
      const relationship = Object.values(world.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(tenant.id));
      if (relationship) relationship.kind = 'acquaintance';
      return ok(world, `${tenant.firstName} ${tenant.lastName} applied, but the screening profile was not strong enough. You met a real person without filling the unit.`);
    }
    nextProperty.occupancy = 'tenant';
    const memory = upsertMemory(world, `Property · Tenant · ${property.id}`, [actor.id, tenant.id, property.id], `${tenant.firstName} ${tenant.lastName} leases ${nextProperty.name} at ${money(nextProperty.weeklyRentCents)}/week. Their satisfaction will react to condition, rent, maintenance, and how you manage the property.`, 60, true);
    memory.visibility = 'shared';
    recordHistory(world, 'property', `${tenant.firstName} rented ${nextProperty.name}`, 'The rent roll now has an actual tenant relationship behind it rather than an anonymous occupancy flag.', { subjectIds: [actor.id, tenant.id, property.id], importance: 3 });
    return ok(world, `${tenant.firstName} ${tenant.lastName} passed screening and rented ${nextProperty.name}. The tenant can now react to the way you manage the asset.`);
  }

  if (action.verb === 'property.repair') {
    const cost = amount(action, Math.max(75_000, Math.round(property.valueCents * 0.0075)));
    if (actor.cashCents < cost) return blocked(source, `You need ${money(cost)} in cash for the repair plan.`);
    const world = clone(source);
    const nextActor = world.characters[actor.id];
    const nextProperty = world.properties[property.id];
    nextActor.cashCents -= cost;
    const improvement = clamp(6 + Math.log10(Math.max(10, cost / 100)) * 2.8, 6, 24);
    nextProperty.condition = clamp(nextProperty.condition + improvement);
    nextProperty.valueCents = Math.round(nextProperty.valueCents * (1 + improvement / 450));
    const memory = tenantMemory(world, property.id);
    if (memory?.unresolved) {
      const tenantId = memory.participantIds.find((id) => world.characters[id] && id !== actor.id);
      const relationship = tenantId ? Object.values(world.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(tenantId)) : undefined;
      if (relationship) {
        relationship.trust = clamp(relationship.trust + 4);
        relationship.respect = clamp(relationship.respect + 3);
        relationship.resentment = clamp(relationship.resentment - 4);
      }
    }
    world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'property-repair', amountCents: -cost, fromId: actor.id, toId: property.id, memo: `Repairs at ${property.name}` });
    return ok(world, `You spent ${money(cost)} repairing ${property.name}. Condition, value, and any active tenant relationship improved together.`);
  }

  if (property.kind !== 'land' || property.occupancy === 'construction') return blocked(source, 'Ground-up development currently starts with an owned land parcel that is not already under construction.');
  const targetKind = action.parameters.targetKind === 'commercial' ? 'commercial' : 'multifamily';
  const cost = amount(action, Math.max(10_000_000, Math.round(property.valueCents * (targetKind === 'commercial' ? 0.72 : 0.58))));
  if (actor.cashCents < cost) return blocked(source, `The development plan needs ${money(cost)} in available cash before construction begins.`);
  const world = clone(source);
  const nextActor = world.characters[actor.id];
  const nextProperty = world.properties[property.id];
  nextActor.cashCents -= cost;
  nextProperty.occupancy = 'construction';
  nextProperty.kind = 'development';
  nextProperty.weeklyCostsCents = Math.max(nextProperty.weeklyCostsCents, Math.round(cost / 260));
  upsertMemory(world, `Property · Development · ${property.id} · ${targetKind}`, [actor.id, property.id], `${property.name} entered construction for a ${targetKind} project in week ${world.calendar.week}. The build ties up cash, creates carrying costs, and will take about a year before the asset can operate.`, 78, true, true);
  world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'property-development', amountCents: -cost, fromId: actor.id, toId: property.id, memo: `${targetKind} development at ${property.name}` });
  recordHistory(world, 'property', `Development began at ${property.name}`, `You committed ${money(cost)} to turn land into a ${targetKind} project. The asset is now a construction story rather than passive land appreciation.`, { important: true, subjectIds: [actor.id, property.id], importance: 4 });
  return ok(world, `Construction started. ${property.name} is now a ${targetKind} development with real carrying costs and a roughly one-year build.`);
}

function sportsAction(source: WorldState, action: IntentAction): ActionResult {
  const actor = source.characters[source.playerCharacterId];
  const sportsCareer = activeSportsCareer(source);

  if (action.verb === 'sports.sign_endorsement') {
    if (!sportsCareer) return blocked(source, 'You need an active professional sports career before endorsement deals become serious.');
    if (actor.reputation.public < 60 || sportsCareer.performance < 60) return blocked(source, 'Your public profile and recent performance are not strong enough for a meaningful endorsement yet.');
    const world = clone(source);
    const nextActor = world.characters[actor.id];
    const nextCareer = world.careers[sportsCareer.id];
    const media = competency(world, actor.id, 'media');
    const communication = competency(world, actor.id, 'communication');
    const value = Math.round((nextActor.reputation.public * 45_000 + nextCareer.performance * 28_000 + media * 18_000 + communication * 9_000) * (0.7 + roll(world) * 0.8));
    nextActor.cashCents += value;
    nextActor.reputation.public = clamp(nextActor.reputation.public + 2.5);
    gainCompetency(nextActor, 'media', 1.1);
    world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'endorsement', amountCents: value, toId: actor.id, memo: 'Professional sports endorsement' });
    upsertMemory(world, 'Athletics · Endorsement', [actor.id, sportsCareer.id], `A brand paid ${money(value)} to attach itself to your public profile. Endorsements now make fame financially relevant without replacing athletic performance as the thing that created the audience.`, 66, false);
    return ok(world, `You signed an endorsement worth ${money(value)}. Media skill and public reputation now matter alongside performance.`);
  }

  if (action.verb === 'sports.recover') {
    const injury = sportsInjury(source);
    if (!injury) return blocked(source, 'There is no active sports injury requiring a recovery block.');
    const world = clone(source);
    const nextActor = world.characters[actor.id];
    const nextInjury = world.memories[injury.id];
    nextActor.stress = clamp(nextActor.stress - 5);
    nextActor.health = clamp(nextActor.health + 2);
    nextActor.fitness = clamp(nextActor.fitness + 0.8);
    nextInjury.importance = Math.max(28, nextInjury.importance - 18);
    if (nextInjury.importance <= 40) nextInjury.unresolved = false;
    const career = activeSportsCareer(world);
    if (career) career.performance = clamp(career.performance - 1.5);
    return ok(world, nextInjury.unresolved ? 'You gave the injury a real recovery block. Fitness and health are moving back, but you are not fully cleared yet.' : 'The recovery block moved the injury out of active status. You gave up short-term performance to preserve the longer career.');
  }

  if (action.verb === 'sports.retire') {
    if (!sportsCareer) return blocked(source, 'You do not have an active professional sports career to retire from.');
    const world = clone(source);
    const nextCareer = world.careers[sportsCareer.id];
    nextCareer.active = false;
    const nextActor = world.characters[actor.id];
    nextActor.stress = clamp(nextActor.stress - 6);
    upsertMemory(world, 'Athletics · Retired professional', [actor.id, sportsCareer.id], `${actor.firstName} retired from ${sportsCareer.title} after ${Math.floor(sportsCareer.weeksInRole / 52)} years. Athletic reputation and skill remain available for coaching, media, ownership, or politics even though the playing career is over.`, 88, false, true);
    recordHistory(world, 'career', 'Retired from professional sports', 'The playing career ended, but the reputation, network, money, injuries, and skills it created remain available to the rest of the life.', { important: true, importance: 5 });
    return ok(world, 'You retired from professional sports. The career is over; the identity and leverage it created are not.');
  }

  if (!retiredAthleteMemory(source)) return blocked(source, 'A coaching career becomes available after a meaningful professional playing career ends.');
  const world = clone(source);
  const nextActor = world.characters[actor.id];
  Object.values(world.careers).forEach((career) => { if (career.characterId === actor.id) career.active = false; });
  const id = allocateId(world, 'career');
  const salary = Math.round(110_000 + competency(world, actor.id, 'athletics') * 2_200 + competency(world, actor.id, 'leadership') * 1_600 + nextActor.reputation.public * 1_000);
  world.careers[id] = { id, characterId: actor.id, employerId: 'organization-pro-sports', title: 'Professional coach', sector: 'Sports', weeklySalaryCents: salary, performance: clamp(52 + competency(world, actor.id, 'leadership') * 0.22 + competency(world, actor.id, 'athletics') * 0.18), satisfaction: 74, weeksInRole: 0, active: true, hoursPerWeek: 48, level: 5, department: 'Coaching', promotionProgress: 8, organizationStanding: 58 };
  gainCompetency(nextActor, 'leadership', 1);
  recordHistory(world, 'career', 'Returned to sport as a coach', 'The athletic career changed form. Experience and reputation are now being converted into leadership rather than physical performance.', { importance: 4 });
  return ok(world, `You started coaching professionally at about ${money(salary * 52)}/year. Athletic knowledge now has to become leadership.`);
}

function wealthAction(source: WorldState, action: IntentAction): ActionResult {
  const actor = source.characters[source.playerCharacterId];
  if (action.verb === 'wealth.set_lifestyle') {
    const posture = typeof action.parameters.posture === 'string' ? action.parameters.posture as LifestyleProfile['posture'] : 'comfortable';
    if (!LIFESTYLES[posture]) return blocked(source, 'Choose frugal, comfortable, luxury, or opulent.');
    const world = clone(source);
    const nextActor = world.characters[actor.id];
    const existing = lifestyleMemory(world);
    const narrative = `posture:${posture} · ${LIFESTYLES[posture].label} lifestyle adds about ${money(LIFESTYLES[posture].weeklyCostCents)} per week beyond ordinary household costs. Lifestyle is a choice, not an automatic punishment for getting rich.`;
    if (existing) {
      existing.narrative = narrative;
      existing.week = world.calendar.week;
      existing.unresolved = false;
    } else upsertMemory(world, 'Wealth · Lifestyle posture', [actor.id], narrative, 46, false, false);
    nextActor.mood = clamp(nextActor.mood + (posture === 'opulent' ? 2 : posture === 'luxury' ? 1 : posture === 'frugal' ? -0.5 : 0.4));
    return ok(world, `Lifestyle set to ${LIFESTYLES[posture].label}. The cash-flow consequences will now recur every week.`);
  }

  const worth = netWorthCents(source);
  const familyOffice = Object.values(source.organizations).find((organization) => organization.kind === 'professional' && organization.memberIds.includes(actor.id) && /family office/i.test(organization.name));
  if (familyOffice) return blocked(source, 'You already have a family office coordinating the complexity.');
  const option = ADVISOR_OPTIONS.find((item) => item.id === 'family-office')!;
  if (worth < option.minimumNetWorthCents) return blocked(source, `A true family office becomes sensible around ${money(option.minimumNetWorthCents)} of net worth. Below that, separate advisors are usually more efficient.`);
  if (actor.cashCents < option.annualCostCents) return blocked(source, `You need ${money(option.annualCostCents)} in liquid cash for the first year.`);
  const world = clone(source);
  const nextActor = world.characters[actor.id];
  nextActor.cashCents -= option.annualCostCents;
  const orgId = allocateId(world, 'organization');
  world.organizations[orgId] = { id: orgId, kind: 'professional', name: `${actor.lastName} Family Office`, resourcesCents: option.annualCostCents, influence: 82, stability: 86, memberIds: [actor.id], leaderId: actor.id, history: [`Retained by ${actor.firstName} ${actor.lastName} for ${money(option.annualCostCents)} per year.`] };
  world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'advisor-retainer', amountCents: -option.annualCostCents, fromId: actor.id, toId: orgId, memo: 'Family office annual retainer' });
  upsertMemory(world, 'Wealth · Family office', [actor.id, orgId], 'The fortune now has an institution whose job is coordination: entities, advisors, reporting, succession, liquidity, and administration. It buys back time without making the family or capital decisions disappear.', 82, false, true);
  return ok(world, `You created the ${actor.lastName} Family Office for ${money(option.annualCostCents)} per year. Wealth administration will consume much less of your personal week.`);
}

export function executeLifeSystemsDepth(source: WorldState, action: IntentAction): ActionResult | null {
  if (!LIFE_SYSTEM_VERBS.has(action.verb)) return null;
  if (action.verb === 'career.negotiate_hours') return careerHours(source, action);
  if (action.verb.startsWith('health.')) return healthAction(source, action);
  if (action.verb.startsWith('property.')) return propertyAction(source, action);
  if (action.verb.startsWith('sports.')) return sportsAction(source, action);
  if (action.verb.startsWith('wealth.')) return wealthAction(source, action);
  return null;
}

function processLifestyle(world: WorldState, weeks: number): void {
  const actor = world.characters[world.playerCharacterId];
  const profile = lifestyleProfile(world);
  if (profile.weeklyCostCents <= 0) return;
  const cost = profile.weeklyCostCents * weeks;
  actor.cashCents -= cost;
  world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'lifestyle', amountCents: -cost, fromId: actor.id, memo: `${profile.label} lifestyle · ${weeks} week${weeks === 1 ? '' : 's'}` });
  if (actor.cashCents < 0 && profile.posture !== 'frugal') upsertMemory(world, 'Wealth · Lifestyle pressure', [actor.id], `The ${profile.label.toLowerCase()} lifestyle is now consuming liquidity you do not comfortably have. Status and comfort are beginning to compete with financial resilience.`, 68, true);
  else {
    const pressure = Object.values(world.memories).find((memory) => memory.category === 'Wealth · Lifestyle pressure' && memory.participantIds.includes(actor.id) && memory.unresolved);
    if (pressure && actor.cashCents > profile.weeklyCostCents * 26) pressure.unresolved = false;
  }
}

function processAdvisorRenewals(before: WorldState, world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  for (const organization of Object.values(world.organizations).filter((item) => item.kind === 'professional' && item.memberIds.includes(actor.id))) {
    const cost = advisorAnnualCost(organization.name) ?? (/family office/i.test(organization.name) ? ADVISOR_OPTIONS.find((item) => item.id === 'family-office')!.annualCostCents : undefined);
    if (!cost) continue;
    const started = advisorStartWeek(world, organization.id);
    if (started === undefined) continue;
    const beforeYears = Math.max(0, Math.floor((before.calendar.week - started) / 52));
    const afterYears = Math.max(0, Math.floor((world.calendar.week - started) / 52));
    const renewals = Math.max(0, afterYears - beforeYears);
    if (renewals <= 0) continue;
    const total = cost * renewals;
    actor.cashCents -= total;
    organization.resourcesCents += total;
    world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'advisor-retainer', amountCents: -total, fromId: actor.id, toId: organization.id, memo: `${organization.name} renewal` });
    if (actor.cashCents < 0) upsertMemory(world, `Wealth · Advisor pressure · ${organization.id}`, [actor.id, organization.id], `${organization.name} renewed for ${money(total)}, but liquidity is now negative. High-end services remain available only while somebody actually pays the retainers.`, 60, true);
  }
}

function processPropertyRelationships(world: WorldState, weeks: number): void {
  const actor = world.characters[world.playerCharacterId];
  for (const property of Object.values(world.properties).filter((item) => item.ownerId === actor.id)) {
    const development = developmentMemory(world, property.id);
    if (development) {
      const age = world.calendar.week - development.week;
      if (age >= 52) {
        const targetKind = development.category.endsWith('commercial') ? 'commercial' : 'multifamily';
        property.kind = targetKind;
        property.occupancy = 'vacant';
        property.condition = Math.max(88, property.condition);
        property.valueCents = Math.round(property.valueCents * (targetKind === 'commercial' ? 1.62 : 1.48));
        property.weeklyRentCents = Math.round(property.valueCents * (targetKind === 'commercial' ? 0.00072 : 0.00082));
        property.weeklyCostsCents = Math.round(property.valueCents * 0.00013);
        development.unresolved = false;
        development.narrative = `${development.narrative} Construction later completed and the property entered the market as a ${targetKind} asset.`;
        recordHistory(world, 'property', `${property.name} completed construction`, `The development is now an operating ${targetKind} asset. Construction risk gave way to leasing and operating risk.`, { important: true, subjectIds: [actor.id, property.id], importance: 4 });
      }
    }

    const tenant = tenantMemory(world, property.id);
    if (!tenant?.unresolved || property.occupancy !== 'tenant') continue;
    const tenantId = tenant.participantIds.find((id) => id !== actor.id && world.characters[id]);
    const person = tenantId ? world.characters[tenantId] : undefined;
    const relationship = person ? Object.values(world.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(person.id)) : undefined;
    if (!person?.isAlive || !relationship) continue;
    const rentPressure = property.valueCents > 0 ? property.weeklyRentCents * 52 / property.valueCents : 0;
    const conditionEffect = (property.condition - 60) * 0.005 * weeks;
    const priceEffect = Math.max(0, rentPressure - 0.065) * 22 * weeks;
    relationship.trust = clamp(relationship.trust + conditionEffect - priceEffect * 0.4);
    relationship.respect = clamp(relationship.respect + conditionEffect * 0.5);
    relationship.resentment = clamp(relationship.resentment - Math.max(0, conditionEffect * 0.3) + priceEffect);
    relationship.lastInteractionWeek = Math.max(relationship.lastInteractionWeek, world.calendar.week - 8);
    if ((relationship.resentment >= 68 || property.condition < 32) && roll(world) < Math.min(0.65, weeks / 20)) {
      property.occupancy = 'vacant';
      tenant.unresolved = false;
      tenant.narrative = `${tenant.narrative} ${person.firstName} eventually left after condition, price, or accumulated landlord friction made the tenancy not worth continuing.`;
      relationship.kind = 'acquaintance';
      recordHistory(world, 'property', `${person.firstName} moved out of ${property.name}`, 'The vacancy was not a random occupancy flip. The tenant relationship deteriorated enough to end the lease.', { subjectIds: [actor.id, person.id, property.id], importance: 3 });
    }
  }
}

function processSportsCareer(world: WorldState, weeks: number): void {
  const career = activeSportsCareer(world);
  if (!career) return;
  const actor = world.characters[world.playerCharacterId];
  const athletics = competency(world, actor.id, 'athletics');
  const age = playerAgeYears(world);
  const injury = sportsInjury(world);
  const injuryPenalty = injury ? Math.min(18, injury.importance * 0.18) : 0;
  const physical = athletics * 0.4 + actor.fitness * 0.3 + actor.health * 0.2 + actor.discipline * 0.1 - injuryPenalty;
  career.performance = clamp(career.performance + (physical - career.performance) * 0.012 * weeks + (actor.focuses.includes('Sport') ? 0.05 * weeks : -0.02 * weeks));
  actor.reputation.public = clamp(actor.reputation.public + Math.max(-0.04, (career.performance - 62) / 1500) * weeks);
  gainCompetency(actor, 'athletics', Math.min(1.6, weeks / 20));
  if (career.performance >= 78) gainCompetency(actor, 'media', Math.min(0.5, weeks / 45));

  if (injury) {
    const recoveryWeeks = world.calendar.week - injury.week;
    const naturalRecovery = recoveryWeeks >= Math.max(8, 22 - actor.health / 7);
    if (naturalRecovery) {
      injury.importance = Math.max(30, injury.importance - weeks * 1.2);
      if (injury.importance <= 42) {
        injury.unresolved = false;
        injury.narrative = `${injury.narrative} Time, recovery, and health eventually moved the injury out of active status.`;
      }
    }
  }

  const quarterCross = world.calendar.week % 13 < weeks;
  if (!injury && quarterCross) {
    const ageRisk = Math.max(0, age - 28) * 0.004;
    const fatigueRisk = Math.max(0, actor.stress - 60) * 0.003 + Math.max(0, 70 - actor.health) * 0.003;
    const trainingRisk = Math.max(0, (career.hoursPerWeek ?? 46) - 44) * 0.004;
    const protection = Math.max(0, actor.fitness - 60) * 0.002 + athletics * 0.0008;
    const risk = clamp(0.035 + ageRisk + fatigueRisk + trainingRisk - protection, 0.015, 0.32);
    if (roll(world) < risk) {
      const severity = Math.round(52 + roll(world) * 38);
      actor.health = clamp(actor.health - severity * 0.08);
      actor.fitness = clamp(actor.fitness - severity * 0.1);
      career.performance = clamp(career.performance - severity * 0.12);
      upsertMemory(world, `Health · Sports injury · ${career.id}`, [actor.id, career.id], `A professional sports injury interrupted the season. Severity ${severity}/100. Recovery time, health, age, workload, and rehab now matter more than simply pressing Train again.`, severity, true, severity >= 78);
      recordHistory(world, 'health', 'A sports injury changed the season', 'The body imposed a constraint on the athletic career. Short-term performance and long-term health are now in the same decision.', { subjectIds: [actor.id, career.id], importance: severity >= 78 ? 4 : 3 });
    }
  }

  if (age >= 37 && career.performance < 62) upsertMemory(world, 'Athletics · Retirement pressure', [actor.id, career.id], `The playing career is reaching the stage where recovery, age, and performance are all asking the same question. Retirement, coaching, media, ownership, or another career can now become more valuable than squeezing out one more season.`, 68, true);
}

function processHealthPressure(world: WorldState, weeks: number): void {
  const actor = world.characters[world.playerCharacterId];
  const age = playerAgeYears(world);
  const activeIssues = Object.values(world.memories).filter((memory) => memory.participantIds.includes(actor.id) && memory.unresolved && memory.category.startsWith('Health ·'));
  const annualCross = world.calendar.week % 52 < weeks;
  if (!annualCross) return;
  const pressure = Math.max(0, actor.stress - 68) * 0.38 + Math.max(0, 62 - actor.health) * 0.46 + Math.max(0, age - 42) * 0.3;
  if (activeIssues.length === 0 && pressure + roll(world) * 38 >= 35) {
    const category = actor.stress >= 78 ? 'Health · Chronic stress load' : age >= 58 ? 'Health · Aging limitation' : 'Health · Ongoing health issue';
    upsertMemory(world, category, [actor.id], actor.stress >= 78 ? 'Stress has stopped being only a mood number. Recovery is getting slower and the pace of the life is beginning to create a persistent health burden.' : age >= 58 ? 'Age is beginning to turn recovery and physical capacity into a planning constraint. Health can still be managed, but it no longer behaves like an unlimited background resource.' : 'A persistent health issue has begun demanding attention. It is intentionally modeled at a high level: care, recovery, cost, time, and consequences matter more than medical minutiae.', Math.round(clamp(48 + pressure * 0.7, 48, 82)), true);
  }
}

function completeNpcEducation(world: WorldState, weeks: number): void {
  for (const education of Object.values(world.education)) {
    if (education.characterId === world.playerCharacterId || !['higher', 'trade'].includes(education.status)) continue;
    const person = world.characters[education.characterId];
    if (!person?.isAlive) continue;
    const enrolled = world.calendar.week - (education.startedWeek ?? world.calendar.week);
    const required = education.status === 'trade' ? 104 : 208;
    if (enrolled < required) {
      education.recordedGrade = clamp(education.recordedGrade + (competency(world, person.id, 'academics') - 50) * 0.002 * weeks + (person.discipline - 50) * 0.0015 * weeks);
      continue;
    }
    education.status = 'completed';
    person.knowledge = clamp(person.knowledge + 5);
    person.reputation.professional = clamp(person.reputation.professional + education.prestige * 0.06);
    const relation = Object.values(world.relationships).find((item) => item.characterIds.includes(world.playerCharacterId) && item.characterIds.includes(person.id));
    if (relation && ['child', 'sibling', 'friend', 'partner', 'spouse'].includes(relation.kind)) recordHistory(world, 'education', `${person.firstName} finished ${education.level}`, `${person.firstName}'s education now becomes part of their own career and opportunity set instead of waiting for the player to trigger it.`, { subjectIds: [person.id, education.id], importance: relation.kind === 'child' ? 4 : 2 });
  }
}

export function applyLifeSystemsAdvance(before: WorldState, source: WorldState): WorldState {
  const weeks = Math.max(0, source.calendar.week - before.calendar.week);
  if (weeks <= 0) return source;
  const world = clone(source);
  processLifestyle(world, weeks);
  processAdvisorRenewals(before, world);
  processPropertyRelationships(world, weeks);
  processSportsCareer(world, weeks);
  processHealthPressure(world, weeks);
  completeNpcEducation(world, weeks);
  return world;
}
