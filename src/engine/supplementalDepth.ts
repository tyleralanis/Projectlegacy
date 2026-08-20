import { allocateId, playerAgeYears } from './createWorld';
import { recordHistory } from './history';
import { nextRandom } from './random';
import type { ActionResult, Business, IntentAction, WorldState } from './types';

import { WORLD_CONTENT } from '@/content/worldContent';

function clone(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world)) as WorldState;
}

function roll(world: WorldState): number {
  const next = nextRandom(world.rngState);
  world.rngState = next.state;
  return next.value;
}

function ok(world: WorldState, message: string): ActionResult {
  return { world, validation: { valid: true, requiresConfirmation: false }, message };
}

function blocked(source: WorldState, message: string): ActionResult {
  return { world: source, validation: { valid: false, reason: message, requiresConfirmation: false }, message };
}

function transaction(world: WorldState, kind: string, amountCents: number, memo: string, toId?: string): void {
  const actor = world.characters[world.playerCharacterId];
  world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind, amountCents, fromId: actor.id, toId, memo });
}

function tuitionLiability(world: WorldState, educationId: string) {
  const actor = world.characters[world.playerCharacterId];
  return Object.values(world.liabilities).find((item) => item.debtorId === actor.id && item.kind === 'student' && item.securedById === educationId);
}

function annualTuition(world: WorldState, educationId: string): number {
  const record = world.education[educationId];
  if (!record) return 0;
  const school = WORLD_CONTENT.universities.find((item) => item.id === record.institutionId);
  return school?.tuitionCentsPerYear ?? record.tuitionCentsPerYear;
}

function addTuitionBill(world: WorldState, educationId: string, amountCents: number): void {
  if (amountCents <= 0) return;
  const actor = world.characters[world.playerCharacterId];
  const existing = tuitionLiability(world, educationId);
  if (existing) existing.principalCents += amountCents;
  else {
    const id = allocateId(world, 'liability');
    world.liabilities[id] = { id, debtorId: actor.id, kind: 'student', principalCents: amountCents, annualRateBps: 0, weeklyPaymentCents: 0, securedById: educationId };
  }
}

export function normalizeSupplementalState(source: WorldState): WorldState {
  const actor = source.characters[source.playerCharacterId];
  const active = Object.values(source.education).filter((record) => record.characterId === actor.id && ['higher', 'trade'].includes(record.status) && record.tuitionCentsPerYear > 0);
  if (active.length === 0) return source;
  const world = clone(source);
  for (const record of active) {
    const current = world.education[record.id];
    if (!tuitionLiability(world, current.id)) addTuitionBill(world, current.id, annualTuition(world, current.id));
    current.tuitionCentsPerYear = 0;
  }
  return world;
}

export function getTuitionBalance(world: WorldState, educationId: string): number {
  return tuitionLiability(world, educationId)?.principalCents ?? 0;
}

export function hasGymMembership(world: WorldState): boolean {
  const actor = world.characters[world.playerCharacterId];
  return Object.values(world.organizations).some((organization) => organization.kind === 'club' && organization.memberIds.includes(actor.id) && organization.history.some((entry) => entry.startsWith('gym-membership:')));
}

