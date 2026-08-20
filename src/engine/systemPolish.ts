import { effectiveCareerCompetence } from './competencies';
import { allocateId, playerAgeYears } from './createWorld';
import { recordHistory } from './history';
import { clampCents } from './money';
import { nextRandom } from './random';
import type { Business, Character, EducationState, PropertyAsset, WorldState } from './types';

import { WORLD_CONTENT } from '@/content/worldContent';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function money(cents: number): string {
  const dollars = cents / 100;
  const absolute = Math.abs(dollars);
  const sign = dollars < 0 ? '-' : '';
  const compact = absolute >= 1_000_000_000 ? `${(absolute / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`
    : absolute >= 1_000_000 ? `${(absolute / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
      : absolute >= 1_000 ? `${(absolute / 1_000).toFixed(1).replace(/\.0$/, '')}K`
        : absolute.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return `${sign}$${compact}`;
}

function crossedPeriods(beforeWeek: number, afterWeek: number, anchorWeek: number, interval: number): number {
  if (afterWeek <= beforeWeek || afterWeek <= anchorWeek) return 0;
  const beforePeriods = Math.max(0, Math.floor((beforeWeek - anchorWeek) / interval));
  const afterPeriods = Math.max(0, Math.floor((afterWeek - anchorWeek) / interval));
  return Math.max(0, afterPeriods - beforePeriods);
}

function random(world: WorldState): number {
  const next = nextRandom(world.rngState);
  world.rngState = next.state;
  return next.value;
}

function addTransaction(world: WorldState, kind: string, amountCents: number, memo: string, fromId?: string, toId?: string): void {
  world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind, amountCents: clampCents(amountCents), memo, fromId, toId });
  if (world.transactions.length > 1_200) world.transactions.splice(0, world.transactions.length - 1_200);
}

function upsertPrivateMemory(world: WorldState, category: string, participantIds: string[], narrative: string, importance: number, unresolved = false): void {
  const existing = Object.values(world.memories).find((memory) => memory.category === category && participantIds.every((id) => memory.participantIds.includes(id)));
  if (existing) {
    existing.narrative = narrative;
    existing.week = world.calendar.week;
    existing.importance = Math.max(existing.importance, importance);
    existing.unresolved = unresolved;
    return;
  }
  const id = allocateId(world, 'memory');
  world.memories[id] = { id, participantIds, category, week: world.calendar.week, valence: 0.1, importance, permanent: false, unresolved, visibility: 'private', narrative };
}

function processInvestmentIncome(before: WorldState, world: WorldState): void {
  const weeks = Math.max(0, world.calendar.week - before.calendar.week);
  if (weeks <= 0) return;
  const actor = world.characters[world.playerCharacterId];
  let total = 0;
  for (const holding of Object.values(world.holdings).filter((item) => item.ownerId === actor.id)) {
    const security = world.securities[holding.securityId];
    if (!security || security.dividendYieldBps <= 0 || holding.unitsMilli <= 0) continue;
    const value = Math.round((holding.unitsMilli * security.priceCents) / 1000);
    const payout = Math.max(0, Math.round(value * (security.dividendYieldBps / 10_000) * (weeks / 52)));
    if (payout <= 0) continue;
    actor.cashCents = clampCents(actor.cashCents + payout);
    total += payout;
    addTransaction(world, 'investment-dividend', payout, `${security.symbol} dividend`, security.id, actor.id);
  }
  if (total > 0 && weeks >= 13) {
    upsertPrivateMemory(world, 'Investing · Cash yield', [actor.id], `Your existing portfolio paid ${money(total)} of cash distributions during the last ${weeks} simulated weeks. Price appreciation and cash yield are now separate sources of return.`, 42, false);
  }
}

function annualTuitionFor(record: EducationState): number {
  const school = WORLD_CONTENT.universities.find((item) => item.id === record.institutionId);
  return Math.max(0, school?.tuitionCentsPerYear ?? record.tuitionCentsPerYear ?? 0);
}

function studentLiability(world: WorldState, educationId: string) {
  const actor = world.characters[world.playerCharacterId];
  return Object.values(world.liabilities).find((liability) => liability.debtorId === actor.id && liability.kind === 'student' && liability.securedById === educationId);
}

function addTuitionLiability(world: WorldState, educationId: string, amountCents: number): void {
  if (amountCents <= 0) return;
  const actor = world.characters[world.playerCharacterId];
  const existing = studentLiability(world, educationId);
  if (existing) existing.principalCents = clampCents(existing.principalCents + amountCents);
  else {
    const id = allocateId(world, 'liability');
    world.liabilities[id] = { id, debtorId: actor.id, kind: 'student', principalCents: amountCents, annualRateBps: 0, weeklyPaymentCents: 0, securedById: educationId };
  }
}

function processEducationBilling(before: WorldState, world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  for (const record of Object.values(world.education).filter((item) => item.characterId === actor.id && ['higher', 'trade'].includes(item.status))) {
    const started = record.startedWeek ?? world.calendar.week;
    const years = crossedPeriods(before.calendar.week, world.calendar.week, started, 52);
    if (years <= 0) continue;
    const gross = annualTuitionFor(record);
    const scholarship = Math.max(0, record.scholarshipCents ?? 0);
    const netAnnual = Math.max(0, gross - scholarship);
    const bill = clampCents(netAnnual * years);
    addTuitionLiability(world, record.id, bill);
    if (bill > 0) {
      recordHistory(world, 'education', 'A new tuition year came due', `${money(bill)} was added to the outstanding tuition balance after scholarship aid. College cost is now a recurring annual obligation rather than a one-time enrollment charge.`, { subjectIds: [actor.id, record.id], importance: 2 });
    } else if (scholarship > 0) {
      recordHistory(world, 'education', 'Scholarship covered the new tuition year', `Your ${money(scholarship)} annual scholarship covered the tuition billed this year.`, { subjectIds: [actor.id, record.id], importance: 2 });
    }
  }
}

function processCareerReviews(before: WorldState, world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  const career = Object.values(world.careers).find((item) => item.characterId === actor.id && item.active);
  if (!career) return;
  const beforeCareer = before.careers[career.id];
  const beforeWeeks = beforeCareer?.weeksInRole ?? Math.max(0, career.weeksInRole - (world.calendar.week - before.calendar.week));
  const reviews = Math.max(0, Math.floor(career.weeksInRole / 26) - Math.floor(beforeWeeks / 26));
  if (reviews <= 0) return;

  for (let review = 0; review < reviews; review += 1) {
    const competence = effectiveCareerCompetence(world, career);
    const standing = career.organizationStanding ?? 48;
    const score = clamp(career.performance * 0.42 + competence * 0.28 + standing * 0.18 + actor.reputation.professional * 0.12);
    if (score >= 78) {
      const raise = 1.025 + Math.min(0.045, (score - 78) / 400);
      const oldPay = career.weeklySalaryCents;
      career.weeklySalaryCents = clampCents(Math.round(career.weeklySalaryCents * raise));
      const bonusWeeks = score >= 90 ? 4 : score >= 84 ? 2 : 1;
      const bonus = clampCents(career.weeklySalaryCents * bonusWeeks);
      actor.cashCents = clampCents(actor.cashCents + bonus);
      career.promotionProgress = clamp((career.promotionProgress ?? 0) + 8 + (score - 78) * 0.35);
      career.organizationStanding = clamp(standing + 3.5);
      career.satisfaction = clamp(career.satisfaction + 2.5);
      actor.reputation.professional = clamp(actor.reputation.professional + 1.2);
      addTransaction(world, 'career-bonus', bonus, `${career.title} performance bonus`, career.employerId, actor.id);
      recordHistory(world, 'career', 'A strong performance review', `Your review landed at roughly ${Math.round(score)}/100. Pay rose from ${money(oldPay * 52)}/yr to ${money(career.weeklySalaryCents * 52)}/yr and the organization paid a ${money(bonus)} bonus.`, { subjectIds: [actor.id, career.id], importance: 3 });
    } else if (score >= 55) {
      const oldPay = career.weeklySalaryCents;
      career.weeklySalaryCents = clampCents(Math.round(career.weeklySalaryCents * 1.01));
      career.promotionProgress = clamp((career.promotionProgress ?? 0) + 2);
      career.organizationStanding = clamp(standing + 0.5);
      recordHistory(world, 'career', 'A steady performance review', `The review was solid rather than career-changing. Pay moved from ${money(oldPay * 52)}/yr to ${money(career.weeklySalaryCents * 52)}/yr and your promotion case inched forward.`, { subjectIds: [actor.id, career.id], importance: 1 });
    } else if (score < 40) {
      career.organizationStanding = clamp(standing - 6);
      career.promotionProgress = clamp((career.promotionProgress ?? 0) - 8);
      career.satisfaction = clamp(career.satisfaction - 5);
      actor.stress = clamp(actor.stress + 4);
      upsertPrivateMemory(world, 'Career · Performance warning', [actor.id, career.id], `The latest review put you near ${Math.round(score)}/100. Performance, competence, and internal standing are now weak enough that another bad review could turn a stagnant career into a job-security problem.`, 66, true);
      recordHistory(world, 'career', 'Work put you on notice', 'The organization did not treat mediocre performance as a cosmetic meter. Your standing and promotion case both took a real hit.', { subjectIds: [actor.id, career.id], importance: 3 });
    }
  }
}

function createManagedTenant(world: WorldState, property: PropertyAsset): Character {
  const actor = world.characters[world.playerCharacterId];
  const firstNames = ['Maya', 'Noah', 'Avery', 'Jordan', 'Sofia', 'Eli', 'Nora', 'Cam', 'Mina', 'Theo'];
  const lastNames = ['Brooks', 'Patel', 'Nguyen', 'Rivera', 'Bennett', 'Kim', 'Price', 'Shah', 'Morgan', 'Okafor'];
  const id = allocateId(world, 'character');
  const age = 23 + Math.floor(random(world) * 38);
  const tenant: Character = {
    id,
    firstName: firstNames[Math.floor(random(world) * firstNames.length) % firstNames.length],
    lastName: lastNames[Math.floor(random(world) * lastNames.length) % lastNames.length],
    birthWeek: world.calendar.week - age * 52,
    isAlive: true,
    cityId: property.cityId,
    householdId: `household-${id}`,
    parentIds: [], childIds: [],
    cashCents: Math.round(350_000 + random(world) * 5_000_000),
    health: 65 + random(world) * 28,
    mood: 50 + random(world) * 36,
    stress: 18 + random(world) * 45,
    discipline: 42 + random(world) * 50,
    ambition: 34 + random(world) * 58,
    empathy: 38 + random(world) * 54,
    riskTolerance: 25 + random(world) * 58,
    ethics: 44 + random(world) * 50,
    knowledge: 38 + random(world) * 54,
    charisma: 35 + random(world) * 58,
    fitness: 35 + random(world) * 55,
    focuses: ['Job', 'Family', 'Health'],
    reputation: { public: 45, business: 42, employee: 55, political: 30, professional: 50, family: 55, faction: 10 },
    detailTier: 'standard', lastMeaningfulWeek: world.calendar.week,
  };
  world.characters[id] = tenant;
  const relationshipId = allocateId(world, 'relationship');
  world.relationships[relationshipId] = { id: relationshipId, characterIds: [actor.id, id], kind: 'professional', trust: 42, affection: 16, respect: 50, resentment: 0, lastInteractionWeek: world.calendar.week };
  return tenant;
}

function hasActiveTenantMemory(world: WorldState, propertyId: string): boolean {
  return Object.values(world.memories).some((memory) => memory.category === `Property · Tenant · ${propertyId}` && memory.unresolved);
}

function processManagedLeasing(before: WorldState, world: WorldState): void {
  if (Math.floor(before.calendar.week / 4) === Math.floor(world.calendar.week / 4)) return;
  const actor = world.characters[world.playerCharacterId];
  for (const property of Object.values(world.properties).filter((item) => item.ownerId === actor.id && item.managed && item.occupancy === 'vacant' && !['land', 'development', 'residence', 'estate'].includes(item.kind))) {
    if (property.condition < 38 || property.weeklyRentCents <= 0 || hasActiveTenantMemory(world, property.id)) continue;
    const yieldRatio = property.weeklyRentCents * 52 / Math.max(1, property.valueCents);
    const desirability = clamp(property.condition * 0.55 + Math.min(35, yieldRatio > 0 ? 25 / Math.max(0.01, yieldRatio) * 0.04 : 0) + random(world) * 25);
    if (desirability < 45) continue;
    const tenant = createManagedTenant(world, property);
    property.occupancy = 'tenant';
    const memoryId = allocateId(world, 'memory');
    world.memories[memoryId] = { id: memoryId, participantIds: [actor.id, tenant.id, property.id], category: `Property · Tenant · ${property.id}`, week: world.calendar.week, valence: 0.2, importance: 52, permanent: false, unresolved: true, visibility: 'shared', narrative: `${tenant.firstName} ${tenant.lastName} leased ${property.name} at ${money(property.weeklyRentCents)}/week after your portfolio manager handled the screening and turnover.` };
    recordHistory(world, 'property', `${property.name} was leased`, `Your property manager filled the vacancy with ${tenant.firstName} ${tenant.lastName} without requiring a routine player decision.`, { subjectIds: [actor.id, tenant.id, property.id], importance: 2 });
  }
}

function businessMargin(business: Business): number {
  return business.revenueWeeklyCents <= 0 ? -1 : (business.revenueWeeklyCents - business.costWeeklyCents) / business.revenueWeeklyCents;
}

function processDelegatedBusinessReports(before: WorldState, world: WorldState): void {
  const quarterCrosses = Math.max(0, Math.floor(world.calendar.week / 13) - Math.floor(before.calendar.week / 13));
  if (quarterCrosses <= 0) return;
  const actor = world.characters[world.playerCharacterId];
  for (const business of Object.values(world.businesses).filter((item) => item.active && item.delegated && (item.ownerId ?? item.founderId) === actor.id && item.playerOwnershipBps > 0)) {
    const margin = businessMargin(business);
    const runway = business.costWeeklyCents > 0 ? business.cashCents / business.costWeeklyCents : 99;
    const quality = business.managerQuality ?? 55;
    const state = business.cashCents < 0 || margin < -0.08 ? 'under pressure' : margin >= 0.2 && quality >= 75 ? 'executing very well' : margin >= 0.08 ? 'healthy' : 'mixed';
    const narrative = `${business.managerName ?? 'Management'} reports that ${business.name} is ${state}. Weekly revenue is ${money(business.revenueWeeklyCents)}, weekly cost is ${money(business.costWeeklyCents)}, operating margin is ${(margin * 100).toFixed(1)}%, cash runway is about ${Math.max(0, runway).toFixed(1)} weeks, and CEO quality is ${Math.round(quality)}/100. Routine hiring, capacity, marketing, and expansion remain delegated.`;
    upsertPrivateMemory(world, `Business · Board report · ${business.id}`, [actor.id, business.id], narrative, state === 'under pressure' ? 72 : 48, state === 'under pressure');
    if (state === 'under pressure') recordHistory(world, 'business', `${business.name} needs owner attention`, narrative, { subjectIds: [actor.id, business.id], importance: 3 });
  }
}

function processSportsContractReviews(before: WorldState, world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  const career = Object.values(world.careers).find((item) => item.characterId === actor.id && item.active && (item.sector === 'Sports' || /athlete/i.test(item.title)));
  if (!career) return;
  const beforeCareer = before.careers[career.id];
  const beforeWeeks = beforeCareer?.weeksInRole ?? Math.max(0, career.weeksInRole - (world.calendar.week - before.calendar.week));
  const seasons = Math.max(0, Math.floor(career.weeksInRole / 52) - Math.floor(beforeWeeks / 52));
  if (seasons <= 0) return;
  const age = playerAgeYears(world);
  const oldPay = career.weeklySalaryCents;
  if (career.performance >= 82) career.weeklySalaryCents = clampCents(Math.round(career.weeklySalaryCents * 1.14));
  else if (career.performance >= 68) career.weeklySalaryCents = clampCents(Math.round(career.weeklySalaryCents * 1.055));
  else if (career.performance < 48) career.weeklySalaryCents = clampCents(Math.round(career.weeklySalaryCents * 0.9));
  if (career.weeklySalaryCents !== oldPay) {
    recordHistory(world, 'career', 'The next sports contract changed', `After the season, your compensation moved from ${money(oldPay * 52)}/yr to ${money(career.weeklySalaryCents * 52)}/yr. Performance, age, health, and reputation now affect what the athletic career is worth instead of salary staying frozen forever.`, { subjectIds: [actor.id, career.id], importance: 3 });
  }
  if (age >= 34 && career.performance < 55) upsertPrivateMemory(world, 'Athletics · Contract pressure', [actor.id, career.id], `At age ${age}, performance around ${Math.round(career.performance)}/100 is making the next contract less certain. Retirement pressure is now financial as well as physical.`, 64, true);
}

export function applySystemPolishAdvance(before: WorldState, source: WorldState): WorldState {
  const weeks = Math.max(0, source.calendar.week - before.calendar.week);
  if (weeks <= 0) return source;
  const world = clone(source);
  const actor = world.characters[world.playerCharacterId];
  if (!actor?.isAlive) return world;
  processInvestmentIncome(before, world);
  processEducationBilling(before, world);
  processCareerReviews(before, world);
  processManagedLeasing(before, world);
  processDelegatedBusinessReports(before, world);
  processSportsContractReviews(before, world);
  return world;
}
