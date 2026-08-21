import { allocateId } from './createWorld';
import { recordHistory } from './history';
import { nextRandom } from './random';
import type { ActionResult, Business, EducationState, IntentAction, WorldState } from './types';

import { WORLD_CONTENT } from '@/content/worldContent';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function blocked(source: WorldState, message: string): ActionResult {
  return { world: source, message, validation: { valid: false, reason: message, requiresConfirmation: false } };
}

function ok(world: WorldState, message: string): ActionResult {
  return { world, message, validation: { valid: true, requiresConfirmation: false } };
}

function actor(world: WorldState) {
  return world.characters[world.playerCharacterId];
}

function annualTuition(world: WorldState, educationId: string): number {
  const record = world.education[educationId];
  if (!record) return 0;
  return WORLD_CONTENT.universities.find((item) => item.id === record.institutionId)?.tuitionCentsPerYear
    ?? record.tuitionCentsPerYear;
}

function tuitionBill(world: WorldState, educationId: string) {
  const player = actor(world);
  return Object.values(world.liabilities).find((item) =>
    item.debtorId === player.id
    && item.kind === 'student'
    && item.securedById === educationId
    && item.annualRateBps === 0
    && item.weeklyPaymentCents === 0,
  );
}

function latestAthleticScholarshipMemory(world: WorldState) {
  const player = actor(world);
  return Object.values(world.memories)
    .filter((memory) => memory.participantIds.includes(player.id) && memory.category === 'Athletics · Scholarship')
    .sort((left, right) => right.week - left.week)[0];
}

function scholarshipFromMemory(world: WorldState): number {
  const narrative = latestAthleticScholarshipMemory(world)?.narrative;
  if (!narrative) return 0;
  const match = narrative.match(/\$([\d,]+(?:\.\d{1,2})?)/);
  if (!match?.[1]) return 0;
  const dollars = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(dollars) ? Math.max(0, Math.round(dollars * 100)) : 0;
}

function postsecondaryRecords(world: WorldState): EducationState[] {
  const player = actor(world);
  return Object.values(world.education).filter((record) =>
    record.characterId === player.id && ['accepted', 'higher', 'trade'].includes(record.status),
  );
}

function recurringScholarshipCents(world: WorldState): number {
  const recorded = Object.values(world.education)
    .filter((record) => record.characterId === world.playerCharacterId)
    .reduce((maximum, record) => Math.max(maximum, record.scholarshipCents ?? 0), 0);
  return Math.max(recorded, scholarshipFromMemory(world));
}

function migrateRecurringScholarship(world: WorldState): void {
  const scholarship = recurringScholarshipCents(world);
  if (scholarship <= 0) return;
  for (const record of postsecondaryRecords(world)) {
    record.scholarshipCents = Math.max(record.scholarshipCents ?? 0, scholarship);
    if (!['higher', 'trade'].includes(record.status)) continue;
    const bill = tuitionBill(world, record.id);
    if (!bill || bill.principalCents <= 0) continue;

    // Older builds sometimes reduced the balance immediately but failed to store
    // the recurring award. Only close the gap down to the expected net first-year
    // bill so loading an existing save cannot apply the same scholarship twice.
    const fullAnnual = annualTuition(world, record.id);
    const expectedNet = Math.max(0, fullAnnual - record.scholarshipCents);
    if (bill.principalCents <= fullAnnual && bill.principalCents > expectedNet) {
      bill.principalCents = expectedNet;
    }
  }
}

function businessFoundedWeek(world: WorldState, business: Business): number | undefined {
  const normalizedName = business.name.toLowerCase();
  const timelineWeeks = world.timeline
    .filter((entry) => entry.category === 'business')
    .filter((entry) => {
      const text = `${entry.title} ${entry.detail}`.toLowerCase();
      return text.includes(normalizedName) && /(start a business|founded|now operating|started)/.test(text);
    })
    .map((entry) => entry.week);
  const feedWeeks = world.feed
    .filter((entry) => entry.domain === 'business')
    .filter((entry) => {
      const text = `${entry.title} ${entry.detail}`.toLowerCase();
      return text.includes(normalizedName) && /(start a business|founded|now operating|started)/.test(text);
    })
    .map((entry) => entry.week);
  const weeks = [...timelineWeeks, ...feedWeeks];
  return weeks.length > 0 ? Math.min(...weeks) : undefined;
}

