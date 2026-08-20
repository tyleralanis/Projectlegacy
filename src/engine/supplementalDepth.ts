import { applyAutonomousWorld } from './autonomousWorld';
import { allocateId } from './createWorld';
import { recordHistory } from './history';
import { applyImmersionWorld } from './immersionWorld';
import { applyLivingWorldPass } from './livingWorld';
import type { ActionResult, Business, FocusArea, IntentAction, WorldState } from './types';

import { WORLD_CONTENT } from '@/content/worldContent';

function clone(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world)) as WorldState;
}

function ok(world: WorldState, message: string): ActionResult {
  return { world, validation: { valid: true, requiresConfirmation: false }, message };
}

function blocked(source: WorldState, message: string): ActionResult {
  return { world: source, validation: { valid: false, reason: message, requiresConfirmation: false }, message };
}

function academicFocus(existing: FocusArea[]): FocusArea[] {
  return ['Academics' as FocusArea, ...existing.filter((item) => item !== 'Academics')].slice(0, 3);
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
  if (existing) {
    existing.principalCents += amountCents;
    return;
  }
  const id = allocateId(world, 'liability');
  world.liabilities[id] = {
    id,
    debtorId: actor.id,
    kind: 'student',
    principalCents: amountCents,
    annualRateBps: 0,
    weeklyPaymentCents: 0,
    securedById: educationId,
  };
}

function addTransaction(world: WorldState, kind: string, amountCents: number, memo: string, toId?: string): void {
  const actor = world.characters[world.playerCharacterId];
  world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind, amountCents, fromId: actor.id, toId, memo });
}