function meetAcquaintance(world: WorldState, context: string): string {
  const actor = world.characters[world.playerCharacterId];
  const names = [
    ['Avery', 'Brooks'], ['Jordan', 'Vale'], ['Sam', 'Patel'], ['Nora', 'Kim'],
    ['Cameron', 'Price'], ['Maya', 'Rivera'], ['Eli', 'Morgan'], ['Quinn', 'Bennett'],
  ];
  const selected = names[Math.floor(roll(world) * names.length) % names.length];
  const id = allocateId(world, 'character');
  const age = Math.max(16, playerAgeYears(world) + Math.floor(roll(world) * 9) - 4);
  world.characters[id] = {
    id, firstName: selected[0], lastName: selected[1], birthWeek: world.calendar.week - age * 52, isAlive: true,
    cityId: actor.cityId, householdId: `household-${id}`, parentIds: [], childIds: [], cashCents: 120_000 + Math.round(roll(world) * 1_800_000),
    health: 65 + roll(world) * 25, mood: 55 + roll(world) * 30, stress: 15 + roll(world) * 35,
    discipline: 35 + roll(world) * 45, ambition: 35 + roll(world) * 55, empathy: 35 + roll(world) * 55,
    riskTolerance: 25 + roll(world) * 60, ethics: 40 + roll(world) * 50, knowledge: 30 + roll(world) * 55,
    charisma: 35 + roll(world) * 55, fitness: 35 + roll(world) * 55, focuses: ['Health', 'Networking', 'Creative Work'],
    reputation: { public: 45, business: 45, employee: 50, political: 35, professional: 48, family: 55, faction: 15 },
    detailTier: 'standard', lastMeaningfulWeek: world.calendar.week,
  };
  const relationshipId = allocateId(world, 'relationship');
  world.relationships[relationshipId] = { id: relationshipId, characterIds: [actor.id, id], kind: 'acquaintance', trust: 30, affection: 34, respect: 38, resentment: 0, lastInteractionWeek: world.calendar.week };
  recordHistory(world, 'relationship', 'Met someone new', `${actor.firstName} met ${selected[0]} ${selected[1]} ${context}.`, { subjectIds: [actor.id, id] });
  return `${selected[0]} ${selected[1]}`;
}

export interface CEOCandidate {
  id: string;
  firstName: string;
  lastName: string;
  salaryWeeklyCents: number;
  management: number;
  leadership: number;
  finance: number;
  sectorFit: number;
  fitScore: number;
}

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function unit(input: string): number {
  return (hash(input) % 100_003) / 100_003;
}

export function ceoCandidates(world: WorldState, business: Business): CEOCandidate[] {
  const firstNames = ['Avery', 'Nia', 'Theo', 'Camila', 'Priya', 'Miles', 'Sofia', 'Darius', 'Mina', 'Quinn'];
  const lastNames = ['Bennett', 'Shah', 'Ortega', 'Kim', 'Wallace', 'Nguyen', 'Patel', 'Brooks', 'Alvarez', 'Okafor'];
  return Array.from({ length: 5 }, (_, index) => {
    const key = `${world.metadata.worldSeed}:${world.calendar.week}:${business.id}:${index}`;
    const management = Math.round(48 + unit(`${key}:m`) * 49);
    const leadership = Math.round(45 + unit(`${key}:l`) * 52);
    const finance = Math.round(38 + unit(`${key}:f`) * 58);
    const sectorFit = Math.round(35 + unit(`${key}:${business.sector}:s`) * 63);
    const fitScore = Math.round(management * 0.34 + leadership * 0.3 + finance * 0.14 + sectorFit * 0.22);
    const scale = Math.max(0.85, Math.min(4.5, Math.log10(Math.max(100_000, business.valuationCents / 100)) / 5.2));
    const salaryWeeklyCents = Math.round((120_000 + fitScore * 4_700) * scale);
    return {
      id: `ceo-${business.id}-${world.calendar.week}-${index}`,
      firstName: firstNames[(hash(`${key}:first`) + index) % firstNames.length],
      lastName: lastNames[(hash(`${key}:last`) + index) % lastNames.length],
      salaryWeeklyCents, management, leadership, finance, sectorFit, fitScore,
    };
  }).sort((a, b) => b.fitScore - a.fitScore);
}

