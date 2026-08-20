import { allocateId } from './createWorld';
import type { ActionResult, IntentAction, MemoryRecord, WorldState } from './types';

const PLURAL_PARTNER_VERBS = new Set([
  'relationship.date_night',
  'relationship.weekend_away',
  'relationship.plan_future',
  'relationship.separate',
]);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function ok(world: WorldState, message: string): ActionResult {
  return { world, validation: { valid: true, requiresConfirmation: false }, message };
}

function blocked(source: WorldState, message: string): ActionResult {
  return { world: source, validation: { valid: false, reason: message, requiresConfirmation: false }, message };
}

function amount(action: IntentAction, fallback: number): number {
  const value = action.parameters.amountCents;
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function addMemory(world: WorldState, participantIds: string[], category: string, narrative: string, importance: number, valence: number, unresolved = false): MemoryRecord {
  const id = allocateId(world, 'memory');
  const memory: MemoryRecord = {
    id,
    participantIds,
    category,
    week: world.calendar.week,
    valence,
    importance,
    permanent: importance >= 70,
    unresolved,
    visibility: 'shared',
    narrative,
  };
  world.memories[id] = memory;
  return memory;
}

function addTransaction(world: WorldState, amountCents: number, memo: string, actorId: string, targetId: string): void {
  world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'relationship-experience', amountCents, fromId: actorId, toId: targetId, memo });
}

/**
 * The base character model still has one partnerId for legacy compatibility. Additional
 * consensual spouses therefore live in the relationship graph. This adapter makes those
 * spouse relationships fully interactive without overwriting or accidentally separating
 * the primary partner pointer.
 */
export function executePluralRelationshipDepth(source: WorldState, action: IntentAction, confirmed = false): ActionResult | null {
  if (!PLURAL_PARTNER_VERBS.has(action.verb)) return null;
  const actor = source.characters[source.playerCharacterId];
  const target = source.characters[action.targetIds[0]];
  if (!actor?.isAlive || !target?.isAlive || actor.id === target.id) return null;
  const relationship = Object.values(source.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(target.id));
  if (!relationship || relationship.kind !== 'spouse') return null;

  // Let the legacy/core relationship path continue to own the primary spouse.
  if (actor.partnerId === target.id) return null;

  const actorAge = Math.max(0, Math.floor((source.calendar.week - actor.birthWeek) / 52));
  const targetAge = Math.max(0, Math.floor((source.calendar.week - target.birthWeek) / 52));

  if (action.verb === 'relationship.separate') {
    if (!confirmed) return { world: source, validation: { valid: true, requiresConfirmation: true }, message: `End the additional spouse relationship with ${target.firstName}?` };
    const world = clone(source);
    const nextRelationship = world.relationships[relationship.id];
    const nextTarget = world.characters[target.id];
    nextRelationship.kind = nextRelationship.resentment > 60 ? 'rival' : 'friend';
    nextRelationship.affection = clamp(nextRelationship.affection - 24);
    nextRelationship.trust = clamp(nextRelationship.trust - 18);
    nextRelationship.resentment = clamp(nextRelationship.resentment + 20);
    nextRelationship.lastInteractionWeek = world.calendar.week;
    if (nextTarget.partnerId === actor.id) delete nextTarget.partnerId;
    addMemory(world, [actor.id, target.id], 'separation', `${actor.firstName} and ${target.firstName} ended their additional spouse relationship. Other marriages and the movement continue independently.`, 84, -70, true);
    const innerCircle = Object.values(world.organizations).find((organization) => organization.leaderId === actor.id && organization.history.some((entry) => entry.startsWith('inner-circle:archetype:')));
    if (innerCircle) innerCircle.history.push(`Plural spouse relationship ended:${target.id}:week:${world.calendar.week}`);
    return ok(world, `You and ${target.firstName} separated. Your other spouse relationships were not changed.`);
  }

  if (action.verb === 'relationship.weekend_away' && (actorAge < 18 || targetAge < 18)) return blocked(source, 'A weekend away is limited to adult spouses.');
  if (actorAge < 16 || targetAge < 16) return blocked(source, 'Both people need to be old enough for dating activities.');

  if (action.verb === 'relationship.plan_future') {
    const world = clone(source);
    const nextRelationship = world.relationships[relationship.id];
    nextRelationship.trust = clamp(nextRelationship.trust + 4);
    nextRelationship.affection = clamp(nextRelationship.affection + 3);
    nextRelationship.lastInteractionWeek = world.calendar.week;
    addMemory(world, [actor.id, target.id], 'Promise · Future', `You and ${target.firstName} talked seriously about what this marriage is supposed to become inside a household with more than one spouse. Expectations about time, attention, family, and the future are now part of the relationship.`, 76, 0.5, true);
    return ok(world, `You and ${target.firstName} made expectations explicit. The game will remember that this marriage has its own future, not merely a place in the movement.`);
  }

  const cost = amount(action, action.verb === 'relationship.weekend_away' ? 95_000 : 12_000);
  if (actor.cashCents < cost) return blocked(source, `You need ${money(cost)} in cash for that plan.`);
  const world = clone(source);
  const nextActor = world.characters[actor.id];
  const nextTarget = world.characters[target.id];
  const nextRelationship = world.relationships[relationship.id];
  nextActor.cashCents -= cost;
  addTransaction(world, -cost, `${action.verb === 'relationship.weekend_away' ? 'Weekend away' : 'Date night'} with ${target.firstName}`, actor.id, target.id);
  const scale = action.verb === 'relationship.weekend_away' ? 1.55 : 1;
  nextRelationship.affection = clamp(nextRelationship.affection + 6 * scale);
  nextRelationship.trust = clamp(nextRelationship.trust + 3 * scale);
  nextRelationship.resentment = clamp(nextRelationship.resentment - 3.5 * scale);
  nextRelationship.lastInteractionWeek = world.calendar.week;
  nextActor.mood = clamp(nextActor.mood + 3 * scale);
  nextActor.stress = clamp(nextActor.stress - 2.5 * scale);
  nextTarget.mood = clamp(nextTarget.mood + 3 * scale);
  addMemory(
    world,
    [actor.id, target.id],
    action.verb === 'relationship.weekend_away' ? 'Relationship · Trip together' : 'Relationship · Date night',
    action.verb === 'relationship.weekend_away'
      ? `You and ${target.firstName} got away from the movement and the rest of the household long enough for this marriage to have a story of its own.`
      : `You and ${target.firstName} protected an evening for this marriage instead of treating plural household life as automatic intimacy.`,
    action.verb === 'relationship.weekend_away' ? 76 : 52,
    0.8,
  );
  return ok(world, `${action.verb === 'relationship.weekend_away' ? 'The weekend away' : 'Date night'} with ${target.firstName} strengthened that marriage without changing your other spouse relationships.`);
}
