import { allocateId, playerAgeYears } from './createWorld';
import { clampCents } from './money';
import { nextRandom } from './random';
import type { ActionResult, IntentAction, WorldState } from './types';

import { WORLD_CONTENT } from '@/content/worldContent';

const HANDLED = new Set([
  'career.apply',
  'education.apply',
  'education.party',
  'education.sports',
  'business.create',
  'business.delegate',
  'property.buy',
  'property.evict',
  'markets.hire_wealth_manager',
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
  'organization.create',
]);

function cloneWorld(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world)) as WorldState;
}

function roll(world: WorldState): number {
  const result = nextRandom(world.rngState);
  world.rngState = result.state;
  return result.value;
}

function bounded(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function amount(parameters: IntentAction['parameters'], key = 'amountCents'): number {
  const value = parameters[key];
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
}

function ok(world: WorldState, message: string): ActionResult {
  return { world, validation: { valid: true, requiresConfirmation: false }, message };
}

function blocked(source: WorldState, message: string, prerequisites: string[] = []): ActionResult {
  return { world: source, validation: { valid: false, reason: message, prerequisites, requiresConfirmation: false }, message };
}

function confirm(source: WorldState, message: string): ActionResult {
  return { world: source, validation: { valid: true, requiresConfirmation: true }, message };
}

function transaction(world: WorldState, kind: string, amountCents: number, memo: string, fromId?: string, toId?: string): void {
  world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind, amountCents: clampCents(amountCents), fromId, toId, memo });
  if (world.transactions.length > 1_200) world.transactions.splice(0, world.transactions.length - 1_200);
}

function completedEducation(world: WorldState, characterId: string, kind: 'higher' | 'trade'): boolean {
  return Object.values(world.education).some((record) => record.characterId === characterId && record.status === 'completed' && (kind === 'trade' ? record.level.toLowerCase().includes('trade') : !record.level.toLowerCase().includes('secondary')));
}

function priorExperienceWeeks(world: WorldState, characterId: string): number {
  return Object.values(world.careers).filter((career) => career.characterId === characterId).reduce((total, career) => total + career.weeksInRole, 0);
}

function skillFor(actor: WorldState['characters'][string], key?: string): number {
  switch (key) {
    case 'publicSpeaking': return actor.charisma * 0.75 + actor.knowledge * 0.25;
    case 'social': return actor.charisma * 0.7 + actor.empathy * 0.3;
    case 'leadership': return actor.charisma * 0.4 + actor.discipline * 0.35 + actor.knowledge * 0.25;
    case 'management': return actor.discipline * 0.45 + actor.knowledge * 0.4 + actor.charisma * 0.15;
    case 'finance': return actor.knowledge * 0.75 + actor.discipline * 0.25;
    case 'academics': return actor.knowledge;
    default: return (actor.knowledge + actor.charisma + actor.discipline) / 3;
  }
}

function hasDegree(world: WorldState, characterId: string, requiredDegree?: string | null): boolean {
  if (!requiredDegree) return true;
  if (requiredDegree === 'trade') return completedEducation(world, characterId, 'trade');
  if (requiredDegree === 'higher') return completedEducation(world, characterId, 'higher');
  return Object.values(world.education).some((record) => record.characterId === characterId && record.status === 'completed');
}

function personalWorkload(world: WorldState): number {
  const actor = world.characters[world.playerCharacterId];
  const careerHours = Object.values(world.careers).some((career) => career.characterId === actor.id && career.active) ? 40 : 0;
  const businessHours = Object.values(world.businesses)
    .filter((business) => business.active && (business.ownerId ?? business.founderId) === actor.id && business.playerOwnershipBps > 0)
    .reduce((hours, business) => hours + (business.personalTimeHours ?? (business.delegated ? 5 : 28)), 0);
  return careerHours + businessHours;
}

