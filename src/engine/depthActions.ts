import { allocateId, playerAgeYears } from './createWorld';
import { clampCents } from './money';
import { nextRandom } from './random';
import type { ActionResult, IntentAction, WorldState } from './types';

import { WELLNESS_ACTIVITIES } from '@/content/lifeCatalogs';
import { WORLD_CONTENT } from '@/content/worldContent';

const DEPTH_VERBS = new Set([
  'education.apply',
  'education.party',
  'education.sports',
  'career.apply',
  'business.create',
  'business.delegate',
  'property.buy',
  'property.evict',
  'markets.hire_wealth_manager',
  'organization.hire_advisor',
  'health.run',
  'health.gym',
  'health.group_class',
  'health.therapy',
  'health.outdoors',
  'life.move_city',
  'life.emigrate',
  'politics.press_conference',
  'politics.town_hall',
  'politics.fundraiser',
  'politics.constituent_work',
  'legal.hire_private_counsel',
]);

function cloneWorld(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world)) as WorldState;
}

function roll(world: WorldState): number {
  const next = nextRandom(world.rngState);
  world.rngState = next.state;
  return next.value;
}

function numberParam(action: IntentAction, key: string, fallback = 0): number {
  const value = action.parameters[key];
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
}

function stringParam(action: IntentAction, key: string, fallback = ''): string {
  const value = action.parameters[key];
  return typeof value === 'string' ? value : fallback;
}

function result(world: WorldState, message: string): ActionResult {
  return { world, message, validation: { valid: true, requiresConfirmation: false } };
}

function rejected(source: WorldState, reason: string, requiresConfirmation = false): ActionResult {
  return { world: source, message: reason, validation: { valid: false, reason, requiresConfirmation } };
}

function addTransaction(world: WorldState, kind: string, amountCents: number, memo: string, fromId?: string, toId?: string) {
  world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind, amountCents: clampCents(amountCents), fromId, toId, memo });
}

function totalExperience(world: WorldState, actorId: string): number {
  return Object.values(world.careers).filter((career) => career.characterId === actorId).reduce((sum, career) => sum + career.weeksInRole, 0);
}

function hasHigherEducation(world: WorldState, actorId: string): boolean {
  return Object.values(world.education).some((record) => record.characterId === actorId && record.status === 'completed' && record.level !== 'Secondary diploma');
}

function skillForProfession(actor: WorldState['characters'][string], key: string): number {
  switch (key) {
    case 'social':
    case 'publicSpeaking': return actor.charisma;
    case 'management': return (actor.discipline + actor.charisma + actor.ambition) / 3;
    case 'leadership': return (actor.ambition + actor.charisma + actor.discipline) / 3;
    case 'finance': return (actor.knowledge + actor.discipline) / 2;
    case 'academics': return actor.knowledge;
    default: return actor.knowledge;
  }
}

function meetSomeone(world: WorldState, context: string): string | undefined {
  const actor = world.characters[world.playerCharacterId];
  const names = [
    ['Avery', 'Brooks'], ['Jordan', 'Vale'], ['Sam', 'Patel'], ['Nora', 'Kim'],
    ['Cameron', 'Price'], ['Maya', 'Rivera'], ['Eli', 'Morgan'], ['Quinn', 'Bennett'],
  ];
  const pick = names[Math.floor(roll(world) * names.length) % names.length];
  const id = allocateId(world, 'character');
  const age = Math.max(16, playerAgeYears(world) + Math.floor(roll(world) * 9) - 4);
  world.characters[id] = {
    id,
    firstName: pick[0],
    lastName: pick[1],
    birthWeek: world.calendar.week - age * 52,
    isAlive: true,
    cityId: actor.cityId,
    householdId: `household-${id}`,
    parentIds: [],
    childIds: [],
    cashCents: 150_000 + Math.round(roll(world) * 1_500_000),
    health: 65 + roll(world) * 25,
    mood: 55 + roll(world) * 30,
    stress: 15 + roll(world) * 35,
    discipline: 35 + roll(world) * 45,
    ambition: 35 + roll(world) * 55,
    empathy: 35 + roll(world) * 55,
    riskTolerance: 25 + roll(world) * 60,
    ethics: 40 + roll(world) * 50,
    knowledge: 30 + roll(world) * 55,
    charisma: 35 + roll(world) * 55,
    fitness: 35 + roll(world) * 55,
    focuses: ['Health', 'Networking', 'Creative Work'],
    reputation: { public: 45, business: 45, employee: 50, political: 35, professional: 48, family: 55, faction: 15 },
    detailTier: 'standard',
    lastMeaningfulWeek: world.calendar.week,
  };
  const relationshipId = allocateId(world, 'relationship');
  world.relationships[relationshipId] = {
    id: relationshipId,
    characterIds: [actor.id, id],
    kind: 'professional',
    trust: 32,
    affection: 34,
    respect: 38,
    resentment: 0,
    lastInteractionWeek: world.calendar.week,
  };
  return ` You met ${pick[0]} ${pick[1]} ${context}.`;
}