/**
 * Very young companies do not get to capitalize a few good weeks as though a
 * durable earnings history already exists. Assets matter immediately; operating
 * multiples earn credibility gradually over roughly the first year.
 */
export function credibleBusinessValuationCents(world: WorldState, business: Business): number {
  const foundedWeek = businessFoundedWeek(world, business);
  if (foundedWeek === undefined) return Math.max(0, business.valuationCents);

  const ageWeeks = Math.max(0, world.calendar.week - foundedWeek);
  const netBusinessCash = Math.max(0, business.cashCents - business.debtCents);
  const weeklyProfit = Math.max(0, business.revenueWeeklyCents - business.costWeeklyCents);
  const revenueEnterpriseValue = Math.max(0, Math.round(business.revenueWeeklyCents * 52 * 0.55));
  const profitEnterpriseValue = Math.max(0, Math.round(weeklyProfit * 52 * 4));
  const operatingEquityValue = Math.max(0, Math.max(revenueEnterpriseValue, profitEnterpriseValue) - business.debtCents);
  const matureValue = Math.max(netBusinessCash, operatingEquityValue);
  const credibility = clamp((ageWeeks + 2) / 52, 0.04, 1);
  const credibleValue = Math.round(netBusinessCash + Math.max(0, matureValue - netBusinessCash) * credibility);

  // This is a guardrail, not a free appraisal bump. A company can be worth less
  // than the model above, but it cannot instantly jump above what its short track
  // record can credibly support.
  return Math.max(0, Math.min(business.valuationCents, Math.max(netBusinessCash, credibleValue)));
}

function normalizeBusinessValuations(world: WorldState): void {
  for (const business of Object.values(world.businesses)) {
    if (!business.active) continue;
    business.valuationCents = credibleBusinessValuationCents(world, business);
  }
}

function addTransaction(
  world: WorldState,
  kind: string,
  amountCents: number,
  memo: string,
  fromId?: string,
  toId?: string,
): void {
  world.transactions.push({
    id: allocateId(world, 'transaction'),
    week: world.calendar.week,
    kind,
    amountCents,
    fromId,
    toId,
    memo,
  });
  if (world.transactions.length > 1_200) world.transactions.splice(0, world.transactions.length - 1_200);
}

function activeSecondarySchool(world: WorldState): EducationState | undefined {
  const player = actor(world);
  return Object.values(world.education).find((record) => record.characterId === player.id && record.status === 'school');
}

function addStudentLoan(world: WorldState, education: EducationState, principalCents: number): void {
  if (principalCents <= 0) return;
  const player = actor(world);
  const id = allocateId(world, 'liability');
  const rateBps = Math.round(clamp((world.economy.policyRate + 0.035) * 10_000, 350, 1_800));
  world.liabilities[id] = {
    id,
    debtorId: player.id,
    kind: 'student',
    principalCents,
    annualRateBps: rateBps,
    weeklyPaymentCents: 0,
  };
  addTransaction(world, 'education-financing', principalCents, `Student-loan funding for ${education.level}`, 'student-lender', education.institutionId);
}

function fundingMemory(world: WorldState, educationId: string): string | undefined {
  return Object.values(world.memories).find((memory) => memory.category === `Education · Funding · ${educationId}`)?.narrative;
}

function rememberFunding(world: WorldState, educationId: string, mode: string): void {
  const player = actor(world);
  const existing = Object.values(world.memories).find((memory) => memory.category === `Education · Funding · ${educationId}`);
  if (existing) {
    existing.narrative = mode;
    existing.week = world.calendar.week;
    return;
  }
  const id = allocateId(world, 'memory');
  world.memories[id] = {
    id,
    participantIds: [player.id, educationId],
    category: `Education · Funding · ${educationId}`,
    week: world.calendar.week,
    valence: 0,
    importance: 58,
    permanent: false,
    unresolved: false,
    visibility: 'private',
    narrative: mode,
  };
}