export function normalizeSupplementalState(source: WorldState): WorldState {
  const actor = source.characters[source.playerCharacterId];
  const activeTuition = Object.values(source.education).filter((record) => record.characterId === actor.id && ['higher', 'trade'].includes(record.status) && record.tuitionCentsPerYear > 0);
  if (activeTuition.length === 0) return source;
  const world = clone(source);
  for (const original of activeTuition) {
    const record = world.education[original.id];
    if (!tuitionLiability(world, record.id)) addTuitionBill(world, record.id, annualTuition(world, record.id));
    record.tuitionCentsPerYear = 0;
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

export function ceoCandidates(world: WorldState, business: Business): CEOCandidate[] {
  const firstNames = ['Avery', 'Nia', 'Theo', 'Camila', 'Priya', 'Miles', 'Sofia', 'Darius', 'Mina', 'Quinn'];
  const lastNames = ['Bennett', 'Shah', 'Ortega', 'Kim', 'Wallace', 'Nguyen', 'Patel', 'Brooks', 'Alvarez', 'Okafor'];
  return Array.from({ length: 5 }, (_, index) => {
    const key = `${world.metadata.worldSeed}:${Math.floor(world.calendar.week / 4)}:${business.id}:${index}`;
    const management = Math.round(48 + unit(`${key}:m`) * 49);
    const leadership = Math.round(45 + unit(`${key}:l`) * 52);
    const finance = Math.round(38 + unit(`${key}:f`) * 58);
    const sectorFit = Math.round(35 + unit(`${key}:${business.sector}:s`) * 63);
    const fitScore = Math.round(management * 0.34 + leadership * 0.3 + finance * 0.14 + sectorFit * 0.22);
    const salaryWeeklyCents = Math.round((120_000 + fitScore * 4_700) * Math.max(0.85, Math.min(4.5, Math.log10(Math.max(100_000, business.valuationCents / 100)) / 5.2)));
    return {
      id: `ceo-${business.id}-${Math.floor(world.calendar.week / 4)}-${index}`,
      firstName: firstNames[(hash(`${key}:first`) + index) % firstNames.length],
      lastName: lastNames[(hash(`${key}:last`) + index) % lastNames.length],
      salaryWeeklyCents,
      management,
      leadership,
      finance,
      sectorFit,
      fitScore,
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
  const firstName = String(action.parameters.firstName ?? 'Jordan');
  const lastName = String(action.parameters.lastName ?? 'Reed');
  const management = Number(action.parameters.management ?? 65);
  const leadership = Number(action.parameters.leadership ?? 65);
  const finance = Number(action.parameters.finance ?? 55);
  const fitScore = Number(action.parameters.fitScore ?? 65);
  const executiveId = allocateId(world, 'character');

  world.characters[executiveId] = {
    id: executiveId,
    firstName,
    lastName,
    birthWeek: world.calendar.week - 45 * 52,
    isAlive: true,
    cityId: nextBusiness.cityId,
    householdId: `household-${executiveId}`,
    parentIds: [],
    childIds: [],
    cashCents: 8_000_000,
    health: 76,
    mood: 64,
    stress: 40,
    discipline: management,
    ambition: leadership,
    empathy: 52,
    riskTolerance: 54,
    ethics: 66,
    knowledge: finance,
    charisma: leadership,
    fitness: 52,
    focuses: ['Job', 'Networking', 'Health'],
    reputation: { public: 48, business: fitScore, employee: management, political: 38, professional: fitScore, family: 50, faction: 20 },
    detailTier: 'standard',
    lastMeaningfulWeek: world.calendar.week,
    professionId: 'profession-chief-executive',
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
  recordHistory(world, 'business', 'CEO hired', `${firstName} ${lastName} took over day-to-day leadership of ${nextBusiness.name}.`, { important: true, subjectIds: [actor.id, executiveId, nextBusiness.id] });
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
    nextActor.focuses = academicFocus(nextActor.focuses);
    recordHistory(world, 'education', 'Enrolled', `You enrolled at ${WORLD_CONTENT.universities.find((item) => item.id === nextRecord.institutionId)?.name ?? 'school'}. Tuition is now due rather than silently disappearing each week.`, { important: true });
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
    world.characters[world.playerCharacterId].cashCents -= payment;
    world.liabilities[liability.id].principalCents -= payment;
    addTransaction(world, 'tuition', -payment, 'Tuition payment', educationId);
    return ok(world, world.liabilities[liability.id].principalCents > 0 ? 'Tuition payment recorded. A balance remains.' : 'Tuition is paid for the current academic year.');
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
    nextActor.focuses = academicFocus(nextActor.focuses);
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
    world.organizations[id] = { id, kind: 'club', name: 'Harbor Athletic Club', resourcesCents: annualCost, influence: 15, stability: 80, memberIds: [nextActor.id], history: [`gym-membership:${world.calendar.week}:52`] };
    addTransaction(world, 'wellness-membership', -annualCost, 'Annual gym membership', id);
    return ok(world, 'You joined the gym for $780 per year. Gym visits are now included while the membership is active.');
  }

  if (action.verb === 'health.gym' && hasGymMembership(source)) {
    const world = clone(source);
    const nextActor = world.characters[world.playerCharacterId];
    nextActor.fitness = Math.min(100, nextActor.fitness + 3.2);
    nextActor.health = Math.min(100, nextActor.health + 1);
    nextActor.mood = Math.min(100, nextActor.mood + 0.8);
    nextActor.stress = Math.max(0, nextActor.stress - 1);
    return ok(world, 'You used your gym membership. Fitness and health improved.');
  }

  if (action.verb === 'business.hire_ceo') return hireCEO(source, action);

  if (action.verb === 'business.fire_ceo') {
    if (!confirmed) return { world: source, validation: { valid: true, requiresConfirmation: true }, message: 'Firing the CEO returns the company to owner-led operation.' };
    const business = source.businesses[action.targetIds[0]];
    if (!business || !business.delegated) return blocked(source, 'Choose a professionally managed company.');
    const world = clone(source);
    const next = world.businesses[business.id];
    const organization = world.organizations[next.organizationId];
    if (organization?.leaderId) {
      Object.values(world.careers).forEach((career) => { if (career.characterId === organization.leaderId && career.employerId === organization.id) career.active = false; });
      organization.leaderId = world.playerCharacterId;
    }
    next.delegated = false;
    delete next.managerName;
    delete next.managerQuality;
    delete next.managerSalaryWeeklyCents;
    next.personalTimeHours = 30;
    return ok(world, `${next.name} is owner-led again. The time burden is back on you.`);
  }

  return null;
}

export function applySupplementalAdvance(before: WorldState, after: WorldState): WorldState {
  const weeks = Math.max(0, after.calendar.week - before.calendar.week);
  if (weeks <= 0) return after;
  const world = clone(after);

  for (const business of Object.values(world.businesses)) {
    if (!business.active || !business.delegated || !business.managerSalaryWeeklyCents) continue;
    const payroll = business.managerSalaryWeeklyCents * weeks;
    business.cashCents -= payroll;
    if (business.managerQuality) {
      business.quality = Math.min(100, business.quality + ((business.managerQuality - 55) / 600) * weeks);
      business.reputation = Math.min(100, business.reputation + ((business.managerQuality - 58) / 900) * weeks);
    }
  }

  for (const organization of Object.values(world.organizations)) {
    if (organization.kind !== 'club') continue;
    const markerIndex = organization.history.findIndex((entry) => entry.startsWith('gym-membership:'));
    if (markerIndex < 0) continue;
    const parts = organization.history[markerIndex].split(':');
    const started = Number(parts[1] ?? world.calendar.week);
    const duration = Number(parts[2] ?? 52);
    if (world.calendar.week - started >= duration) organization.history.splice(markerIndex, 1);
  }

  const lived = applyLivingWorldPass(before, world);
  const autonomous = applyAutonomousWorld(before, lived);
  return applyImmersionWorld(before, autonomous);
}
