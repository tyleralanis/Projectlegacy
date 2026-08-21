import { allocateId, playerAgeYears } from './createWorld';
import { recordHistory } from './history';
import { renovationOptionsForProperty } from './propertyRenovations';
import type { ActionResult, IntentAction, PropertyAsset, WorldState } from './types';

const PROPERTY_VERBS = new Set(['property.buy', 'property.renovate']);
const PROPERTY_KINDS: PropertyAsset['kind'][] = ['residence', 'condo', 'single-family', 'multifamily', 'commercial', 'land', 'development', 'estate'];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function blocked(source: WorldState, message: string): ActionResult {
  return { world: source, validation: { valid: false, reason: message, requiresConfirmation: false }, message };
}

function ok(world: WorldState, message: string): ActionResult {
  return { world, validation: { valid: true, requiresConfirmation: false }, message };
}

function numberParameter(action: IntentAction, key: string, fallback = 0): number {
  const value = action.parameters[key];
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
}

function ownedProperty(world: WorldState, targetIds: string[]) {
  return targetIds.map((id) => world.properties[id]).find((property) => property?.ownerId === world.playerCharacterId);
}

export function executePropertyPolishAction(source: WorldState, action: IntentAction): ActionResult | null {
  if (!PROPERTY_VERBS.has(action.verb)) return null;
  if (playerAgeYears(source) < 18) return blocked(source, 'Property ownership opens at 18.');
  const actor = source.characters[source.playerCharacterId];

  if (action.verb === 'property.buy') {
    const valueCents = Math.max(8_000_000, numberParameter(action, 'valueCents', 32_000_000));
    const downPaymentCents = Math.round(valueCents * 0.2);
    if (actor.cashCents < downPaymentCents) return blocked(source, 'You do not have enough cash for the down payment.');

    const requestedKind = action.parameters.kind;
    const kind = typeof requestedKind === 'string' && PROPERTY_KINDS.includes(requestedKind as PropertyAsset['kind'])
      ? requestedKind as PropertyAsset['kind']
      : 'single-family';
    const name = typeof action.parameters.name === 'string' && action.parameters.name.trim() ? action.parameters.name.trim().slice(0, 80) : 'New property';
    const cityId = typeof action.parameters.cityId === 'string' ? action.parameters.cityId : actor.cityId;
    const weeklyRentCents = Math.max(0, numberParameter(action, 'weeklyRentCents', Math.round(valueCents * 0.0009)));
    const condition = Math.max(10, Math.min(100, numberParameter(action, 'condition', 72)));

    const world = clone(source);
    const nextActor = world.characters[world.playerCharacterId];
    nextActor.cashCents -= downPaymentCents;
    const id = allocateId(world, 'property');
    world.properties[id] = {
      id,
      name,
      kind,
      cityId,
      ownerId: nextActor.id,
      valueCents,
      debtCents: valueCents - downPaymentCents,
      condition,
      occupancy: 'vacant',
      weeklyRentCents,
      weeklyCostsCents: Math.round(valueCents * 0.00024),
      managed: false,
    };
    world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'property-purchase', amountCents: -downPaymentCents, fromId: nextActor.id, toId: id, memo: `Down payment on ${name}` });
    recordHistory(world, 'property', `${name} purchased`, `Bought for ${(valueCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}.`, { subjectIds: [nextActor.id, id], importance: 3 });
    return ok(world, `You bought ${name}.`);
  }

  const property = ownedProperty(source, action.targetIds);
  if (!property) return blocked(source, 'Choose a property you own.');
  const renovationId = typeof action.parameters.renovationId === 'string' ? action.parameters.renovationId : '';
  const option = renovationOptionsForProperty(property, source).find((item) => item.id === renovationId);
  if (!option) return blocked(source, 'That improvement is not currently available for this property.');
  if (actor.cashCents < option.costCents) return blocked(source, `You need ${(option.costCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} in cash.`);

  const world = clone(source);
  const nextActor = world.characters[world.playerCharacterId];
  const next = world.properties[property.id];
  nextActor.cashCents -= option.costCents;
  next.condition = Math.min(100, next.condition + option.conditionGain);
  next.valueCents += Math.round(option.costCents * option.valueReturnBps / 10_000);
  world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'property-renovation', amountCents: -option.costCents, fromId: nextActor.id, toId: next.id, memo: `${option.label} at ${next.name}` });

  const improvementMemoryId = allocateId(world, 'memory');
  world.memories[improvementMemoryId] = {
    id: improvementMemoryId,
    participantIds: [nextActor.id, next.id],
    category: `Property · Improvement · ${next.id} · ${option.id}`,
    week: world.calendar.week,
    valence: 0.45,
    importance: 45,
    permanent: true,
    unresolved: false,
    visibility: 'private',
    narrative: `${option.label} completed at ${next.name}.`,
  };

  recordHistory(world, 'property', option.label, `${next.name}: ${option.detail}`, { subjectIds: [nextActor.id, next.id], importance: 2 });
  return ok(world, `${option.label} completed at ${next.name}.`);
}