function executeEnrollment(source: WorldState, action: IntentAction): ActionResult {
  const player = actor(source);
  const accepted = action.targetIds
    .map((id) => source.education[id])
    .find((record) => record?.characterId === player.id && record.status === 'accepted');
  if (!accepted) return blocked(source, 'Choose an accepted school offer first.');

  const scholarship = Math.max(accepted.scholarshipCents ?? 0, recurringScholarshipCents(source));
  const tuition = annualTuition(source, accepted.id);
  const netTuition = Math.max(0, tuition - scholarship);
  const funding = typeof action.parameters.funding === 'string' ? action.parameters.funding : netTuition <= 0 ? 'scholarship' : '';

  if (netTuition > 0 && !['cash', 'student-loan'].includes(funding)) {
    return blocked(source, `Arrange financing before enrollment. ${money(netTuition)} remains after recurring aid; use liquid cash, a student loan, or raise cash first through family help, work, or another source.`);
  }
  if (funding === 'cash' && player.cashCents < netTuition) {
    return blocked(source, `You need ${money(netTuition)} in liquid cash to fund the first academic year after scholarships.`);
  }

  const world = clone(source);
  migrateRecurringScholarship(world);
  const nextPlayer = actor(world);
  const nextRecord = world.education[accepted.id];
  nextRecord.scholarshipCents = Math.max(nextRecord.scholarshipCents ?? 0, scholarship);
  nextRecord.status = nextRecord.level.toLowerCase().includes('trade') ? 'trade' : 'higher';
  nextRecord.startedWeek = world.calendar.week;
  nextRecord.tuitionCentsPerYear = 0;

  if (funding === 'cash' && netTuition > 0) {
    nextPlayer.cashCents -= netTuition;
    addTransaction(world, 'tuition-funded', -netTuition, `First academic year at ${nextRecord.level}`, nextPlayer.id, nextRecord.institutionId);
  } else if (funding === 'student-loan' && netTuition > 0) {
    addStudentLoan(world, nextRecord, netTuition);
  }

  rememberFunding(world, nextRecord.id, funding || 'scholarship');
  nextPlayer.focuses = ['Academics', ...nextPlayer.focuses.filter((item) => item !== 'Academics')].slice(0, 3);
  const secondary = activeSecondarySchool(world);
  const schoolName = WORLD_CONTENT.universities.find((item) => item.id === nextRecord.institutionId)?.name ?? 'school';
  const loadCopy = secondary
    ? 'Because secondary school is still active, college begins as part-time dual enrollment. It becomes a normal full-time path after secondary graduation.'
    : 'Secondary school is complete, so this begins as a normal full-time postsecondary path.';
  const fundingCopy = netTuition <= 0
    ? `Recurring aid covers the ${money(tuition)} first-year tuition.`
    : funding === 'cash'
      ? `${money(netTuition)} was paid from liquid cash after ${money(scholarship)} in recurring aid.`
      : `${money(netTuition)} was financed with student debt after ${money(scholarship)} in recurring aid.`;
  recordHistory(world, 'education', `Enrolled at ${schoolName}`, `${fundingCopy} ${loadCopy}`, { important: true, subjectIds: [nextPlayer.id, nextRecord.id] });
  return ok(world, `Enrollment is active. ${fundingCopy} ${secondary ? 'College is part-time while you are still in secondary school.' : ''}`.trim());
}

function scholarshipTarget(source: WorldState, action: IntentAction): EducationState | undefined {
  const player = actor(source);
  return action.targetIds
    .map((id) => source.education[id])
    .find((record) => record?.characterId === player.id && ['accepted', 'higher', 'trade', 'school'].includes(record.status))
    ?? postsecondaryRecords(source)[0]
    ?? Object.values(source.education).find((record) => record.characterId === player.id && record.status === 'school');
}