function spawnAcquaintance(world: WorldState): string {
  const actor = world.characters[world.playerCharacterId];
  const firstNames = ['Avery', 'Jordan', 'Taylor', 'Sam', 'Casey', 'Morgan', 'Jamie', 'Drew'];
  const lastNames = ['Reed', 'Patel', 'Nguyen', 'Stone', 'Garcia', 'Brooks', 'Kim', 'Diaz'];
  const firstName = firstNames[Math.floor(roll(world) * firstNames.length)];
  const lastName = lastNames[Math.floor(roll(world) * lastNames.length)];
  const characterId = allocateId(world, 'character');
  const age = Math.max(18, playerAgeYears(world) + Math.floor(roll(world) * 9) - 4);
  world.characters[characterId] = {
    id: characterId,
    firstName,
    lastName,
    birthWeek: world.calendar.week - age * 52,
    isAlive: true,
    cityId: actor.cityId,
    householdId: `household-${characterId}`,
    parentIds: [],
    childIds: [],
    cashCents: Math.round(80_000 + roll(world) * 1_200_000),
    health: 70 + roll(world) * 20,
    mood: 55 + roll(world) * 30,
    stress: 20 + roll(world) * 35,
    discipline: 35 + roll(world) * 45,
    ambition: 30 + roll(world) * 55,
    empathy: 35 + roll(world) * 50,
    riskTolerance: 25 + roll(world) * 60,
    ethics: 40 + roll(world) * 45,
    knowledge: 30 + roll(world) * 50,
    charisma: 35 + roll(world) * 50,
    fitness: 45 + roll(world) * 45,
    focuses: ['Health', 'Networking', 'Creative Work'],
    reputation: { public: 45, business: 45, employee: 45, political: 35, professional: 48, family: 50, faction: 15 },
    detailTier: 'standard',
    lastMeaningfulWeek: world.calendar.week,
  };
  const relationshipId = allocateId(world, 'relationship');
  world.relationships[relationshipId] = { id: relationshipId, characterIds: [actor.id, characterId], kind: 'acquaintance', trust: 28, affection: 32, respect: 35, resentment: 0, lastInteractionWeek: world.calendar.week };
  return `${firstName} ${lastName}`;
}

export function handlesExtendedAction(verb: string): boolean {
  return HANDLED.has(verb);
}