function hireCEO(source: WorldState, action: IntentAction): ActionResult {
  const actor = source.characters[source.playerCharacterId];
  const business = source.businesses[action.targetIds[0]];
  if (!business || !business.active || (business.ownerId ?? business.founderId) !== actor.id) return blocked(source, 'Choose an active business you own.');
  const salary = typeof action.parameters.salaryWeeklyCents === 'number' ? Math.round(action.parameters.salaryWeeklyCents) : 0;
  if (salary <= 0) return blocked(source, 'Choose a CEO candidate first.');
  if (business.cashCents < salary * 12) return blocked(source, `${business.name} needs at least twelve weeks of the proposed CEO salary in company cash.`);

  const world = clone(source);
  const nextBusiness = world.businesses[business.id];
  const organization = world.organizations[nextBusiness.organizationId];
  if (organization?.leaderId && organization.leaderId !== actor.id) {
    Object.values(world.careers).forEach((career) => { if (career.characterId === organization.leaderId && career.employerId === organization.id) career.active = false; });
  }
  const firstName = String(action.parameters.firstName ?? 'Jordan');
  const lastName = String(action.parameters.lastName ?? 'Reed');
  const management = Number(action.parameters.management ?? 65);
  const leadership = Number(action.parameters.leadership ?? 65);
  const finance = Number(action.parameters.finance ?? 55);
  const fitScore = Number(action.parameters.fitScore ?? 65);
  const executiveId = allocateId(world, 'character');
  world.characters[executiveId] = {
    id: executiveId, firstName, lastName, birthWeek: world.calendar.week - (38 + Math.floor(roll(world) * 20)) * 52, isAlive: true,
    cityId: nextBusiness.cityId, householdId: `household-${executiveId}`, parentIds: [], childIds: [], cashCents: 8_000_000,
    health: 76, mood: 64, stress: 40, discipline: management, ambition: leadership, empathy: 52, riskTolerance: 54, ethics: 66,
    knowledge: finance, charisma: leadership, fitness: 52, focuses: ['Job', 'Networking', 'Health'],
    reputation: { public: 48, business: fitScore, employee: management, political: 38, professional: fitScore, family: 50, faction: 20 },
    detailTier: 'standard', lastMeaningfulWeek: world.calendar.week, professionId: 'profession-chief-executive',
  };
  const relationshipId = allocateId(world, 'relationship');
  world.relationships[relationshipId] = { id: relationshipId, characterIds: [actor.id, executiveId], kind: 'professional', trust: 45, affection: 28, respect: 62, resentment: 2, lastInteractionWeek: world.calendar.week };
  const careerId = allocateId(world, 'career');
  world.careers[careerId] = { id: careerId, characterId: executiveId, employerId: nextBusiness.organizationId, title: `CEO of ${nextBusiness.name}`, sector: nextBusiness.sector, weeklySalaryCents: salary, performance: fitScore, satisfaction: 68, weeksInRole: 0, active: true };
  if (organization) {
    organization.leaderId = executiveId;
    if (!organization.memberIds.includes(executiveId)) organization.memberIds.push(executiveId);
    organization.history.push(`${firstName} ${lastName} hired as CEO in week ${world.calendar.week}.`);
  }
  nextBusiness.delegated = true;
  nextBusiness.managerName = `${firstName} ${lastName}`;
  nextBusiness.managerQuality = fitScore;
  nextBusiness.managerSalaryWeeklyCents = salary;
  nextBusiness.personalTimeHours = 5;
  recordHistory(world, 'business', 'CEO hired', `${firstName} ${lastName} took over day-to-day leadership of ${nextBusiness.name}. Salary is ${(salary / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} per week.`, { important: true, subjectIds: [actor.id, executiveId, nextBusiness.id] });
  return ok(world, `${firstName} ${lastName} is now CEO of ${nextBusiness.name}. You keep ownership while giving up most of the weekly operating burden.`);
}