function executeAthleticScholarship(source: WorldState, action: IntentAction): ActionResult {
  const education = scholarshipTarget(source, action);
  if (!education) return blocked(source, 'You need an active school or accepted college path before pursuing athletic aid.');
  const player = actor(source);
  if (player.fitness < 68 && (education.athleticLevel ?? 0) < 60) {
    return blocked(source, 'Your current fitness and athletic profile are not strong enough for a serious scholarship push yet.');
  }

  const world = clone(source);
  const next = world.education[education.id];
  const nextPlayer = actor(world);
  const profile = clamp(
    (next.athleticLevel ?? nextPlayer.fitness) * 0.25
      + (next.athleticRecognition ?? 0) * 0.2
      + nextPlayer.fitness * 0.2
      + nextPlayer.discipline * 0.15
      + next.recordedGrade * 0.1
      + nextPlayer.reputation.public * 0.1,
    0,
    100,
  );
  const chance = clamp(0.14 + profile / 145, 0.16, 0.88);
  const random = nextRandom(world.rngState);
  world.rngState = random.state;
  if (random.value > chance) {
    nextPlayer.reputation.public = clamp(nextPlayer.reputation.public + 1, 0, 100);
    return ok(world, 'You pushed for athletic aid, but the current profile did not win funding. The attempt still added visibility.');
  }

  const award = profile >= 86 ? 1_500_000 : profile >= 78 ? 1_000_000 : profile >= 70 ? 500_000 : 250_000;
  const previous = next.scholarshipCents ?? 0;
  const recurringAward = Math.max(previous, award);
  next.scholarshipCents = recurringAward;
  nextPlayer.reputation.public = clamp(nextPlayer.reputation.public + 4, 0, 100);

  // An award earned before enrollment is committed aid, not cash and not a
  // retroactive payment. If a legacy unpaid current-year bill exists, only bring
  // that bill down to the expected net amount without double-applying old aid.
  if (['higher', 'trade'].includes(next.status)) {
    const bill = tuitionBill(world, next.id);
    if (bill) {
      const fullAnnual = annualTuition(world, next.id);
      const expectedNet = Math.max(0, fullAnnual - recurringAward);
      if (bill.principalCents <= fullAnnual && bill.principalCents > expectedNet) bill.principalCents = expectedNet;
    }
  }

  const memory = latestAthleticScholarshipMemory(world);
  const narrative = `Athletic performance earned ${money(recurringAward)} per year in recurring education support.`;
  if (memory) {
    memory.narrative = narrative;
    memory.week = world.calendar.week;
    memory.importance = Math.max(memory.importance, 72);
  } else {
    const id = allocateId(world, 'memory');
    world.memories[id] = {
      id,
      participantIds: [nextPlayer.id, next.id],
      category: 'Athletics · Scholarship',
      week: world.calendar.week,
      valence: 0.7,
      importance: 72,
      permanent: false,
      unresolved: false,
      visibility: 'shared',
      narrative,
    };
  }
  recordHistory(world, 'education', 'Athletic scholarship awarded', `${money(recurringAward)} per year is now committed aid. It will reduce tuition when an eligible academic year is funded; it is not spendable cash.`, { subjectIds: [nextPlayer.id, next.id], importance: 3 });
  return ok(world, `You earned ${money(recurringAward)} per year in athletic scholarship support.`);
}

function executePrincipalPayment(source: WorldState, action: IntentAction): ActionResult {
  const player = actor(source);
  const property = action.targetIds.map((id) => source.properties[id]).find((item) => item?.ownerId === player.id);
  if (!property) return blocked(source, 'Choose a property you own.');
  if (property.debtCents <= 0) return blocked(source, `${property.name} is already debt-free.`);
  const requested = typeof action.parameters.amountCents === 'number' && Number.isFinite(action.parameters.amountCents)
    ? Math.max(0, Math.round(action.parameters.amountCents))
    : property.debtCents;
  const payment = Math.min(requested, property.debtCents, Math.max(0, player.cashCents));
  if (payment <= 0) return blocked(source, 'Choose a positive principal payment that fits your available liquid cash.');

  const world = clone(source);
  const nextPlayer = actor(world);
  const nextProperty = world.properties[property.id];
  nextPlayer.cashCents -= payment;
  nextProperty.debtCents -= payment;
  const mortgage = Object.values(world.liabilities).find((item) => item.debtorId === nextPlayer.id && item.kind === 'mortgage' && item.securedById === nextProperty.id);
  if (mortgage) mortgage.principalCents = Math.max(0, mortgage.principalCents - payment);
  addTransaction(world, 'mortgage-principal', -payment, `Principal payment on ${nextProperty.name}`, nextPlayer.id, nextProperty.id);
  const paidOff = nextProperty.debtCents <= 0;
  recordHistory(world, 'property', paidOff ? `${nextProperty.name} paid off` : `Extra principal paid on ${nextProperty.name}`, paidOff ? `${money(payment)} cleared the remaining property debt.` : `${money(payment)} reduced principal. ${money(nextProperty.debtCents)} remains.`, { subjectIds: [nextProperty.id], importance: paidOff ? 3 : 1 });
  return ok(world, paidOff ? `${nextProperty.name} is paid off.` : `${money(payment)} went directly to principal. ${money(nextProperty.debtCents)} remains.`);
}