export function executeExtendedAction(source: WorldState, action: IntentAction, confirmed = false): ActionResult {
  if (!HANDLED.has(action.verb)) return blocked(source, 'That action is not handled by the extended life systems.');
  const actor = source.characters[source.playerCharacterId];
  if (!actor?.isAlive) return blocked(source, 'The active character cannot act.');
  const age = playerAgeYears(source);

  if (action.verb === 'career.apply') {
    if (age < 16) return blocked(source, 'You are not old enough to apply for this position yet.', ['Reach working age.']);
    const professionId = typeof action.parameters.professionId === 'string' ? action.parameters.professionId : undefined;
    const profession = WORLD_CONTENT.professions.find((item) => item.id === professionId) ?? WORLD_CONTENT.professions.find((item) => age >= item.minimumAge);
    if (!profession) return blocked(source, 'No suitable opening is available this week.');
    if (age < profession.minimumAge) return blocked(source, `${profession.title} requires a minimum age of ${profession.minimumAge}.`);
    if (!hasDegree(source, actor.id, profession.requiredDegree)) return blocked(source, `${profession.title} requires ${profession.requiredDegree === 'higher' ? 'a college degree' : 'the required credential'}.`, ['Complete the required education first.']);

    const experience = priorExperienceWeeks(source, actor.id);
    const skill = skillFor(actor, profession.skillKey);
    const experienceFit = Math.min(1, experience / Math.max(1, profession.minExperienceWeeks || 1));
    const knowledgeFit = Math.min(1.1, actor.knowledge / Math.max(1, profession.minKnowledge || 1));
    const reputationFit = Math.min(1.1, actor.reputation.professional / Math.max(1, profession.minReputation || 1));
    const skillFit = Math.min(1.1, skill / Math.max(1, profession.minSkill || 1));
    const resumeFit = (experienceFit * 0.28 + knowledgeFit * 0.25 + reputationFit * 0.2 + skillFit * 0.27);
    const world = cloneWorld(source);
    const chance = bounded(0.12 + resumeFit * 0.68 - world.economy.unemployment * 0.6, 0.05, 0.92);
    if (roll(world) > chance) {
      actor.reputation.professional = bounded(actor.reputation.professional + 0.2);
      return ok(world, `You applied for ${profession.title}, but your resume did not win the offer this time.`);
    }
    Object.values(world.careers).forEach((career) => { if (career.characterId === actor.id) career.active = false; });
    const id = allocateId(world, 'career');
    world.careers[id] = { id, characterId: actor.id, employerId: 'organization-northstar-logistics', title: profession.title, sector: profession.sector, weeklySalaryCents: profession.weeklySalaryCents, performance: 50 + resumeFit * 12, satisfaction: 61, weeksInRole: 0, active: true };
    actor.professionId = profession.id;
    return ok(world, `You landed the ${profession.title} role at ${(profession.weeklySalaryCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} per week.`);
  }

  if (action.verb === 'education.apply') {
    if (age < 15) return blocked(source, 'College and trade applications are not available yet.');
    const universityId = typeof action.parameters.universityId === 'string' ? action.parameters.universityId : action.targetIds[0];
    const university = WORLD_CONTENT.universities.find((item) => item.id === universityId) ?? WORLD_CONTENT.universities[0];
    const openRecord = Object.values(source.education).some((record) => record.characterId === actor.id && !['completed', 'withdrawn'].includes(record.status));
    if (openRecord) return blocked(source, 'Finish, enroll in, or leave the current education path first.');
    const world = cloneWorld(source);
    const readiness = actor.knowledge * 0.68 + actor.reputation.professional * 0.2 + actor.discipline * 0.12;
    const threshold = university.admissionKnowledge * 0.75 + university.admissionReputation * 0.25;
    const chance = bounded(0.18 + (readiness - threshold) / 65 + (100 - university.prestige) / 350, 0.05, 0.94);
    if (roll(world) > chance) return ok(world, `${university.name} did not offer admission this cycle.`);
    const id = allocateId(world, 'education');
    const trade = university.id.includes('trades');
    world.education[id] = { id, characterId: actor.id, institutionId: university.id, status: 'accepted', level: trade ? 'Trade apprenticeship' : 'Undergraduate program', recordedGrade: 70, knowledgeGain: actor.knowledge, prestige: university.prestige, network: university.network, tuitionCentsPerYear: university.tuitionCentsPerYear, manipulatedCredential: false };
    return ok(world, `${university.name} offered you admission. Tuition is ${(university.tuitionCentsPerYear / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} per year.`);
  }

  if (action.verb === 'education.party' || action.verb === 'education.sports') {
    const active = Object.values(source.education).find((record) => record.characterId === actor.id && ['higher', 'trade'].includes(record.status));
    if (!active) return blocked(source, 'You need to be enrolled in college or training for that.');
    const world = cloneWorld(source);
    const record = world.education[active.id];
    if (action.verb === 'education.party') {
      record.recordedGrade = bounded(record.recordedGrade - 1.2 - roll(world) * 1.8);
      record.network = bounded(record.network + 2 + roll(world) * 2);
      actor.mood = bounded(actor.mood + 4);
      actor.stress = bounded(actor.stress - 1.5);
      return ok(world, 'You went out with people from school. Your social circle grew, but studying took a hit.');
    }
    record.network = bounded(record.network + 1.4);
    actor.fitness = bounded(actor.fitness + 2.2);
    actor.health = bounded(actor.health + 0.8);
    actor.reputation.public = bounded(actor.reputation.public + 0.6);
    if (!actor.focuses.includes('Academics')) record.recordedGrade = bounded(record.recordedGrade - 0.5);
    return ok(world, 'College sports improved your fitness and campus connections.');
  }

  if (action.verb === 'business.create') {
    if (age < 16) return blocked(source, 'You are not old enough to found a business yet.');
    const plannedHours = 28;
    const currentHours = personalWorkload(source);
    if (currentHours + plannedHours > 75) return blocked(source, 'You do not have enough personal time to run another owner-led company.', ['Quit or reduce your day job, or hire leadership at an existing business.']);
    const capital = Math.max(100_000, amount(action.parameters) || Math.min(actor.cashCents, 500_000));
    if (capital > actor.cashCents) return blocked(source, 'You do not have enough liquid cash for that starting capital.');
    const world = cloneWorld(source);
    const nextActor = world.characters[world.playerCharacterId];
    const organizationId = allocateId(world, 'organization');
    const businessId = allocateId(world, 'business');
    const name = typeof action.parameters.name === 'string' && action.parameters.name.trim() ? action.parameters.name.trim().slice(0, 60) : `${nextActor.lastName} & Co.`;
    const sectorDefinition = WORLD_CONTENT.businessSectors.find((sector) => sector.name === action.parameters.sector) ?? WORLD_CONTENT.businessSectors[0];
    nextActor.cashCents -= capital;
    transaction(world, 'business-capital', -capital, `Starting capital for ${name}`, nextActor.id, businessId);
    world.organizations[organizationId] = { id: organizationId, kind: 'business', name, resourcesCents: capital, influence: 8, stability: 48, memberIds: [nextActor.id], leaderId: nextActor.id, history: [`Founded by ${nextActor.firstName} ${nextActor.lastName}.`] };
    world.businesses[businessId] = { id: businessId, organizationId, name, sector: sectorDefinition.name, cityId: nextActor.cityId, founderId: nextActor.id, ownerId: nextActor.id, cashCents: capital, debtCents: 0, revenueWeeklyCents: 0, costWeeklyCents: 0, valuationCents: capital, playerOwnershipBps: 10_000, votingControlBps: 10_000, employees: 1, capacity: sectorDefinition.baseCapacity, demand: Math.max(6, Math.round(sectorDefinition.baseCapacity * 0.6)), quality: 58, reputation: 36, marketingBps: 600, pricePosition: 'market', growthPosture: 'balanced', delegated: false, active: true, personalTimeHours: plannedHours };
    return ok(world, `${name} is open. Running it yourself uses about ${plannedHours} hours of your week.`);
  }

  if (action.verb === 'business.delegate') {
    const business = action.targetIds.map((id) => source.businesses[id]).find((item) => item && item.active && (item.ownerId ?? item.founderId) === actor.id);
    if (!business) return blocked(source, 'Choose an active business you own.');
    const quality = bounded(typeof action.parameters.managerQuality === 'number' ? action.parameters.managerQuality : 62, 35, 92);
    const weeklySalary = Math.round(typeof action.parameters.managerSalaryWeeklyCents === 'number' ? action.parameters.managerSalaryWeeklyCents : Math.max(180_000, business.revenueWeeklyCents * 0.08));
    const onboarding = weeklySalary * 8;
    if (business.cashCents < onboarding) return blocked(source, `${business.name} needs enough cash for an eight-week executive commitment before hiring this CEO.`);
    const world = cloneWorld(source);
    const next = world.businesses[business.id];
    next.cashCents -= onboarding;
    next.delegated = true;
    next.personalTimeHours = 5;
    next.managerQuality = quality;
    next.managerSalaryWeeklyCents = weeklySalary;
    next.managerName = typeof action.parameters.managerName === 'string' ? action.parameters.managerName : ['Morgan Hale', 'Avery Brooks', 'Jordan Patel'][Math.floor(roll(world) * 3)];
    next.capacity = Math.round(next.capacity * (1 + Math.max(0, quality - 50) / 350));
    return ok(world, `${next.managerName} took over day-to-day leadership of ${next.name}. The eight-week executive commitment cost ${(onboarding / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}, and your weekly time burden fell sharply.`);
  }

  if (action.verb === 'property.buy') {
    if (age < 18) return blocked(source, 'You must be an adult to purchase property independently.');
    const cityId = typeof action.parameters.cityId === 'string' ? action.parameters.cityId : actor.cityId;
    const city = WORLD_CONTENT.cities.find((item) => item.id === cityId);
    if (!city) return blocked(source, 'That property location is unavailable.');
    const value = Math.max(2_500_000, amount(action.parameters, 'valueCents') || 24_000_000);
    const downPayment = Math.max(Math.round(value * 0.2), amount(action.parameters));
    if (downPayment > actor.cashCents) return blocked(source, 'The required down payment is not affordable.');
    const world = cloneWorld(source);
    const nextActor = world.characters[world.playerCharacterId];
    nextActor.cashCents -= downPayment;
    const id = allocateId(world, 'property');
    const requestedKind = typeof action.parameters.kind === 'string' ? action.parameters.kind : 'single-family';
    const allowedKinds = ['residence', 'condo', 'single-family', 'multifamily', 'commercial', 'land', 'development', 'estate'];
    const kind = allowedKinds.includes(requestedKind) ? requestedKind as WorldState['properties'][string]['kind'] : 'single-family';
    const name = typeof action.parameters.name === 'string' ? action.parameters.name : `${city.name} ${kind === 'commercial' ? 'commercial property' : 'property'}`;
    world.properties[id] = { id, name, kind, cityId, ownerId: nextActor.id, valueCents: value, debtCents: value - downPayment, condition: 68 + roll(world) * 22, occupancy: 'vacant', weeklyRentCents: Math.round(value * (kind === 'commercial' ? 0.00115 : 0.0009)), weeklyCostsCents: Math.round(value * (kind === 'commercial' ? 0.00031 : 0.00024)), managed: false };
    transaction(world, 'property-purchase', -downPayment, `Down payment on ${name}`, nextActor.id, id);
    return ok(world, `You bought ${name} in ${city.name}.`);
  }

  if (action.verb === 'property.evict') {
    const property = action.targetIds.map((id) => source.properties[id]).find((item) => item?.ownerId === actor.id);
    if (!property) return blocked(source, 'Choose a property you own.');
    if (property.occupancy !== 'tenant') return blocked(source, 'There is no tenant to remove from this property.');
    if (!confirmed) return confirm(source, `End the tenancy at ${property.name}?`);
    const world = cloneWorld(source);
    const nextActor = world.characters[world.playerCharacterId];
    const next = world.properties[property.id];
    const turnoverCost = Math.round(next.valueCents * 0.0035);
    if (nextActor.cashCents < turnoverCost) return blocked(source, 'You do not have enough cash for turnover and legal costs.');
    nextActor.cashCents -= turnoverCost;
    next.occupancy = 'vacant';
    next.condition = bounded(next.condition - 2);
    transaction(world, 'property-turnover', -turnoverCost, `Tenant turnover at ${next.name}`, nextActor.id, next.id);
    return ok(world, `${next.name} is vacant again after tenant turnover.`);
  }

  if (action.verb.startsWith('health.')) {
    const costs: Record<string, number> = { 'health.run': 0, 'health.gym': 2_500, 'health.group_class': 3_500, 'health.therapy': 15_000, 'health.outdoors': 0 };
    const cost = amount(action.parameters) || costs[action.verb] || 0;
    if (cost > actor.cashCents) return blocked(source, 'You cannot afford that wellness activity right now.');
    const world = cloneWorld(source);
    const nextActor = world.characters[world.playerCharacterId];
    if (cost > 0) { nextActor.cashCents -= cost; transaction(world, 'wellness', -cost, action.verb.replace('health.', '').replace('_', ' '), nextActor.id); }
    if (action.verb === 'health.run') { nextActor.fitness = bounded(nextActor.fitness + 1.6); nextActor.stress = bounded(nextActor.stress - 1.3); nextActor.mood = bounded(nextActor.mood + 0.8); return ok(world, 'You went for a run. Fitness improved and the day felt a little lighter.'); }
    if (action.verb === 'health.gym') { nextActor.fitness = bounded(nextActor.fitness + 2.1); nextActor.health = bounded(nextActor.health + 0.7); nextActor.stress = bounded(nextActor.stress - 1); return ok(world, 'A solid gym session improved fitness and health.'); }
    if (action.verb === 'health.therapy') { nextActor.stress = bounded(nextActor.stress - 4.5); nextActor.mood = bounded(nextActor.mood + 2.8); return ok(world, 'Therapy helped you work through some of the pressure you have been carrying.'); }
    if (action.verb === 'health.outdoors') { nextActor.health = bounded(nextActor.health + 0.4); nextActor.mood = bounded(nextActor.mood + 1.7); nextActor.stress = bounded(nextActor.stress - 1.5); return ok(world, 'You spent time outside and came back feeling more grounded.'); }
    nextActor.fitness = bounded(nextActor.fitness + 1.2); nextActor.mood = bounded(nextActor.mood + 1.3); nextActor.stress = bounded(nextActor.stress - 0.7);
    if (roll(world) < 0.33) return ok(world, `The class was good for you, and you met ${spawnAcquaintance(world)} afterward.`);
    return ok(world, 'The group class improved your fitness and put you around new people.');
  }

  if (action.verb === 'life.move_city' || action.verb === 'life.emigrate') {
    if (age < 18) return blocked(source, 'Independent relocation becomes available at adulthood.');
    const cityId = typeof action.parameters.cityId === 'string' ? action.parameters.cityId : undefined;
    const city = WORLD_CONTENT.cities.find((item) => item.id === cityId);
    if (!city) return blocked(source, 'Choose an available city.');
    const sameCountry = city.countryId === source.activeCountryId;
    if (action.verb === 'life.move_city' && !sameCountry) return blocked(source, 'Use emigration to move to a city in another country.');
    if (action.verb === 'life.emigrate' && sameCountry) return blocked(source, 'That city is already in your current country.');
    const cost = city.moveCostCents + (action.verb === 'life.emigrate' ? 200_000 : 0);
    if (actor.cashCents < cost) return blocked(source, `You need ${(cost / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} in liquid cash for this move.`);
    if (action.verb === 'life.emigrate' && !confirmed) return confirm(source, `Emigrate to ${city.name}?`);
    const world = cloneWorld(source);
    const nextActor = world.characters[world.playerCharacterId];
    nextActor.cashCents -= cost;
    nextActor.cityId = city.id;
    if (!sameCountry) {
      world.activeCountryId = city.countryId;
      const country = world.countries[city.countryId];
      if (country) { world.background.population = country.population; world.background.households = Math.round(country.population / 2.42); }
    }
    transaction(world, 'relocation', -cost, `Move to ${city.name}`, nextActor.id);
    return ok(world, `${nextActor.firstName} now lives in ${city.name}. New local jobs, property, schools, and networks will reflect the move.`);
  }

  if (action.verb.startsWith('politics.')) {
    const politics = source.politics[actor.id];
    if (!politics) return blocked(source, 'Political life is not initialized for this character.');
    const world = cloneWorld(source);
    const nextActor = world.characters[world.playerCharacterId];
    const nextPolitics = world.politics[nextActor.id];
    const speaking = skillFor(nextActor, 'publicSpeaking');
    if (action.verb === 'politics.press_conference') {
      const score = speaking * 0.55 + nextActor.reputation.political * 0.3 + nextActor.discipline * 0.15 + (roll(world) - 0.5) * 32;
      const delta = score >= 67 ? 3 + roll(world) * 2 : score >= 50 ? -0.5 + roll(world) * 1.5 : -4 - roll(world) * 3;
      nextPolitics.approval = bounded(nextPolitics.approval + delta);
      nextActor.reputation.political = bounded(nextActor.reputation.political + delta * 0.5);
      return ok(world, delta > 1 ? 'The press conference landed well and your approval improved.' : delta < -1 ? 'The press conference went poorly. Weak delivery overshadowed the message.' : 'The press conference was mostly a wash.');
    }
    if (action.verb === 'politics.town_hall') {
      const score = nextActor.empathy * 0.45 + speaking * 0.35 + nextActor.reputation.political * 0.2 + (roll(world) - 0.5) * 24;
      const delta = score > 60 ? 2.2 + roll(world) * 1.8 : score < 42 ? -1.5 - roll(world) * 1.5 : 0.5;
      nextPolitics.approval = bounded(nextPolitics.approval + delta);
      nextActor.stress = bounded(nextActor.stress + 0.8);
      return ok(world, delta > 1 ? 'The town hall built trust with voters.' : delta < 0 ? 'The town hall exposed some weak spots and cost approval.' : 'The town hall helped a little.');
    }
    if (action.verb === 'politics.fundraiser') {
      const raised = Math.max(15_000, Math.round((nextActor.charisma + nextActor.reputation.business + nextActor.reputation.political) * 3_500 * (0.6 + roll(world))));
      if (nextPolitics.campaign) nextPolitics.campaign.fundsCents += raised;
      else nextActor.reputation.political = bounded(nextActor.reputation.political + 1.2);
      return ok(world, nextPolitics.campaign ? `The fundraiser added ${(raised / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} to the campaign.` : 'The fundraiser expanded your donor network and political reputation.');
    }
    nextPolitics.approval = bounded(nextPolitics.approval + 1.5 + nextActor.empathy / 100);
    nextActor.stress = bounded(nextActor.stress + 1.2);
    return ok(world, 'Constituent work was not glamorous, but it built some durable goodwill.');
  }

  if (action.verb === 'markets.hire_wealth_manager' || action.verb === 'legal.hire_private_counsel') {
    const kind = action.verb === 'markets.hire_wealth_manager' ? 'wealth-manager' : 'private-counsel';
    const label = kind === 'wealth-manager' ? 'Wealth manager' : 'Private counsel';
    const minimumCash = kind === 'wealth-manager' ? 2_500_000 : 1_000_000;
    if (actor.cashCents < minimumCash) return blocked(source, `${label} services are available, but you do not have enough liquidity to retain one responsibly.`);
    const world = cloneWorld(source);
    world.advisors ??= {};
    const existing = Object.values(world.advisors).find((advisor) => advisor.kind === kind && advisor.active);
    if (existing) return blocked(source, `You already have active ${label.toLowerCase()} services.`);
    const id = allocateId(world, 'advisor');
    const weeklyCostCents = kind === 'wealth-manager' ? 75_000 : 55_000;
    world.advisors[id] = { id, kind, label, weeklyCostCents, quality: 55 + roll(world) * 30, active: true };
    const retainer = weeklyCostCents * 8;
    world.characters[world.playerCharacterId].cashCents -= retainer;
    transaction(world, 'advisor-retainer', -retainer, `${label} eight-week retainer`, actor.id, id);
    return ok(world, `${label} retained. The first eight weeks cost ${(retainer / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.`);
  }

  if (action.verb === 'organization.create') {
    if (age < 14) return blocked(source, 'You are not old enough to start an independent organization yet.');
    const requestedCapital = Math.max(0, amount(action.parameters) || Math.min(actor.cashCents, 100_000));
    if (requestedCapital > actor.cashCents) return blocked(source, 'You do not have enough liquid cash to fund that organization.');
    const world = cloneWorld(source);
    const nextActor = world.characters[world.playerCharacterId];
    const id = allocateId(world, 'organization');
    const validKinds = ['club', 'charity', 'party', 'professional', 'faction', 'security', 'other'] as const;
    const requestedKind = typeof action.parameters.kind === 'string' ? action.parameters.kind : 'other';
    const kind = (validKinds as readonly string[]).includes(requestedKind) ? requestedKind as typeof validKinds[number] : 'other';
    const name = typeof action.parameters.name === 'string' && action.parameters.name.trim() ? action.parameters.name.trim().slice(0, 60) : `${nextActor.lastName} Group`;
    nextActor.cashCents -= requestedCapital;
    world.organizations[id] = { id, kind, name, resourcesCents: requestedCapital, influence: 8, stability: 45, memberIds: [nextActor.id], leaderId: nextActor.id, history: [`Founded by ${nextActor.firstName} ${nextActor.lastName}.`] };
    if (requestedCapital > 0) transaction(world, 'organization-funding', -requestedCapital, `Founded ${name}`, nextActor.id, id);
    return ok(world, `${name} is now part of the world.`);
  }

  return blocked(source, 'That action is not available yet.');
}
