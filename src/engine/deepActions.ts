import { allocateId, playerAgeYears } from './createWorld';
import { recordHistory } from './history';
import { nextRandom } from './random';
import type { ActionResult, IntentAction, Relationship, WorldState } from './types';
import { ADVISOR_OFFERINGS, cityById, playerTimeLoad, politicalSkill } from './opportunityMarkets';

import { WORLD_CONTENT } from '@/content/worldContent';

const DEEP_VERBS = new Set([
  'career.apply_listing',
  'education.apply_program', 'education.enroll_program', 'education.study_session', 'education.party', 'education.sport', 'education.pay_tuition', 'education.drop_out',
  'life.move_city', 'life.emigrate',
  'health.join_gym', 'health.gym', 'health.run', 'health.group_class', 'health.therapy', 'health.meditate',
  'business.hire_ceo',
  'politics.engage',
  'advisor.hire', 'advisor.fire',
  'property.evict', 'property.renovate_room',
]);

export function isDeepAction(verb: string): boolean {
  return DEEP_VERBS.has(verb);
}

function clone(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world)) as WorldState;
}

function roll(world: WorldState): number {
  const result = nextRandom(world.rngState);
  world.rngState = result.state;
  return result.value;
}

function validResult(world: WorldState, message: string): ActionResult {
  return { world, validation: { valid: true, requiresConfirmation: false }, message };
}

function invalid(source: WorldState, message: string, prerequisites?: string[]): ActionResult {
  return { world: source, validation: { valid: false, reason: message, prerequisites, requiresConfirmation: false }, message };
}

function finish(world: WorldState, domain: Parameters<typeof recordHistory>[1], title: string, message: string, important = false): ActionResult {
  world.metadata.updatedAt = new Date().toISOString();
  recordHistory(world, domain, title, message, { important });
  return validResult(world, message);
}

function cash(world: WorldState, amountCents: number, memo: string, toId?: string): boolean {
  const actor = world.characters[world.playerCharacterId];
  if (amountCents > actor.cashCents) return false;
  actor.cashCents -= amountCents;
  world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'life-choice', amountCents: -amountCents, fromId: actor.id, toId, memo });
  return true;
}

function activeHigherEducation(world: WorldState) {
  const actor = world.characters[world.playerCharacterId];
  return Object.values(world.education).find((record) => record.characterId === actor.id && ['higher', 'trade'].includes(record.status));
}

function makeAcquaintance(world: WorldState, source: string): string {
  const actor = world.characters[world.playerCharacterId];
  const firstNames = ['Avery', 'Sam', 'Nia', 'Luca', 'Maya', 'Noah', 'Zoe', 'Eli', 'Mina', 'Jordan'];
  const lastNames = ['Reed', 'Ortiz', 'Kim', 'Shah', 'Brooks', 'Nguyen', 'Chen', 'Foster', 'Patel', 'Wallace'];
  const personId = allocateId(world, 'character');
  const firstName = firstNames[Math.floor(roll(world) * firstNames.length)];
  const lastName = lastNames[Math.floor(roll(world) * lastNames.length)];
  world.characters[personId] = {
    id: personId,
    firstName,
    lastName,
    birthWeek: world.calendar.week - Math.max(18, playerAgeYears(world) + Math.round((roll(world) - 0.5) * 10)) * 52,
    isAlive: true,
    cityId: actor.cityId,
    householdId: `household-${personId}`,
    parentIds: [], childIds: [], cashCents: Math.round(200_000 + roll(world) * 4_000_000),
    health: 70 + roll(world) * 20, mood: 58 + roll(world) * 25, stress: 20 + roll(world) * 35,
    discipline: 35 + roll(world) * 50, ambition: 35 + roll(world) * 55, empathy: 35 + roll(world) * 55,
    riskTolerance: 30 + roll(world) * 60, ethics: 35 + roll(world) * 55, knowledge: 35 + roll(world) * 55,
    charisma: 35 + roll(world) * 55, fitness: 35 + roll(world) * 55,
    focuses: ['Networking', 'Health', 'Creative Work'],
    reputation: { public: 45, business: 42, employee: 50, political: 35, professional: 46, family: 52, faction: 20 },
    detailTier: 'standard', lastMeaningfulWeek: world.calendar.week,
  };
  const relationshipId = allocateId(world, 'relationship');
  world.relationships[relationshipId] = {
    id: relationshipId,
    characterIds: [actor.id, personId],
    kind: 'acquaintance',
    trust: 30 + roll(world) * 12,
    affection: 32 + roll(world) * 15,
    respect: 38 + roll(world) * 15,
    resentment: 0,
    lastInteractionWeek: world.calendar.week,
  } as Relationship;
  world.memories[allocateId(world, 'memory')] = {
    id: `memory-${world.metadata.nextSequence - 1}`,
    participantIds: [actor.id, personId], category: 'first-meeting', week: world.calendar.week,
    valence: 25, importance: 28, permanent: false, unresolved: false, visibility: 'shared',
    narrative: `${actor.firstName} met ${firstName} ${lastName} through ${source}.`,
  };
  return `${firstName} ${lastName}`;
}