function executeBusinessSale(source: WorldState, action: IntentAction, confirmed: boolean): ActionResult {
  const player = actor(source);
  const business = action.targetIds
    .map((id) => source.businesses[id])
    .find((item) => item?.active && (item.ownerId ?? item.founderId) === player.id && item.playerOwnershipBps > 0);
  if (!business) return blocked(source, 'Choose an active business you still own.');
  const valuation = credibleBusinessValuationCents(source, business);
  const proceeds = Math.round(valuation * business.playerOwnershipBps / 10_000 * 0.94);
  if (!confirmed) {
    return {
      world: source,
      message: `Selling now is estimated to produce ${money(proceeds)} after transaction costs. Young companies are valued from assets and the operating history they have actually earned, not a few annualized weeks.`,
      validation: { valid: true, requiresConfirmation: true },
    };
  }

  const world = clone(source);
  const nextPlayer = actor(world);
  const nextBusiness = world.businesses[business.id];
  nextBusiness.valuationCents = valuation;
  nextPlayer.cashCents += proceeds;
  nextBusiness.playerOwnershipBps = 0;
  nextBusiness.votingControlBps = 0;
  addTransaction(world, 'business-sale', proceeds, `Sale of ${nextBusiness.name}`, nextBusiness.id, nextPlayer.id);
  recordHistory(world, 'business', `${nextBusiness.name} sold`, `${money(proceeds)} reached personal liquidity after the sale and modeled transaction costs. The valuation reflected the company's actual operating track record.`, { important: true, subjectIds: [nextBusiness.id, nextPlayer.id], importance: 4 });
  return ok(world, `You sold your interest in ${nextBusiness.name} for ${money(proceeds)} after transaction costs.`);
}

function addAnnualTuitionBill(world: WorldState, education: EducationState, amountCents: number): void {
  if (amountCents <= 0) return;
  const player = actor(world);
  const existing = tuitionBill(world, education.id);
  if (existing) {
    existing.principalCents += amountCents;
    return;
  }
  const id = allocateId(world, 'liability');
  world.liabilities[id] = {
    id,
    debtorId: player.id,
    kind: 'student',
    principalCents: amountCents,
    annualRateBps: 0,
    weeklyPaymentCents: 0,
    securedById: education.id,
  };
}

function processAcademicYearFunding(before: WorldState, world: WorldState): void {
  if (world.calendar.week <= before.calendar.week) return;
  const player = actor(world);
  for (const education of Object.values(world.education)) {
    if (education.characterId !== player.id || !['higher', 'trade'].includes(education.status) || education.startedWeek === undefined) continue;
    const beforeYear = Math.max(0, Math.floor((before.calendar.week - education.startedWeek) / 52));
    const afterYear = Math.max(0, Math.floor((world.calendar.week - education.startedWeek) / 52));
    const crossedYears = Math.max(0, afterYear - beforeYear);
    if (crossedYears <= 0) continue;

    const scholarship = education.scholarshipCents ?? 0;
    const netAnnual = Math.max(0, annualTuition(world, education.id) - scholarship);
    const priorMode = fundingMemory(world, education.id);
    for (let index = 0; index < crossedYears; index += 1) {
      if (netAnnual <= 0) continue;
      if (priorMode === 'student-loan') addStudentLoan(world, education, netAnnual);
      else addAnnualTuitionBill(world, education, netAnnual);
    }
    if (netAnnual > 0) {
      recordHistory(world, 'education', 'A new academic year was funded', priorMode === 'student-loan'
        ? `${money(scholarship)} in recurring aid reduced sticker tuition. The remaining ${money(netAnnual)} was financed under the existing student-loan plan.`
        : `${money(scholarship)} in recurring aid reduced sticker tuition. ${money(netAnnual)} is due for the new academic year and can be paid from available cash.`, { subjectIds: [education.id], importance: 2 });
    }
  }
}

export function normalizeFinanceEducationState(source: WorldState): WorldState {
  const world = clone(source);
  migrateRecurringScholarship(world);
  normalizeBusinessValuations(world);
  return world;
}

export function applyFinanceEducationAdvance(before: WorldState, source: WorldState): WorldState {
  const world = clone(source);
  migrateRecurringScholarship(world);
  processAcademicYearFunding(before, world);
  normalizeBusinessValuations(world);
  return world;
}

export function executeFinanceEducationPolish(source: WorldState, action: IntentAction, confirmed = false): ActionResult | null {
  if (action.verb === 'education.enroll') return executeEnrollment(source, action);
  if (action.verb === 'education.sports_seek_scholarship') return executeAthleticScholarship(source, action);
  if (action.verb === 'property.pay_principal') return executePrincipalPayment(source, action);
  if (action.verb === 'business.sell') return executeBusinessSale(source, action, confirmed);
  return null;
}
