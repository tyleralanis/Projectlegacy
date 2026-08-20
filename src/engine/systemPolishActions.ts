import { competency, effectiveCareerCompetence } from './competencies';
import { allocateId } from './createWorld';
import { recordHistory } from './history';
import { clampCents } from './money';
import { nextRandom } from './random';
import type { ActionResult, IntentAction, WorldState } from './types';

import { WORLD_CONTENT } from '@/content/worldContent';

const POLISHED_EXISTING_VERBS = new Set([
  'markets.rebalance',
  'property.set_rent',
  'property.refinance',
  'career.seek_promotion',
  'career.request_raise',
  'education.sports_seek_scholarship',
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

function ok(world: WorldState, message: string): ActionResult {
  return { world, validation: { valid: true, requiresConfirmation: false }, message };
}

function blocked(source: WorldState, message: string): ActionResult {
  return { world: source, validation: { valid: false, reason: message, requiresConfirmation: false }, message };
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function currentCareer(world: WorldState) {
  const actor = world.characters[world.playerCharacterId];
  return Object.values(world.careers).find((career) => career.characterId === actor.id && career.active);
}

function ownedProperty(world: WorldState, targetIds: string[]) {
  const actor = world.characters[world.playerCharacterId];
  return targetIds.map((id) => world.properties[id]).find((property) => property?.ownerId === actor.id);
}

function managerRelationship(world: WorldState, managerId: string | undefined) {
  if (!managerId) return undefined;
  const actor = world.characters[world.playerCharacterId];
  return Object.values(world.relationships).find((relationship) => relationship.characterIds.includes(actor.id) && relationship.characterIds.includes(managerId));
}

function rebalance(source: WorldState): ActionResult {
  const actor = source.characters[source.playerCharacterId];
  const publicHoldings = Object.values(source.holdings).filter((holding) => holding.ownerId === actor.id && source.securities[holding.securityId]?.sector !== 'Private Markets');
  if (publicHoldings.length < 2) return blocked(source, 'You need at least two liquid public-market positions before rebalancing means anything.');

  const world = clone(source);
  const holdings = publicHoldings.map((holding) => world.holdings[holding.id]);
  const totalValue = holdings.reduce((sum, holding) => {
    const security = world.securities[holding.securityId];
    return sum + Math.round(holding.unitsMilli * security.priceCents / 1000);
  }, 0);
  if (totalValue <= 0) return blocked(source, 'There is no positive public-market value to rebalance.');

  const targetValue = Math.floor(totalValue / holdings.length);
  let availableCash = 0;
  let realizedGain = 0;

  // Sell overweight positions first. Cost basis is reduced proportionally so
  // rebalancing does not erase the portfolio's actual purchase history.
  for (const holding of holdings) {
    const security = world.securities[holding.securityId];
    const currentValue = Math.round(holding.unitsMilli * security.priceCents / 1000);
    if (currentValue <= targetValue || holding.unitsMilli <= 0) continue;
    const targetUnits = Math.max(0, Math.floor(targetValue * 1000 / security.priceCents));
    const unitsSold = Math.max(0, holding.unitsMilli - targetUnits);
    if (unitsSold <= 0) continue;
    const saleValue = Math.round(unitsSold * security.priceCents / 1000);
    const basisRemoved = Math.round(holding.costBasisCents * (unitsSold / holding.unitsMilli));
    holding.unitsMilli -= unitsSold;
    holding.costBasisCents = Math.max(0, holding.costBasisCents - basisRemoved);
    availableCash += saleValue;
    realizedGain += saleValue - basisRemoved;
  }

  // Reinvest the sale proceeds into underweight positions. Any tiny rounding
  // remainder returns to cash rather than disappearing.
  for (const holding of holdings) {
    const security = world.securities[holding.securityId];
    const currentValue = Math.round(holding.unitsMilli * security.priceCents / 1000);
    if (currentValue >= targetValue || availableCash <= 0) continue;
    const desired = Math.min(availableCash, targetValue - currentValue);
    const unitsBought = Math.floor(desired * 1000 / security.priceCents);
    if (unitsBought <= 0) continue;
    const cost = Math.round(unitsBought * security.priceCents / 1000);
    holding.unitsMilli += unitsBought;
    holding.costBasisCents += cost;
    availableCash -= cost;
  }

  if (availableCash > 0) actor.cashCents = clampCents(world.characters[actor.id].cashCents + availableCash);
  const nextActor = world.characters[actor.id];
  nextActor.cashCents = clampCents(nextActor.cashCents + 0);
  const memory = Object.values(world.memories).find((item) => item.category === 'Investing · Last rebalance' && item.participantIds.includes(actor.id));
  const narrative = `You rebalanced ${holdings.length} liquid public positions toward equal weight in week ${world.calendar.week}. Cost basis was preserved, private holdings were left untouched, and the rebalance realized ${money(realizedGain)} of gains/losses before reinvesting the proceeds.`;
  if (memory) {
    memory.narrative = narrative;
    memory.week = world.calendar.week;
    memory.importance = Math.max(memory.importance, 48);
  } else {
    const id = allocateId(world, 'memory');
    world.memories[id] = { id, participantIds: [actor.id], category: 'Investing · Last rebalance', week: world.calendar.week, valence: 0.1, importance: 48, permanent: false, unresolved: false, visibility: 'private', narrative };
  }
  recordHistory(world, 'markets', 'Portfolio rebalanced', narrative, { subjectIds: [actor.id], importance: 2 });
  return ok(world, `You rebalanced ${holdings.length} public positions without resetting their real cost basis. Private positions stayed illiquid and untouched.`);
}

function setRent(source: WorldState, action: IntentAction): ActionResult {
  const property = ownedProperty(source, action.targetIds);
  if (!property) return blocked(source, 'Choose a property you own.');
  const requested = action.parameters.weeklyRentCents;
  const nextRent = typeof requested === 'number' && Number.isFinite(requested) ? Math.max(0, Math.round(requested)) : property.weeklyRentCents;
  if (nextRent === property.weeklyRentCents) return blocked(source, 'The rent is already set to that amount.');

  const world = clone(source);
  const next = world.properties[property.id];
  const oldRent = next.weeklyRentCents;
  next.weeklyRentCents = nextRent;
  const change = oldRent > 0 ? (nextRent - oldRent) / oldRent : 0;
  const actor = world.characters[world.playerCharacterId];
  const tenantMemory = Object.values(world.memories).find((memory) => memory.category === `Property · Tenant · ${next.id}` && memory.unresolved);
  const tenantId = tenantMemory?.participantIds.find((id) => id !== actor.id && world.characters[id]);
  const relationship = tenantId ? Object.values(world.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(tenantId)) : undefined;
  const tenant = tenantId ? world.characters[tenantId] : undefined;

  if (relationship && tenant && change !== 0) {
    const managerBuffer = next.managed ? 0.72 : 1;
    if (change > 0) {
      relationship.resentment = clamp(relationship.resentment + change * 42 * managerBuffer);
      relationship.trust = clamp(relationship.trust - change * 18 * managerBuffer);
      relationship.respect = clamp(relationship.respect - Math.max(0, change - 0.08) * 12);
      relationship.lastInteractionWeek = world.calendar.week;
      const abilityToAbsorb = tenant.discipline * 0.3 + tenant.cashCents / Math.max(1, nextRent * 52) * 8 + relationship.trust * 0.25 + next.condition * 0.25 - relationship.resentment * 0.35;
      const moveRisk = clamp((change - 0.08) * 2.6 + Math.max(0, 55 - abilityToAbsorb) / 100, 0, 0.78);
      if (change >= 0.12 && roll(world) < moveRisk) {
        next.occupancy = 'vacant';
        tenantMemory!.unresolved = false;
        tenantMemory!.narrative = `${tenantMemory!.narrative} A later ${(change * 100).toFixed(0)}% rent increase pushed the relationship too far, and ${tenant.firstName} moved out.`;
        relationship.kind = 'acquaintance';
        recordHistory(world, 'property', `${tenant.firstName} left ${next.name}`, `A ${(change * 100).toFixed(0)}% rent increase produced a real vacancy instead of behaving like a free revenue button.`, { subjectIds: [actor.id, tenant.id, next.id], importance: 3 });
        return ok(world, `Rent moved to ${money(nextRent)}/week, but ${tenant.firstName} decided the increase was not worth staying for. The unit is vacant.`);
      }
    } else {
      const reduction = Math.abs(change);
      relationship.trust = clamp(relationship.trust + reduction * 18);
      relationship.respect = clamp(relationship.respect + reduction * 12);
      relationship.resentment = clamp(relationship.resentment - reduction * 30);
      relationship.lastInteractionWeek = world.calendar.week;
    }
  }

  recordHistory(world, 'property', `Rent changed at ${next.name}`, `Weekly rent moved from ${money(oldRent)} to ${money(nextRent)}. Tenant trust, resentment, and vacancy risk react to the size of the change rather than treating rent as a consequence-free slider.`, { subjectIds: [next.id], importance: Math.abs(change) >= 0.1 ? 2 : 1 });
  return ok(world, `Weekly rent is now ${money(nextRent)}.${relationship && change > 0 ? ' The tenant noticed the increase.' : relationship && change < 0 ? ' The tenant noticed the reduction.' : ''}`);
}

function refinance(source: WorldState, action: IntentAction): ActionResult {
  const property = ownedProperty(source, action.targetIds);
  if (!property) return blocked(source, 'Choose a property you own.');
  const equityRatio = property.valueCents > 0 ? 1 - property.debtCents / property.valueCents : 0;
  const conditionAdjustment = property.condition >= 85 ? 0.03 : property.condition < 45 ? -0.07 : property.condition < 60 ? -0.03 : 0;
  const leverageCeiling = clamp(0.7 + conditionAdjustment - Math.max(0, source.economy.policyRate - 0.07) * 0.55, 0.55, 0.75);
  const maximumDebt = Math.round(property.valueCents * leverageCeiling);
  const closingCost = Math.round(property.valueCents * (0.009 + source.economy.policyRate * 0.04));
  const proceeds = Math.max(0, maximumDebt - property.debtCents - closingCost);
  if (proceeds <= 0) return blocked(source, `There is not enough refinanceable equity at current rates and condition. Current equity is about ${(equityRatio * 100).toFixed(0)}%.`);

  const world = clone(source);
  const next = world.properties[property.id];
  const actor = world.characters[world.playerCharacterId];
  next.debtCents = maximumDebt;
  actor.cashCents = clampCents(actor.cashCents + proceeds);
  world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'property-refinance', amountCents: proceeds, fromId: next.id, toId: actor.id, memo: `Cash-out refinance of ${next.name}` });
  recordHistory(world, 'property', `${next.name} was refinanced`, `You borrowed up to ${(leverageCeiling * 100).toFixed(0)}% loan-to-value, paid about ${money(closingCost)} in modeled closing costs, and released ${money(proceeds)} of equity into cash. Higher leverage now increases weekly interest exposure.`, { subjectIds: [actor.id, next.id], importance: 3 });
  return ok(world, `${money(proceeds)} of equity came out of ${next.name}. Debt is now ${money(next.debtCents)}, so the property has less cushion if values fall.`);
}

function seekPromotion(source: WorldState): ActionResult {
  const actor = source.characters[source.playerCharacterId];
  const career = currentCareer(source);
  if (!career) return blocked(source, 'You need an active job before pushing for promotion.');
  if (career.weeksInRole < 26) return blocked(source, 'You have not been in the role long enough to make a credible promotion case.');

  const world = clone(source);
  const nextActor = world.characters[actor.id];
  const nextCareer = world.careers[career.id];
  const competence = effectiveCareerCompetence(world, nextCareer);
  const standing = nextCareer.organizationStanding ?? 48;
  const promotionCase = nextCareer.promotionProgress ?? 0;
  const managerRel = managerRelationship(world, nextCareer.managerId);
  const managerSupport = managerRel ? managerRel.respect * 0.55 + managerRel.trust * 0.35 - managerRel.resentment * 0.45 : 38;
  const score = clamp(nextCareer.performance * 0.28 + competence * 0.22 + standing * 0.18 + promotionCase * 0.14 + nextActor.reputation.professional * 0.1 + managerSupport * 0.08);
  const chance = clamp((score - 38) / 58, 0.06, 0.92);

  if (roll(world) > chance) {
    nextCareer.satisfaction = clamp(nextCareer.satisfaction - 2.5);
    nextCareer.promotionProgress = clamp(promotionCase + 3);
    if (managerRel) managerRel.resentment = clamp(managerRel.resentment + 1.5);
    recordHistory(world, 'career', 'The promotion case was declined', `The organization weighed performance, actual role competence, internal standing, sponsorship, reputation, and your existing promotion case. The answer was no, but making the case added clarity about what is missing.`, { subjectIds: [actor.id, career.id], importance: 2 });
    return ok(world, 'You pushed for promotion and did not get it. The attempt slightly improved the formal promotion case, but satisfaction took a hit.');
  }

  const oldTitle = nextCareer.title;
  const oldSalary = nextCareer.weeklySalaryCents;
  const nextLevel = Math.min(6, (nextCareer.level ?? 2) + 1);
  const baseTitle = oldTitle.replace(/^(Senior|Lead|Principal)\s+/i, '');
  nextCareer.title = nextLevel >= 6 ? `Director of ${nextCareer.department ?? baseTitle}` : nextLevel >= 5 ? `Principal ${baseTitle}` : nextLevel >= 4 ? `Lead ${baseTitle}` : `Senior ${baseTitle}`;
  const raise = nextLevel >= 5 ? 1.22 : 1.16;
  nextCareer.weeklySalaryCents = clampCents(Math.round(oldSalary * raise));
  nextCareer.level = nextLevel;
  nextCareer.hoursPerWeek = Math.min(50, Math.max(nextCareer.hoursPerWeek ?? 40, nextLevel >= 5 ? 46 : 42));
  nextCareer.promotionProgress = 10;
  nextCareer.organizationStanding = clamp(standing + 8);
  nextCareer.performance = clamp(nextCareer.performance - 3);
  nextCareer.satisfaction = clamp(nextCareer.satisfaction + 5);
  nextActor.stress = clamp(nextActor.stress + 2.5);
  nextActor.reputation.professional = clamp(nextActor.reputation.professional + 3);
  recordHistory(world, 'career', `Promoted to ${nextCareer.title}`, `The promotion came from a ${Math.round(score)}/100 case built from performance, competence, standing, sponsorship, and reputation. Pay rose from ${money(oldSalary * 52)}/yr to ${money(nextCareer.weeklySalaryCents * 52)}/yr, while responsibility and weekly time increased too.`, { important: true, subjectIds: [actor.id, career.id], importance: 4 });
  return ok(world, `You were promoted to ${nextCareer.title}. Pay rose, but the role now asks more of the week and your performance has to prove itself again at the higher level.`);
}

function requestRaise(source: WorldState): ActionResult {
  const actor = source.characters[source.playerCharacterId];
  const career = currentCareer(source);
  if (!career) return blocked(source, 'You need an active job before asking for more pay.');
  if (career.weeksInRole < 20) return blocked(source, 'You need a little more track record in the role before a raise request has much leverage.');

  const world = clone(source);
  const nextActor = world.characters[actor.id];
  const nextCareer = world.careers[career.id];
  const competence = effectiveCareerCompetence(world, nextCareer);
  const standing = nextCareer.organizationStanding ?? 48;
  const negotiation = competency(world, actor.id, 'negotiation');
  const managerRel = managerRelationship(world, nextCareer.managerId);
  const support = managerRel ? managerRel.respect * 0.5 + managerRel.trust * 0.3 - managerRel.resentment * 0.4 : 36;
  const score = clamp(nextCareer.performance * 0.3 + competence * 0.2 + standing * 0.18 + negotiation * 0.14 + nextActor.reputation.professional * 0.1 + support * 0.08);
  const chance = clamp((score - 42) / 55, 0.08, 0.9);
  if (roll(world) > chance) {
    nextCareer.satisfaction = clamp(nextCareer.satisfaction - 1.5);
    if (managerRel) managerRel.resentment = clamp(managerRel.resentment + 1);
    return ok(world, 'The raise request was declined. Your leverage was not strong enough to make the organization pay more right now.');
  }
  const oldPay = nextCareer.weeklySalaryCents;
  const increase = clamp(0.03 + (score - 55) / 350, 0.03, 0.13);
  nextCareer.weeklySalaryCents = clampCents(Math.round(oldPay * (1 + increase)));
  nextCareer.satisfaction = clamp(nextCareer.satisfaction + 3);
  nextCareer.organizationStanding = clamp(standing + 1);
  recordHistory(world, 'career', 'A raise was negotiated', `The organization approved a ${(increase * 100).toFixed(1)}% raise after weighing performance, competence, internal standing, negotiation skill, and management support.`, { subjectIds: [actor.id, career.id], importance: 2 });
  return ok(world, `Your pay moved from ${money(oldPay * 52)}/yr to ${money(nextCareer.weeklySalaryCents * 52)}/yr. The raise came from leverage, not a flat random chance.`);
}

function seekScholarship(source: WorldState): ActionResult {
  const actor = source.characters[source.playerCharacterId];
  const education = Object.values(source.education).find((record) => record.characterId === actor.id && ['higher', 'school'].includes(record.status));
  if (!education) return blocked(source, 'You need an active school or college athletic path before seeking scholarship support.');
  const athleticLevel = education.athleticLevel ?? competency(source, actor.id, 'athletics');
  const recognition = education.athleticRecognition ?? 0;
  if (athleticLevel < 62 || actor.fitness < 68) return blocked(source, 'Your athletic level and fitness are not strong enough for a serious scholarship push yet.');

  const world = clone(source);
  const nextActor = world.characters[actor.id];
  const nextEducation = world.education[education.id];
  const academics = competency(world, actor.id, 'academics');
  const score = clamp(athleticLevel * 0.34 + recognition * 0.24 + nextActor.fitness * 0.16 + nextActor.discipline * 0.12 + academics * 0.08 + nextActor.reputation.public * 0.06);
  const chance = clamp((score - 46) / 54, 0.08, 0.9);
  if (roll(world) > chance) {
    nextEducation.athleticRecognition = clamp((nextEducation.athleticRecognition ?? 0) + 2);
    return ok(world, 'You pushed for athletic aid and did not win funding this time. The attempt still increased recruiting visibility a little.');
  }

  const school = WORLD_CONTENT.universities.find((item) => item.id === nextEducation.institutionId);
  const annualTuition = Math.max(0, school?.tuitionCentsPerYear ?? nextEducation.tuitionCentsPerYear ?? 0);
  const share = score >= 88 ? 1 : score >= 78 ? 0.75 : score >= 68 ? 0.5 : 0.25;
  const award = Math.max(250_000, Math.round(annualTuition * share));
  nextEducation.scholarshipCents = Math.max(nextEducation.scholarshipCents ?? 0, award);
  const liability = Object.values(world.liabilities).find((item) => item.debtorId === nextActor.id && item.kind === 'student' && item.securedById === nextEducation.id);
  if (liability) liability.principalCents = Math.max(0, liability.principalCents - award);
  nextActor.reputation.public = clamp(nextActor.reputation.public + 3 + share * 3);
  nextEducation.athleticRecognition = clamp((nextEducation.athleticRecognition ?? 0) + 5);
  const existing = Object.values(world.memories).find((memory) => memory.category === 'Athletics · Scholarship' && memory.participantIds.includes(nextActor.id));
  const narrative = `Athletic performance earned ${money(award)} of recurring annual education support (${Math.round(share * 100)}% of current tuition). Keeping the scholarship now depends on remaining enrolled and maintaining the athletic path.`;
  if (existing) {
    existing.narrative = narrative;
    existing.week = world.calendar.week;
    existing.importance = Math.max(existing.importance, 74);
  } else {
    const id = allocateId(world, 'memory');
    world.memories[id] = { id, participantIds: [nextActor.id, nextEducation.id], category: 'Athletics · Scholarship', week: world.calendar.week, valence: 0.75, importance: 74, permanent: false, unresolved: false, visibility: 'shared', narrative };
  }
  recordHistory(world, 'education', 'Athletic scholarship awarded', narrative, { subjectIds: [nextActor.id, nextEducation.id], importance: 4 });
  return ok(world, `You earned ${money(award)} per year in athletic scholarship support. The current tuition balance was reduced too.`);
}

export function executeSystemPolishAction(source: WorldState, action: IntentAction): ActionResult | null {
  if (!POLISHED_EXISTING_VERBS.has(action.verb)) return null;
  if (action.verb === 'markets.rebalance') return rebalance(source);
  if (action.verb === 'property.set_rent') return setRent(source, action);
  if (action.verb === 'property.refinance') return refinance(source, action);
  if (action.verb === 'career.seek_promotion') return seekPromotion(source);
  if (action.verb === 'career.request_raise') return requestRaise(source);
  if (action.verb === 'education.sports_seek_scholarship') return seekScholarship(source);
  return null;
}
