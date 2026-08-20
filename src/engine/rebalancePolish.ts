import { allocateId } from './createWorld';
import { clampCents } from './money';
import { recordHistory } from './history';
import type { ActionResult, IntentAction, WorldState } from './types';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

export function executeRebalancePolish(source: WorldState, action: IntentAction): ActionResult | null {
  if (action.verb !== 'markets.rebalance') return null;
  const actor = source.characters[source.playerCharacterId];
  const publicHoldings = Object.values(source.holdings).filter((holding) => holding.ownerId === actor.id && source.securities[holding.securityId]?.sector !== 'Private Markets');
  if (publicHoldings.length < 2) return blocked(source, 'You need at least two liquid public-market positions before rebalancing means anything.');

  const world = clone(source);
  const nextActor = world.characters[actor.id];
  const holdings = publicHoldings.map((holding) => world.holdings[holding.id]);
  const totalValue = holdings.reduce((sum, holding) => {
    const security = world.securities[holding.securityId];
    return sum + Math.round(holding.unitsMilli * security.priceCents / 1000);
  }, 0);
  if (totalValue <= 0) return blocked(source, 'There is no positive public-market value to rebalance.');

  const targetValue = Math.floor(totalValue / holdings.length);
  let availableCash = 0;
  let realizedGain = 0;

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

  if (availableCash > 0) nextActor.cashCents = clampCents(nextActor.cashCents + availableCash);
  const narrative = `You rebalanced ${holdings.length} liquid public positions toward equal weight in week ${world.calendar.week}. Cost basis stayed attached to the actual lots, private holdings were left untouched, and the rebalance realized ${money(realizedGain)} before reinvesting sale proceeds.`;
  const existing = Object.values(world.memories).find((memory) => memory.category === 'Investing · Last rebalance' && memory.participantIds.includes(actor.id));
  if (existing) {
    existing.narrative = narrative;
    existing.week = world.calendar.week;
    existing.importance = Math.max(existing.importance, 48);
  } else {
    const id = allocateId(world, 'memory');
    world.memories[id] = { id, participantIds: [actor.id], category: 'Investing · Last rebalance', week: world.calendar.week, valence: 0.1, importance: 48, permanent: false, unresolved: false, visibility: 'private', narrative };
  }
  recordHistory(world, 'markets', 'Portfolio rebalanced', narrative, { subjectIds: [actor.id], importance: 2 });
  return ok(world, `You rebalanced ${holdings.length} public positions without resetting their real cost basis. Private positions stayed illiquid and untouched.`);
}