function hireAdvisor(source: WorldState, action: IntentAction, defaultRole: string, defaultCost: number): ActionResult {
  const actor = source.characters[source.playerCharacterId];
  const cost = Math.max(100_000, numberParam(action, 'amountCents', defaultCost));
  if (actor.cashCents < cost) return rejected(source, `${defaultRole} requires ${(cost / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} for the first year.`);
  const existing = Object.values(source.organizations).some((organization) => organization.kind === 'professional' && organization.memberIds.includes(actor.id) && organization.name.toLowerCase().includes(defaultRole.toLowerCase()));
  if (existing) return rejected(source, `You already retain a ${defaultRole.toLowerCase()}.`);
  const world = cloneWorld(source);
  const nextActor = world.characters[world.playerCharacterId];
  nextActor.cashCents -= cost;
  const advisorId = allocateId(world, 'character');
  const orgId = allocateId(world, 'organization');
  const firstNames = ['Morgan', 'Taylor', 'Reese', 'Alexis', 'Drew', 'Casey'];
  const lastNames = ['Sterling', 'Park', 'Navarro', 'Ellis', 'Shaw', 'Okafor'];
  const firstName = firstNames[Math.floor(roll(world) * firstNames.length) % firstNames.length];
  const lastName = lastNames[Math.floor(roll(world) * lastNames.length) % lastNames.length];
  const quality = 60 + Math.round(roll(world) * 32);
  world.characters[advisorId] = {
    id: advisorId, firstName, lastName, birthWeek: world.calendar.week - (36 + Math.floor(roll(world) * 24)) * 52,
    isAlive: true, cityId: nextActor.cityId, householdId: `household-${advisorId}`, parentIds: [], childIds: [], cashCents: 8_000_000,
    health: 72, mood: 66, stress: 34, discipline: quality, ambition: 68, empathy: 58, riskTolerance: 42, ethics: 76,
    knowledge: quality, charisma: Math.min(95, quality - 3 + roll(world) * 12), fitness: 52,
    focuses: ['Networking', 'Job', 'Health'], reputation: { public: 54, business: quality, employee: 66, political: 48, professional: quality, family: 55, faction: 20 },
    detailTier: 'standard', lastMeaningfulWeek: world.calendar.week,
  };
  world.organizations[orgId] = {
    id: orgId,
    kind: 'professional',
    name: `${defaultRole} · ${lastName} Advisory`,
    resourcesCents: cost,
    influence: quality,
    stability: 82,
    memberIds: [nextActor.id],
    leaderId: advisorId,
    history: [`Retained by ${nextActor.firstName} ${nextActor.lastName} for ${(cost / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} per year.`],
  };
  const relationshipId = allocateId(world, 'relationship');
  world.relationships[relationshipId] = { id: relationshipId, characterIds: [nextActor.id, advisorId], kind: 'professional', trust: 48, affection: 20, respect: quality, resentment: 0, lastInteractionWeek: world.calendar.week };
  addTransaction(world, 'advisor-retainer', -cost, `${defaultRole} annual retainer`, nextActor.id, orgId);
  return result(world, `${firstName} ${lastName} is now your ${defaultRole.toLowerCase()}. Quality ${quality}/100; the first year is paid.`);
}