export function executeSupplementalDepth(source: WorldState, action: IntentAction, confirmed = false): ActionResult | null {
  const actor = source.characters[source.playerCharacterId];

  if (action.verb === 'education.enroll') {
    const record = action.targetIds.map((id) => source.education[id]).find((item) => item?.characterId === actor.id && item.status === 'accepted');
    if (!record) return blocked(source, 'Choose an accepted school offer first.');
    const world = clone(source);
    const nextRecord = world.education[record.id];
    nextRecord.status = nextRecord.level.toLowerCase().includes('trade') ? 'trade' : 'higher';
    nextRecord.startedWeek = world.calendar.week;
    const tuition = annualTuition(world, nextRecord.id);
    nextRecord.tuitionCentsPerYear = 0;
    addTuitionBill(world, nextRecord.id, tuition);
    const nextActor = world.characters[world.playerCharacterId];
    nextActor.focuses = ['Academics', ...nextActor.focuses.filter((item) => item !== 'Academics')].slice(0, 3);
    recordHistory(world, 'education', 'Enrolled', `You enrolled at ${WORLD_CONTENT.universities.find((item) => item.id === nextRecord.institutionId)?.name ?? 'school'}. The first year's tuition is now due rather than silently disappearing each week.`, { important: true });
    return ok(world, `Enrollment is active. ${(tuition / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} in tuition is due.`);
  }

  if (action.verb === 'education.pay_tuition') {
    const educationId = action.targetIds[0];
    const liability = tuitionLiability(source, educationId);
    if (!liability || liability.principalCents <= 0) return blocked(source, 'There is no unpaid tuition on that program.');
    const requested = typeof action.parameters.amountCents === 'number' ? Math.max(1, Math.round(action.parameters.amountCents)) : liability.principalCents;
    const payment = Math.min(requested, liability.principalCents);
    if (actor.cashCents < payment) return blocked(source, 'You do not have enough cash for that tuition payment.');
    const world = clone(source);
    const nextActor = world.characters[world.playerCharacterId];
    const nextLiability = world.liabilities[liability.id];
    nextActor.cashCents -= payment;
    nextLiability.principalCents -= payment;
    transaction(world, 'tuition', -payment, `Tuition payment`, educationId);
    recordHistory(world, 'education', 'Tuition payment', `You paid ${(payment / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} toward school. ${(nextLiability.principalCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} remains due.`);
    return ok(world, nextLiability.principalCents > 0 ? 'Tuition payment recorded. A balance remains.' : 'Tuition is paid for the current academic year.');
  }

  if (action.verb === 'education.study') {
    const active = Object.values(source.education).find((record) => record.characterId === actor.id && ['higher', 'trade'].includes(record.status));
    if (!active) return null;
    const world = clone(source);
    const nextActor = world.characters[world.playerCharacterId];
    const record = world.education[active.id];
    record.recordedGrade = Math.min(100, record.recordedGrade + 2 + nextActor.discipline / 90);
    nextActor.knowledge = Math.min(100, nextActor.knowledge + 0.8);
    nextActor.stress = Math.min(100, nextActor.stress + 1.8);
    nextActor.focuses = ['Academics', ...nextActor.focuses.filter((item) => item !== 'Academics')].slice(0, 3);
    return ok(world, 'You put in a real study session. Grades and knowledge improved, at the cost of a little stress.');
  }

  if (action.verb === 'health.join_gym') {
    if (hasGymMembership(source)) return blocked(source, 'You already have a gym membership.');
    const annualCost = 78_000;
    if (actor.cashCents < annualCost) return blocked(source, 'The annual gym membership costs $780.');
    const world = clone(source);
    const nextActor = world.characters[world.playerCharacterId];
    nextActor.cashCents -= annualCost;
    const id = allocateId(world, 'organization');
    world.organizations[id] = { id, kind: 'club', name: 'Harbor Athletic Club', resourcesCents: annualCost, influence: 18, stability: 84, memberIds: [nextActor.id], history: [`gym-membership:${world.calendar.week}:${annualCost}`, 'A local gym with training space and group classes.'] };
    transaction(world, 'membership', -annualCost, 'Annual gym membership', id);
    return ok(world, 'You joined Harbor Athletic Club for $780/year. Gym visits are now included.');
  }

  if (action.verb === 'health.gym') {
    const member = hasGymMembership(source);
    const cost = member ? 0 : 2_500;
    if (actor.cashCents < cost) return blocked(source, 'A gym day pass costs $25.');
    const world = clone(source);
    const nextActor = world.characters[world.playerCharacterId];
    if (cost > 0) { nextActor.cashCents -= cost; transaction(world, 'wellness', -cost, 'Gym day pass'); }
    nextActor.fitness = Math.min(100, nextActor.fitness + 3.2);
    nextActor.health = Math.min(100, nextActor.health + 1);
    nextActor.mood = Math.min(100, nextActor.mood + 0.8);
    nextActor.stress = Math.max(0, nextActor.stress - 1);
    const met = roll(world) < 0.1 ? meetAcquaintance(world, 'at the gym') : null;
    return ok(world, met ? `Good workout. You also met ${met}.` : member ? 'Good workout. Your membership covered the visit.' : 'Good workout. The day pass cost $25.');
  }

  if (action.verb === 'health.group_class') {
    const cost = 3_800;
    if (actor.cashCents < cost) return blocked(source, 'The group class costs $38.');
    const world = clone(source);
    const nextActor = world.characters[world.playerCharacterId];
    nextActor.cashCents -= cost;
    transaction(world, 'wellness', -cost, 'Group fitness class');
    nextActor.fitness = Math.min(100, nextActor.fitness + 2);
    nextActor.health = Math.min(100, nextActor.health + 0.7);
    nextActor.mood = Math.min(100, nextActor.mood + 1.5);
    nextActor.stress = Math.max(0, nextActor.stress - 1.2);
    const met = roll(world) < 0.3 ? meetAcquaintance(world, 'in a group class') : null;
    return ok(world, met ? `The class went well, and you met ${met}. They now show under Acquaintances.` : 'The class helped, but nobody new really clicked this time.');
  }

  if (action.verb === 'business.hire_ceo') return hireCEO(source, action);

  return null;
}