export function executeDeepAction(source: WorldState, action: IntentAction, confirmed = false): ActionResult | undefined {
  if (!isDeepAction(action.verb)) {
    if (action.verb === 'business.create' && playerTimeLoad(source) + 38 > 100) {
      return invalid(source, 'You do not have enough weekly capacity to personally launch another business.', ['Delegate an existing company, hire a CEO, leave your job, or finish school first.']);
    }
    return undefined;
  }

  const world = clone(source);
  const actor = world.characters[world.playerCharacterId];
  const age = playerAgeYears(world);

  switch (action.verb) {
    case 'career.apply_listing': {
      if (age < 16) return invalid(source, 'You are not old enough for this job market yet.');
      if (playerTimeLoad(source) + (Object.values(source.careers).some((item) => item.characterId === actor.id && item.active) ? 0 : 44) > 100) return invalid(source, 'Your existing commitments leave no room for a full-time job.', ['Delegate businesses or reduce another major commitment.']);
      const profession = WORLD_CONTENT.professions.find((item) => item.id === action.parameters.professionId);
      if (!profession) return invalid(source, 'That weekly listing is no longer available.');
      const completedHigher = Object.values(world.education).some((record) => record.characterId === actor.id && record.status === 'completed' && record.level !== 'Secondary diploma');
      const experience = Object.values(world.careers).filter((career) => career.characterId === actor.id).reduce((sum, career) => sum + career.weeksInRole, 0);
      const missing: string[] = [];
      if (age < profession.minimumAge) missing.push(`age ${profession.minimumAge}`);
      if (profession.requiredDegree && !completedHigher) missing.push('college credential');
      if (actor.knowledge < profession.minKnowledge) missing.push(`knowledge ${profession.minKnowledge}`);
      if (experience < profession.minExperienceWeeks) missing.push(`${Math.ceil(profession.minExperienceWeeks / 52)} years experience`);
      if (actor.reputation.professional < profession.minReputation) missing.push(`professional reputation ${profession.minReputation}`);
      if (missing.length > 0) return invalid(source, `Your resume does not clear this role's hard requirements: ${missing.join(', ')}.`);
      const fit = typeof action.parameters.fitScore === 'number' ? action.parameters.fitScore : 55;
      const chance = Math.max(0.08, Math.min(0.94, 0.22 + fit / 135 - world.economy.unemployment * 1.4));
      if (roll(world) >= chance) {
        actor.reputation.professional = Math.min(100, actor.reputation.professional + 0.4);
        return finish(world, 'career', 'Application submitted', 'You made the shortlist, but another candidate got the offer this week.');
      }
      const employerId = typeof action.parameters.employerId === 'string' ? action.parameters.employerId : allocateId(world, 'organization');
      const employerName = typeof action.parameters.employerName === 'string' ? action.parameters.employerName : 'Local employer';
      if (!world.organizations[employerId]) world.organizations[employerId] = { id: employerId, kind: 'business', name: employerName, resourcesCents: 80_000_000_00, influence: 38, stability: 66, memberIds: [], history: ['Generated by the weekly employment market.'] };
      Object.values(world.careers).forEach((career) => { if (career.characterId === actor.id) career.active = false; });
      const careerId = allocateId(world, 'career');
      world.careers[careerId] = {
        id: careerId, characterId: actor.id, employerId,
        title: typeof action.parameters.title === 'string' ? action.parameters.title : profession.title,
        sector: profession.sector,
        weeklySalaryCents: typeof action.parameters.weeklySalaryCents === 'number' ? Math.round(action.parameters.weeklySalaryCents) : profession.weeklySalaryCents,
        performance: Math.max(40, Math.min(72, 48 + fit * 0.18)), satisfaction: 62, weeksInRole: 0, active: true,
      };
      actor.professionId = profession.id;
      actor.focuses = ['Job', ...actor.focuses.filter((item) => item !== 'Job')].slice(0, 3);
      return finish(world, 'career', 'New job', `${employerName} hired you as ${world.careers[careerId].title}. Your resume opened the door; performance now has to keep it open.`, true);
    }

    case 'education.apply_program': {
      if (age < 15) return invalid(source, 'You are not old enough to apply to this program.');
      if (activeHigherEducation(world)) return invalid(source, 'Finish or leave your current program before applying elsewhere.');
      const university = WORLD_CONTENT.universities.find((item) => item.id === action.parameters.universityId);
      if (!university) return invalid(source, 'That school is not available.');
      const knowledgeGap = actor.knowledge - university.admissionKnowledge;
      const reputationGap = actor.reputation.professional - university.admissionReputation;
      const chance = Math.max(0.05, Math.min(0.96, 0.52 + knowledgeGap / 90 + reputationGap / 180 + actor.charisma / 700 - university.prestige / 850));
      if (roll(world) > chance) return finish(world, 'education', 'Application decision', `${university.name} declined the application. Stronger grades, experience, or recommendations could change a future result.`);
      const id = allocateId(world, 'education');
      const trade = university.id.includes('trades');
      const programYears = trade ? 2 : 4;
      world.education[id] = {
        id, characterId: actor.id, institutionId: university.id, status: 'accepted', level: trade ? 'Trade program' : 'Undergraduate program',
        recordedGrade: Math.max(55, actor.knowledge), knowledgeGain: actor.knowledge, prestige: university.prestige, network: university.network,
        tuitionCentsPerYear: 0, annualTuitionCents: university.tuitionCentsPerYear, tuitionBalanceCents: university.tuitionCentsPerYear * programYears,
        manipulatedCredential: false,
      };
      return finish(world, 'education', 'Accepted', `${university.name} offered you a place. Tuition is not paid automatically; the balance follows the program.`, true);
    }

    case 'education.enroll_program': {
      const record = action.targetIds.map((id) => world.education[id]).find((item) => item?.characterId === actor.id && item.status === 'accepted');
      if (!record) return invalid(source, 'Choose an accepted offer first.');
      record.status = record.level.toLowerCase().includes('trade') ? 'trade' : 'higher';
      record.startedWeek = world.calendar.week;
      actor.focuses = ['Academics', ...actor.focuses.filter((item) => item !== 'Academics')].slice(0, 3);
      return finish(world, 'education', 'College begins', `You enrolled. Classes, campus life, tuition, grades, sports, and your network can now pull your life in different directions.`, true);
    }

    case 'education.study_session': {
      const record = activeHigherEducation(world);
      if (!record) return invalid(source, 'You are not enrolled in college or trade school.');
      record.recordedGrade = Math.min(100, record.recordedGrade + 2.8 + actor.discipline / 80);
      actor.knowledge = Math.min(100, actor.knowledge + 0.9);
      actor.stress = Math.min(100, actor.stress + 2.5);
      return finish(world, 'education', 'Study session', 'You gave up some free time for schoolwork. Your academic position improved, but the week got a little heavier.');
    }

    case 'education.party': {
      const record = activeHigherEducation(world);
      if (!record) return invalid(source, 'Campus parties are only available while enrolled.');
      actor.mood = Math.min(100, actor.mood + 6);
      actor.stress = Math.max(0, actor.stress - 4);
      record.recordedGrade = Math.max(0, record.recordedGrade - (1.2 + roll(world) * 2.4));
      record.network = Math.min(100, record.network + 2 + roll(world) * 3);
      const met = roll(world) < 0.38 ? makeAcquaintance(world, 'a campus party') : null;
      return finish(world, 'education', 'Campus night', met ? `You had a good night out and met ${met}. Your network grew, while school got a little less attention.` : 'You took a night off. Your mood improved and your network moved a little, but your coursework paid part of the price.');
    }

    case 'education.sport': {
      const record = activeHigherEducation(world);
      if (!record) return invalid(source, 'Campus sports are only available while enrolled.');
      const sport = typeof action.parameters.sport === 'string' ? action.parameters.sport : 'club sport';
      record.campusSport = sport;
      record.network = Math.min(100, record.network + 2.5);
      actor.fitness = Math.min(100, actor.fitness + 2.2);
      actor.mood = Math.min(100, actor.mood + 2);
      actor.focuses = ['Sport', ...actor.focuses.filter((item) => item !== 'Sport')].slice(0, 3);
      return finish(world, 'education', 'Campus sports', `${sport} is now part of your campus life. It builds fitness and connections, but it competes with academics for attention.`);
    }

    case 'education.pay_tuition': {
      const record = activeHigherEducation(world) ?? Object.values(world.education).find((item) => item.characterId === actor.id && item.status === 'accepted');
      if (!record) return invalid(source, 'There is no current tuition balance.');
      const balance = record.tuitionBalanceCents ?? 0;
      if (balance <= 0) return invalid(source, 'Tuition is already paid.');
      const requested = typeof action.parameters.amountCents === 'number' ? Math.round(action.parameters.amountCents) : balance;
      const payment = Math.min(balance, requested);
      if (!cash(world, payment, `Tuition payment for ${world.organizations[record.institutionId]?.name ?? record.level}`, record.institutionId)) return invalid(source, 'You do not have enough cash for that tuition payment.');
      record.tuitionBalanceCents = balance - payment;
      return finish(world, 'education', 'Tuition paid', `You paid ${(payment / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}. ${(record.tuitionBalanceCents ?? 0) > 0 ? 'A balance remains.' : 'The program is fully paid.'}`);
    }

    case 'education.drop_out': {
      const record = activeHigherEducation(world);
      if (!record) return invalid(source, 'You are not currently enrolled.');
      if (!confirmed) return { world: source, validation: { valid: true, requiresConfirmation: true }, message: 'Leaving school ends the current enrollment, but your credits, debt, skills, and relationships remain.' };
      record.status = 'withdrawn';
      actor.focuses = actor.focuses.filter((item) => item !== 'Academics');
      return finish(world, 'education', 'Left school', 'You dropped out. The credential is unfinished, but what you learned and who you met remain part of your life.', true);
    }

    case 'life.move_city': {
      const destination = cityById(String(action.parameters.cityId ?? ''));
      if (!destination) return invalid(source, 'Choose a city that is available.');
      if (destination.countryId !== world.activeCountryId) return invalid(source, 'Moving to another country uses the emigration path.');
      if (destination.id === actor.cityId) return invalid(source, 'You already live there.');
      if (!cash(world, destination.moveCostCents, `Move to ${destination.name}`)) return invalid(source, 'You cannot afford the moving costs.');
      const householdIds = new Set([actor.id, actor.partnerId, ...actor.childIds].filter(Boolean) as string[]);
      for (const id of householdIds) if (world.characters[id]) world.characters[id].cityId = destination.id;
      return finish(world, 'life', 'Moved cities', `You moved your household to ${destination.name}. Housing, jobs, relationships, and opportunities will now develop from a different place.`, true);
    }

    case 'life.emigrate': {
      if (age < 18) return invalid(source, 'Independent international relocation is available in adulthood.');
      const countryId = String(action.parameters.countryId ?? '');
      const country = world.countries[countryId];
      const destination = cityById(String(action.parameters.cityId ?? ''));
      if (!country || !destination || destination.countryId !== countryId) return invalid(source, 'Choose a valid destination country and city.');
      if (countryId === world.activeCountryId) return invalid(source, 'You already live in that country.');
      const cost = destination.moveCostCents + 550_000;
      if (actor.cashCents < cost) return invalid(source, 'You cannot afford the relocation and application costs.');
      const readiness = Math.min(0.94, 0.42 + actor.knowledge / 300 + actor.reputation.professional / 500 + Math.min(0.18, actor.cashCents / 100_000_000));
      cash(world, cost, `International relocation to ${country.name}`);
      if (roll(world) > readiness) return finish(world, 'life', 'Relocation delayed', `Your fictional relocation application to ${country.name} was not approved this time. Part of the administrative and travel cost is gone, but you can try again later.`);
      world.activeCountryId = countryId;
      const householdIds = new Set([actor.id, actor.partnerId, ...actor.childIds].filter(Boolean) as string[]);
      for (const id of householdIds) if (world.characters[id]) world.characters[id].cityId = destination.id;
      return finish(world, 'life', 'A new country', `Your household emigrated to ${destination.name}, ${country.name}. Your old relationships remain, while institutions and opportunities now come from a different country.`, true);
    }

    case 'health.join_gym': {
      const existing = Object.values(world.organizations).find((org) => org.kind === 'club' && org.memberIds.includes(actor.id) && org.history.some((item) => item.startsWith('membership:gym:')));
      if (existing) return invalid(source, 'You already have a gym membership.');
      const weekly = 3_500;
      const initiation = 42_000;
      if (!cash(world, initiation, 'Gym initiation fee')) return invalid(source, 'You cannot afford the gym initiation fee.');
      const id = allocateId(world, 'organization');
      world.organizations[id] = { id, kind: 'club', name: 'Harbor Athletic Club', resourcesCents: initiation, influence: 18, stability: 82, memberIds: [actor.id], history: [`membership:gym:${weekly}:72`, 'A neighborhood gym with classes, training space, and a social scene.'] };
      return finish(world, 'health', 'Gym membership', 'You joined Harbor Athletic Club. The membership will cost $35 per week whenever time advances.');
    }

    case 'health.gym': {
      const member = Object.values(world.organizations).some((org) => org.kind === 'club' && org.memberIds.includes(actor.id) && org.history.some((item) => item.startsWith('membership:gym:')));
      const visitCost = member ? 0 : 2_500;
      if (visitCost > 0 && !cash(world, visitCost, 'Gym day pass')) return invalid(source, 'You cannot afford a gym day pass.');
      actor.fitness = Math.min(100, actor.fitness + 2.8);
      actor.health = Math.min(100, actor.health + 1.3);
      actor.stress = Math.max(0, actor.stress - 1.5);
      return finish(world, 'health', 'Workout', member ? 'You got a solid workout in using your membership.' : 'You bought a day pass and got a solid workout in.');
    }

    case 'health.run':
      actor.fitness = Math.min(100, actor.fitness + 1.8);
      actor.health = Math.min(100, actor.health + 0.7);
      actor.stress = Math.max(0, actor.stress - 2.2);
      actor.mood = Math.min(100, actor.mood + 1.5);
      return finish(world, 'health', 'Went for a run', 'A run cost nothing but time. Fitness improved a little and the day felt lighter.');

    case 'health.group_class': {
      const cost = 4_500;
      if (!cash(world, cost, 'Group fitness class')) return invalid(source, 'You cannot afford the class.');
      actor.fitness = Math.min(100, actor.fitness + 1.5);
      actor.mood = Math.min(100, actor.mood + 2.5);
      const met = roll(world) < 0.48 ? makeAcquaintance(world, 'a group class') : null;
      return finish(world, 'health', 'Group class', met ? `The class was good for you, and you met ${met}. They now appear under acquaintances.` : 'The class improved your fitness and mood. Nobody new really clicked this time.');
    }

    case 'health.therapy': {
      const cost = 18_000;
      if (!cash(world, cost, 'Therapy session')) return invalid(source, 'You cannot afford a therapy session.');
      actor.stress = Math.max(0, actor.stress - 8);
      actor.mood = Math.min(100, actor.mood + 4);
      actor.empathy = Math.min(100, actor.empathy + 0.6);
      return finish(world, 'health', 'Therapy', 'You spent time unpacking what has been weighing on you. Stress fell and your emotional footing improved.');
    }

    case 'health.meditate':
      actor.stress = Math.max(0, actor.stress - 3.5);
      actor.mood = Math.min(100, actor.mood + 1.5);
      actor.discipline = Math.min(100, actor.discipline + 0.25);
      return finish(world, 'health', 'Quiet time', 'You slowed down for a while. Nothing dramatic happened, which was the point.');

    case 'business.hire_ceo': {
      const business = world.businesses[action.targetIds[0]];
      if (!business || (business.ownerId ?? business.founderId) !== actor.id || !business.active) return invalid(source, 'Choose an active business you own.');
      const salary = Number(action.parameters.salaryWeeklyCents ?? 0);
      if (salary <= 0) return invalid(source, 'Choose an executive candidate with a salary.');
      if (business.cashCents < salary * 8) return invalid(source, 'The company needs at least eight weeks of the CEO salary in cash before making this hire.');
      const organization = world.organizations[business.organizationId];
      const executiveId = allocateId(world, 'character');
      const firstName = String(action.parameters.firstName ?? 'Jordan');
      const lastName = String(action.parameters.lastName ?? 'Reed');
      const management = Number(action.parameters.management ?? 60);
      const leadership = Number(action.parameters.leadership ?? 60);
      const finance = Number(action.parameters.finance ?? 55);
      world.characters[executiveId] = {
        id: executiveId, firstName, lastName, birthWeek: world.calendar.week - (38 + Math.round(roll(world) * 18)) * 52,
        isAlive: true, cityId: business.cityId, householdId: `household-${executiveId}`, parentIds: [], childIds: [], cashCents: 8_000_000,
        health: 76, mood: 64, stress: 38, discipline: management, ambition: leadership, empathy: 52, riskTolerance: 54, ethics: 65,
        knowledge: finance, charisma: leadership, fitness: 52, focuses: ['Job', 'Networking', 'Health'],
        reputation: { public: 48, business: 65, employee: 62, political: 38, professional: 70, family: 50, faction: 25 },
        detailTier: 'standard', lastMeaningfulWeek: world.calendar.week, professionId: 'profession-chief-executive',
      };
      const relationshipId = allocateId(world, 'relationship');
      world.relationships[relationshipId] = { id: relationshipId, characterIds: [actor.id, executiveId], kind: 'professional', trust: 45, affection: 35, respect: 62, resentment: 3, lastInteractionWeek: world.calendar.week };
      const careerId = allocateId(world, 'career');
      world.careers[careerId] = { id: careerId, characterId: executiveId, employerId: business.organizationId, title: `CEO of ${business.name}`, sector: business.sector, weeklySalaryCents: Math.round(salary), performance: Number(action.parameters.fitScore ?? 65), satisfaction: 68, weeksInRole: 0, active: true };
      organization.leaderId = executiveId;
      organization.memberIds.push(executiveId);
      business.delegated = true;
      business.capacity = Math.round(business.capacity * (1 + management / 800));
      return finish(world, 'business', 'CEO hired', `${firstName} ${lastName} is now CEO of ${business.name} at ${(salary / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} per week. Your time burden falls, but the company now pays for professional leadership.`, true);
    }

    case 'politics.engage': {
      if (age < 18) return invalid(source, 'Political campaigning and public-office activity opens in adulthood.');
      const politics = world.politics[actor.id] ?? { characterId: actor.id, authority: 0, approval: 50 };
      world.politics[actor.id] = politics;
      const activity = String(action.parameters.activity ?? 'town-hall');
      const cost = Number(action.parameters.amountCents ?? (activity === 'fundraiser' ? 35_000 : activity === 'press-conference' ? 18_000 : 5_000));
      if (cost > 0 && !cash(world, cost, `Political activity: ${activity}`)) return invalid(source, 'You cannot afford that political activity.');
      const skill = politicalSkill(world, activity);
      const difficulty = activity === 'press-conference' ? 62 : activity === 'policy-briefing' ? 58 : activity === 'fundraiser' ? 55 : 50;
      const outcome = skill + (roll(world) - 0.5) * 42 - difficulty;
      const approvalDelta = Math.max(-9, Math.min(8, outcome / 5.5));
      politics.approval = Math.max(0, Math.min(100, politics.approval + approvalDelta));
      actor.reputation.political = Math.max(0, Math.min(100, actor.reputation.political + approvalDelta * 0.35 + (outcome > 0 ? 0.7 : -0.3)));
      const pretty = activity.replace(/-/g, ' ');
      return finish(world, 'politics', pretty, outcome >= 12 ? `The ${pretty} went well. Your preparation and personal skills translated into a noticeable approval bump.` : outcome >= 0 ? `The ${pretty} was competent but not transformative. You gained a little ground.` : `The ${pretty} went poorly. Your current skills were exposed, and approval slipped.`, Math.abs(approvalDelta) >= 5);
    }

    case 'advisor.hire': {
      const type = String(action.parameters.type ?? '');
      const offering = ADVISOR_OFFERINGS.find((item) => item.type === type);
      if (!offering) return invalid(source, 'Choose a professional service.');
      const existing = Object.values(world.organizations).find((org) => org.kind === 'professional' && org.memberIds.includes(actor.id) && org.history.some((item) => item.startsWith(`service:${type}:`)));
      if (existing) return invalid(source, `You already retain a ${offering.title.toLowerCase()}.`);
      const upfront = offering.weeklyCostCents * 4;
      if (!cash(world, upfront, `Initial retainer: ${offering.title}`)) return invalid(source, `You need at least one month of the ${offering.title.toLowerCase()}'s retainer in cash.`);
      const providerId = allocateId(world, 'character');
      const names = offering.type === 'attorney' ? ['Alexis Park', 'Cameron Brooks'] : offering.type === 'wealth-manager' ? ['Mina Shah', 'Theo Bennett'] : ['Jordan Reed', 'Avery Chen'];
      const [firstName, lastName] = names[Math.floor(roll(world) * names.length)].split(' ');
      world.characters[providerId] = {
        id: providerId, firstName, lastName, birthWeek: world.calendar.week - (34 + Math.round(roll(world) * 24)) * 52,
        isAlive: true, cityId: actor.cityId, householdId: `household-${providerId}`, parentIds: [], childIds: [], cashCents: 12_000_000,
        health: 75, mood: 65, stress: 32, discipline: offering.quality, ambition: 65, empathy: 60, riskTolerance: 42, ethics: 74,
        knowledge: offering.quality, charisma: 60, fitness: 50, focuses: ['Job', 'Networking', 'Health'],
        reputation: { public: 50, business: 66, employee: 64, political: 42, professional: offering.quality, family: 55, faction: 20 },
        detailTier: 'standard', lastMeaningfulWeek: world.calendar.week, professionId: offering.type === 'attorney' ? 'profession-attorney' : offering.type === 'wealth-manager' ? 'profession-banker' : undefined,
      };
      const orgId = allocateId(world, 'organization');
      world.organizations[orgId] = { id: orgId, kind: 'professional', name: `${lastName} ${offering.title}`, resourcesCents: upfront, influence: offering.quality / 2, stability: 80, memberIds: [actor.id, providerId], leaderId: providerId, history: [`service:${type}:${offering.weeklyCostCents}:${offering.quality}`, offering.description] };
      const relationshipId = allocateId(world, 'relationship');
      world.relationships[relationshipId] = { id: relationshipId, characterIds: [actor.id, providerId], kind: 'professional', trust: 48, affection: 30, respect: 64, resentment: 0, lastInteractionWeek: world.calendar.week };
      if (type === 'property-manager') Object.values(world.properties).filter((property) => property.ownerId === actor.id).forEach((property) => { property.managed = true; });
      return finish(world, 'wealth', 'Professional retained', `You hired ${firstName} ${lastName} as your ${offering.title.toLowerCase()}. The initial month is paid; the retainer continues whenever time advances.`);
    }

    case 'advisor.fire': {
      const type = String(action.parameters.type ?? '');
      const organization = Object.values(world.organizations).find((org) => org.kind === 'professional' && org.memberIds.includes(actor.id) && org.history.some((item) => item.startsWith(`service:${type}:`)));
      if (!organization) return invalid(source, 'You do not currently retain that service.');
      organization.memberIds = organization.memberIds.filter((id) => id !== actor.id);
      if (type === 'property-manager') Object.values(world.properties).filter((property) => property.ownerId === actor.id).forEach((property) => { property.managed = false; });
      return finish(world, 'wealth', 'Retainer ended', `You ended the ${type.replace(/-/g, ' ')} relationship. Future weekly fees stop now.`);
    }

    case 'property.evict': {
      const property = world.properties[action.targetIds[0]];
      if (!property || property.ownerId !== actor.id) return invalid(source, 'Choose a property you own.');
      if (property.occupancy !== 'tenant') return invalid(source, 'There is no tenant to remove.');
      const cost = 35_000;
      if (!cash(world, cost, `Tenant turnover at ${property.name}`, property.id)) return invalid(source, 'You cannot afford the turnover and filing costs.');
      property.occupancy = 'vacant';
      actor.reputation.public = Math.max(0, actor.reputation.public - 0.5 - roll(world) * 1.5);
      return finish(world, 'property', 'Tenant moved out', `${property.name} is vacant. Turnover cost money, and the property will not collect rent until you find another tenant.`);
    }

    case 'property.renovate_room': {
      const property = world.properties[action.targetIds[0]];
      if (!property || property.ownerId !== actor.id) return invalid(source, 'Choose a property you own.');
      const room = String(action.parameters.room ?? 'interior');
      const fraction = room === 'kitchen' ? 0.035 : room === 'bathroom' ? 0.022 : room === 'exterior' ? 0.028 : 0.045;
      const spend = Math.round(property.valueCents * fraction);
      if (!cash(world, spend, `${room} renovation at ${property.name}`, property.id)) return invalid(source, `You need ${(spend / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} for that renovation.`);
      property.condition = Math.min(100, property.condition + 7 + fraction * 100);
      property.valueCents += Math.round(spend * (0.62 + roll(world) * 0.34));
      property.weeklyRentCents = Math.round(property.weeklyRentCents * (1 + fraction * 1.8));
      return finish(world, 'property', `${room} updated`, `You renovated the ${room} at ${property.name}. Condition improved and the market value moved, but not every dollar came back as equity.`);
    }
  }

  return undefined;
}