export function executeDepthAction(source: WorldState, action: IntentAction, confirmed = false): ActionResult | null {
  if (!DEPTH_VERBS.has(action.verb)) return null;
  const actor = source.characters[source.playerCharacterId];
  const age = playerAgeYears(source);

  if (action.verb === 'business.create') {
    const ownerLed = Object.values(source.businesses).filter((business) => business.active && (business.ownerId ?? business.founderId) === actor.id && !business.delegated);
    const hasJob = Object.values(source.careers).some((career) => career.characterId === actor.id && career.active);
    if (ownerLed.length >= 1 && (hasJob || ownerLed.length >= 1)) return rejected(source, 'You do not have enough personal time to start another owner-led company. Hire a CEO for the business you already run, or leave your job first.');
    return null;
  }

  if (action.verb === 'career.apply' && typeof action.parameters.professionId === 'string') {
    const profession = WORLD_CONTENT.professions.find((item) => item.id === action.parameters.professionId);
    if (!profession) return rejected(source, 'That opening is no longer available.');
    const ownerLed = Object.values(source.businesses).filter((business) => business.active && (business.ownerId ?? business.founderId) === actor.id && !business.delegated);
    if (ownerLed.length > 1) return rejected(source, 'Running multiple companies yourself leaves no realistic room for a full-time job. Hire CEOs first.');
    const experience = totalExperience(source, actor.id);
    const skill = skillForProfession(actor, profession.skillKey);
    if (age < profession.minimumAge) return rejected(source, `This role requires age ${profession.minimumAge} or older.`);
    if (profession.requiredDegree && !hasHigherEducation(source, actor.id)) return rejected(source, 'This role requires a completed college or professional degree.');
    if (actor.knowledge < profession.minKnowledge) return rejected(source, `Your resume is light for this opening. Knowledge ${Math.round(actor.knowledge)}/${profession.minKnowledge} required.`);
    if (experience < profession.minExperienceWeeks) return rejected(source, `This role expects about ${Math.ceil(profession.minExperienceWeeks / 52)} years of prior experience.`);
    if (actor.reputation.professional < profession.minReputation) return rejected(source, 'Your professional reputation is not yet competitive for this opening.');
    if (skill < profession.minSkill) return rejected(source, `A key skill is below the hiring bar for this role.`);

    const world = cloneWorld(source);
    const nextActor = world.characters[world.playerCharacterId];
    const chance = Math.min(0.92, 0.28 + nextActor.knowledge / 260 + nextActor.reputation.professional / 330 + skill / 420 - world.economy.unemployment * 0.7);
    if (roll(world) > chance) return result(world, `You met the requirements for ${profession.title}, but another applicant won the role this week.`);
    Object.values(world.careers).forEach((career) => { if (career.characterId === nextActor.id) career.active = false; });
    const id = allocateId(world, 'career');
    world.careers[id] = { id, characterId: nextActor.id, employerId: 'organization-northstar-logistics', title: profession.title, sector: profession.sector, weeklySalaryCents: profession.weeklySalaryCents, performance: 50, satisfaction: 62, weeksInRole: 0, active: true };
    nextActor.professionId = profession.id;
    return result(world, `You landed the ${profession.title} position at ${(profession.weeklySalaryCents * 52 / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} per year.`);
  }

  if (action.verb === 'education.apply' && typeof action.parameters.universityId === 'string') {
    const university = WORLD_CONTENT.universities.find((item) => item.id === action.parameters.universityId);
    if (!university) return rejected(source, 'That school is not available.');
    if (age < university.minimumAge) return rejected(source, `Applications open at age ${university.minimumAge}.`);
    const active = Object.values(source.education).some((record) => record.characterId === actor.id && !['completed', 'withdrawn'].includes(record.status));
    if (active) return rejected(source, 'Finish or leave your current education path before applying elsewhere.');
    const world = cloneWorld(source);
    const nextActor = world.characters[world.playerCharacterId];
    const chance = Math.max(0.08, Math.min(0.96, 0.22 + nextActor.knowledge / 180 + nextActor.reputation.professional / 650 + nextActor.charisma / 900 - university.prestige / 240));
    if (roll(world) > chance) return result(world, `${university.name} declined the application this cycle. Your academic record and profile still remain.`);
    const id = allocateId(world, 'education');
    world.education[id] = { id, characterId: nextActor.id, institutionId: university.id, status: 'accepted', level: 'Undergraduate program', recordedGrade: 70, knowledgeGain: nextActor.knowledge, prestige: university.prestige, network: university.network, tuitionCentsPerYear: university.tuitionCentsPerYear, manipulatedCredential: false };
    return result(world, `${university.name} accepted you. Tuition is ${(university.tuitionCentsPerYear / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} per year.`);
  }

  if (action.verb === 'education.party' || action.verb === 'education.sports') {
    const active = Object.values(source.education).find((record) => record.characterId === actor.id && ['higher', 'trade'].includes(record.status));
    if (!active) return rejected(source, 'You need to be enrolled in college or training for that activity.');
    const world = cloneWorld(source);
    const nextActor = world.characters[world.playerCharacterId];
    const nextRecord = world.education[active.id];
    if (action.verb === 'education.party') {
      nextActor.mood = Math.min(100, nextActor.mood + 4);
      nextActor.stress = Math.max(0, nextActor.stress - 2);
      nextRecord.network = Math.min(100, nextRecord.network + 2.5);
      nextRecord.recordedGrade = Math.max(0, nextRecord.recordedGrade - 1.6);
      return result(world, 'You went out with people from school. Your social network grew, but studying took the hit.');
    }
    nextActor.fitness = Math.min(100, nextActor.fitness + 2.8);
    nextActor.health = Math.min(100, nextActor.health + 0.8);
    nextActor.stress = Math.max(0, nextActor.stress - 1.2);
    nextRecord.network = Math.min(100, nextRecord.network + 1.4);
    return result(world, 'You trained and competed with the school sports program. Fitness and campus connections improved.');
  }

  if (action.verb === 'business.delegate') {
    const business = action.targetIds.map((id) => source.businesses[id]).find((item) => item && item.active && (item.ownerId ?? item.founderId) === actor.id);
    if (!business) return rejected(source, 'Choose a business you own.');
    if (business.delegated) return rejected(source, `${business.name} already has professional management.`);
    const salary = Math.max(450_000, Math.min(8_000_000, Math.round(business.valuationCents * 0.012)));
    const firstYearCost = salary * 52;
    if (business.cashCents < firstYearCost) return rejected(source, `${business.name} needs ${(firstYearCost / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} to cover the CEO's first year.`);
    const world = cloneWorld(source);
    const nextBusiness = world.businesses[business.id];
    const org = world.organizations[nextBusiness.organizationId];
    const ceoId = allocateId(world, 'character');
    const candidates = [['Jamie', 'Stone'], ['Priya', 'Rao'], ['Miles', 'Carter'], ['Naomi', 'West'], ['Theo', 'Grant']];
    const pick = candidates[Math.floor(roll(world) * candidates.length) % candidates.length];
    const quality = 62 + Math.round(roll(world) * 30);
    world.characters[ceoId] = {
      id: ceoId, firstName: pick[0], lastName: pick[1], birthWeek: world.calendar.week - (38 + Math.floor(roll(world) * 20)) * 52, isAlive: true,
      cityId: nextBusiness.cityId, householdId: `household-${ceoId}`, parentIds: [], childIds: [], cashCents: 10_000_000, health: 72, mood: 64, stress: 48,
      discipline: quality, ambition: Math.min(100, quality + 5), empathy: 52, riskTolerance: 52, ethics: 68, knowledge: quality, charisma: Math.min(96, quality + 2), fitness: 48,
      focuses: ['Job', 'Networking', 'Health'], reputation: { public: 50, business: quality, employee: quality, political: 42, professional: quality, family: 50, faction: 20 }, detailTier: 'standard', lastMeaningfulWeek: world.calendar.week,
      professionId: 'profession-chief-executive',
    };
    nextBusiness.cashCents -= firstYearCost;
    nextBusiness.delegated = true;
    if (org) {
      org.leaderId = ceoId;
      org.history.push(`${pick[0]} ${pick[1]} hired as CEO at ${(salary / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} per week.`);
    }
    return result(world, `${pick[0]} ${pick[1]} is now CEO of ${nextBusiness.name}. Management quality ${quality}/100; one year of salary is reserved.`);
  }

  if (action.verb === 'property.buy' && typeof action.parameters.kind === 'string') {
    const value = Math.max(2_000_000, numberParam(action, 'valueCents'));
    const downPayment = Math.round(value * 0.2);
    if (actor.cashCents < downPayment) return rejected(source, `You need ${(downPayment / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} for the down payment.`);
    const world = cloneWorld(source);
    const nextActor = world.characters[world.playerCharacterId];
    nextActor.cashCents -= downPayment;
    const id = allocateId(world, 'property');
    const allowedKinds = ['residence', 'condo', 'single-family', 'multifamily', 'commercial', 'land', 'development', 'estate'] as const;
    const requestedKind = stringParam(action, 'kind');
    const kind = (allowedKinds as readonly string[]).includes(requestedKind) ? requestedKind as (typeof allowedKinds)[number] : 'single-family';
    world.properties[id] = {
      id,
      name: stringParam(action, 'name', 'New property'),
      kind,
      cityId: stringParam(action, 'cityId', nextActor.cityId),
      ownerId: nextActor.id,
      valueCents: value,
      debtCents: value - downPayment,
      condition: Math.max(20, Math.min(100, numberParam(action, 'condition', 72))),
      occupancy: 'vacant',
      weeklyRentCents: Math.max(0, numberParam(action, 'weeklyRentCents', Math.round(value * 0.0009))),
      weeklyCostsCents: Math.round(value * 0.00024),
      managed: false,
    };
    addTransaction(world, 'property-purchase', -downPayment, `Down payment on ${world.properties[id].name}`, nextActor.id, id);
    return result(world, `You bought ${world.properties[id].name}. The property now appears under Owned properties.`);
  }

  if (action.verb === 'property.evict') {
    if (!confirmed) return { world: source, message: 'Confirmation is required before ending the tenancy.', validation: { valid: true, requiresConfirmation: true } };
    const property = action.targetIds.map((id) => source.properties[id]).find((item) => item?.ownerId === actor.id);
    if (!property || property.occupancy !== 'tenant') return rejected(source, 'Choose one of your occupied rental properties.');
    const world = cloneWorld(source);
    world.properties[property.id].occupancy = 'vacant';
    world.characters[world.playerCharacterId].reputation.public = Math.max(0, world.characters[world.playerCharacterId].reputation.public - 1);
    return result(world, `${property.name} is vacant after the tenancy ended. You can now renovate, sell, or find another tenant.`);
  }

  if (action.verb.startsWith('health.')) {
    const map: Record<string, string> = { 'health.run': 'run', 'health.gym': 'gym', 'health.group_class': 'class', 'health.therapy': 'therapy', 'health.outdoors': 'meditation' };
    const activity = WELLNESS_ACTIVITIES.find((item) => item.id === map[action.verb]);
    if (!activity) return null;
    if (actor.cashCents < activity.costCents) return rejected(source, `${activity.label} costs ${(activity.costCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.`);
    const world = cloneWorld(source);
    const nextActor = world.characters[world.playerCharacterId];
    nextActor.cashCents -= activity.costCents;
    nextActor.fitness = Math.min(100, nextActor.fitness + activity.fitness);
    nextActor.health = Math.min(100, nextActor.health + activity.health);
    nextActor.mood = Math.min(100, nextActor.mood + activity.mood);
    nextActor.stress = Math.max(0, nextActor.stress + activity.stress);
    if (activity.costCents > 0) addTransaction(world, 'wellness', -activity.costCents, activity.label, nextActor.id);
    const social = activity.socialChance > 0 && roll(world) < activity.socialChance ? meetSomeone(world, 'through the activity') : '';
    return result(world, `${activity.label} helped your wellbeing.${social ?? ''}`);
  }

  if (action.verb === 'life.move_city' || action.verb === 'life.emigrate') {
    const cityId = stringParam(action, 'cityId');
    const city = WORLD_CONTENT.cities.find((item) => item.id === cityId);
    if (!city) return rejected(source, 'Choose an available city.');
    const isEmigration = city.countryId !== source.activeCountryId;
    if (action.verb === 'life.move_city' && isEmigration) return rejected(source, 'Use Emigrate to move to another country.');
    if (action.verb === 'life.emigrate' && !isEmigration) return rejected(source, 'Choose a city in another country.');
    const cost = city.moveCostCents;
    if (actor.cashCents < cost) return rejected(source, `Moving to ${city.name} requires ${(cost / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} in relocation costs.`);
    if (isEmigration && !confirmed) return { world: source, message: `Emigrating to ${city.name} ends incompatible local political roles and may end your current job.`, validation: { valid: true, requiresConfirmation: true } };
    const world = cloneWorld(source);
    const nextActor = world.characters[world.playerCharacterId];
    nextActor.cashCents -= cost;
    nextActor.cityId = city.id;
    if (isEmigration) {
      world.activeCountryId = city.countryId;
      Object.values(world.careers).forEach((career) => { if (career.characterId === nextActor.id) career.active = false; });
      if (world.politics[nextActor.id]) world.politics[nextActor.id] = { characterId: nextActor.id, authority: 0, approval: 20 };
      for (const relationship of Object.values(world.relationships)) {
        if (!relationship.characterIds.includes(nextActor.id)) continue;
        relationship.affection = Math.max(0, relationship.affection - 3);
      }
    }
    addTransaction(world, 'relocation', -cost, `Move to ${city.name}`, nextActor.id);
    return result(world, isEmigration ? `You emigrated to ${city.name}. Your new country has different opportunities, institutions, and political context.` : `You moved to ${city.name}. Local jobs, housing, and social opportunities will now reflect the new city.`);
  }

  if (action.verb.startsWith('politics.')) {
    if (!['politics.press_conference', 'politics.town_hall', 'politics.fundraiser', 'politics.constituent_work'].includes(action.verb)) return null;
    if (age < 18) return rejected(source, 'Political public activity is limited to adults.');
    const costs: Record<string, number> = { 'politics.press_conference': 120_000, 'politics.town_hall': 45_000, 'politics.fundraiser': 90_000, 'politics.constituent_work': 15_000 };
    const cost = costs[action.verb];
    if (actor.cashCents < cost) return rejected(source, 'You cannot afford this political activity right now.');
    const world = cloneWorld(source);
    const nextActor = world.characters[world.playerCharacterId];
    nextActor.cashCents -= cost;
    const politics = world.politics[nextActor.id] ?? { characterId: nextActor.id, authority: 0, approval: 22 };
    world.politics[nextActor.id] = politics;
    let skill = nextActor.charisma;
    let difficulty = 50;
    let upside = 5;
    if (action.verb === 'politics.town_hall' || action.verb === 'politics.constituent_work') skill = (nextActor.empathy + nextActor.charisma) / 2;
    if (action.verb === 'politics.fundraiser') skill = (nextActor.charisma + nextActor.reputation.business) / 2;
    if (action.verb === 'politics.press_conference') { difficulty = 62; upside = 8; }
    const score = skill * 0.62 + nextActor.reputation.political * 0.28 + nextActor.knowledge * 0.1 + (roll(world) - 0.5) * 34;
    const success = score >= difficulty;
    const delta = success ? Math.max(1, Math.round(upside * (0.65 + roll(world) * 0.7))) : -Math.max(1, Math.round((upside - 1) * (0.5 + roll(world) * 0.8)));
    politics.approval = Math.max(0, Math.min(100, politics.approval + delta));
    nextActor.reputation.political = Math.max(0, Math.min(100, nextActor.reputation.political + delta * 0.45));
    if (politics.campaign && action.verb === 'politics.fundraiser') politics.campaign.fundsCents += success ? 450_000 + Math.round(roll(world) * 1_800_000) : 90_000;
    addTransaction(world, 'politics', -cost, action.verb.replace('politics.', '').replaceAll('_', ' '), nextActor.id);
    const label = action.verb === 'politics.press_conference' ? 'The press conference' : action.verb === 'politics.town_hall' ? 'The town hall' : action.verb === 'politics.fundraiser' ? 'The fundraiser' : 'The constituent work';
    return result(world, success ? `${label} went well. Approval moved to ${Math.round(politics.approval)}%.` : `${label} did not land the way you hoped. Approval moved to ${Math.round(politics.approval)}%.`);
  }

  if (action.verb === 'markets.hire_wealth_manager') return hireAdvisor(source, action, 'Wealth manager', 4_800_000);
  if (action.verb === 'legal.hire_private_counsel') return hireAdvisor(source, action, 'Personal attorney', 3_600_000);
  if (action.verb === 'organization.hire_advisor') return hireAdvisor(source, action, stringParam(action, 'role', 'Advisor'), Math.max(1_800_000, numberParam(action, 'amountCents', 2_400_000)));

  return null;
}