export function applySupplementalAdvance(previous: WorldState, advanced: WorldState): WorldState {
  const weeks = Math.max(0, advanced.calendar.week - previous.calendar.week);
  if (weeks <= 0) return advanced;
  const world = advanced;
  const actor = world.characters[world.playerCharacterId];

  for (const business of Object.values(world.businesses)) {
    if (!business.active || (business.ownerId ?? business.founderId) !== actor.id || !business.delegated || !business.managerSalaryWeeklyCents) continue;
    const due = Math.round(business.managerSalaryWeeklyCents * weeks);
    business.cashCents -= due;
    business.costWeeklyCents += business.managerSalaryWeeklyCents;
    if (business.managerQuality) {
      business.quality = Math.min(100, business.quality + Math.min(2.5, Math.max(-1, (business.managerQuality - 55) / 500 * weeks)));
      business.capacity = Math.max(1, business.capacity * (1 + Math.min(0.045, business.managerQuality / 42_000 * weeks)));
    }
    if (business.cashCents < -Math.max(2_500_000, business.costWeeklyCents * 10)) {
      business.active = false;
      recordHistory(world, 'business', `${business.name} closed`, 'Executive payroll and operating losses exhausted the company’s runway.', { important: true });
    }
  }

  for (const record of Object.values(world.education)) {
    if (record.characterId !== actor.id || !['higher', 'trade'].includes(record.status) || record.startedWeek === undefined) continue;
    const previousYear = Math.floor(Math.max(0, previous.calendar.week - record.startedWeek) / 52);
    const currentYear = Math.floor(Math.max(0, world.calendar.week - record.startedWeek) / 52);
    const billedYears = Math.max(0, Math.min(record.status === 'trade' ? 1 : 3, currentYear) - Math.min(record.status === 'trade' ? 1 : 3, previousYear));
    if (billedYears > 0) addTuitionBill(world, record.id, annualTuition(world, record.id) * billedYears);
    record.tuitionCentsPerYear = 0;
  }

  for (const organization of Object.values(world.organizations)) {
    if (!organization.memberIds.includes(actor.id)) continue;
    const marker = organization.history.find((entry) => entry.startsWith('gym-membership:'));
    if (!marker) continue;
    const [, startText, costText] = marker.split(':');
    const startWeek = Number(startText);
    const annualCost = Number(costText);
    const beforeYears = Math.floor(Math.max(0, previous.calendar.week - startWeek) / 52);
    const afterYears = Math.floor(Math.max(0, world.calendar.week - startWeek) / 52);
    const renewals = Math.max(0, afterYears - beforeYears);
    if (renewals <= 0 || !Number.isFinite(annualCost)) continue;
    const due = annualCost * renewals;
    if (actor.cashCents >= due) {
      actor.cashCents -= due;
      transaction(world, 'membership', -due, `${renewals} gym membership renewal${renewals === 1 ? '' : 's'}`, organization.id);
    } else {
      organization.memberIds = organization.memberIds.filter((id) => id !== actor.id);
      recordHistory(world, 'health', 'Gym membership ended', 'The annual membership came due and there was not enough cash to renew it.');
    }
  }

  return world;
}
