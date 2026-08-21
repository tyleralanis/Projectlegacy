import { luxuryItem } from '@/content/luxuryCatalog';

import { allocateId, playerAgeYears } from './createWorld';
import { recordHistory } from './history';
import { clampCents } from './money';
import type { ActionResult, IntentAction, LicenseKind, WorldState } from './types';

const LIFESTYLE_VERBS = new Set([
  'license.start_driver_training',
  'license.start_pilot_training',
  'luxury.buy_asset',
  'luxury.hire_pilot',
  'luxury.sell_asset',
  'charity.donate',
]);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function blocked(source: WorldState, message: string): ActionResult {
  return { world: source, validation: { valid: false, reason: message, requiresConfirmation: false }, message };
}

function ok(world: WorldState, message: string): ActionResult {
  return { world, validation: { valid: true, requiresConfirmation: false }, message };
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function normalizeWealthLifestyleState(source: WorldState): WorldState {
  if (source.personalAssets && source.licenses) return source;
  const world = clone(source);
  world.personalAssets ??= {};
  world.licenses ??= {};
  return world;
}

export function licenseFor(world: WorldState, kind: LicenseKind) {
  return Object.values(world.licenses ?? {}).find((license) => license.characterId === world.playerCharacterId && license.kind === kind);
}

export function hasActiveLicense(world: WorldState, kind: LicenseKind): boolean {
  return licenseFor(world, kind)?.status === 'active';
}

function startLicenseTraining(source: WorldState, kind: LicenseKind): ActionResult {
  const age = playerAgeYears(source);
  const minimumStartAge = kind === 'driver' ? 15 : 16;
  const costCents = kind === 'driver' ? 120_000 : 1_400_000;
  const requiredWeeks = 52;
  const label = kind === 'driver' ? 'driver training' : 'aviation school';
  if (age < minimumStartAge) return blocked(source, `${label === 'driver training' ? 'Driver training' : 'Aviation school'} opens at ${minimumStartAge}.`);
  const current = licenseFor(source, kind);
  if (current?.status === 'active') return blocked(source, `You already have a ${kind === 'driver' ? "driver's" : 'pilot'} license.`);
  if (current?.status === 'training') return blocked(source, `${label === 'driver training' ? 'Driver training' : 'Aviation school'} is already underway.`);
  const actor = source.characters[source.playerCharacterId];
  if (actor.cashCents < costCents) return blocked(source, `You need ${money(costCents)}.`);

  const world = normalizeWealthLifestyleState(clone(source));
  const nextActor = world.characters[world.playerCharacterId];
  nextActor.cashCents -= costCents;
  const id = allocateId(world, 'license');
  world.licenses![id] = { id, characterId: nextActor.id, kind, status: 'training', startedWeek: world.calendar.week, requiredWeeks, costCents };
  world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'training', amountCents: -costCents, fromId: nextActor.id, memo: kind === 'driver' ? 'Driver training' : 'Aviation school' });
  recordHistory(world, 'life', kind === 'driver' ? 'Driver training started' : 'Aviation school started', kind === 'driver' ? 'You started learning to drive.' : 'You started flight training.', { subjectIds: [nextActor.id], importance: 2 });
  return ok(world, kind === 'driver' ? 'Driver training started.' : 'Aviation school started.');
}

export function executeWealthLifestyleAction(source: WorldState, action: IntentAction): ActionResult | null {
  if (!LIFESTYLE_VERBS.has(action.verb)) return null;
  const actor = source.characters[source.playerCharacterId];
  const age = playerAgeYears(source);

  if (action.verb === 'license.start_driver_training') return startLicenseTraining(source, 'driver');
  if (action.verb === 'license.start_pilot_training') return startLicenseTraining(source, 'private-pilot');

  if (action.verb === 'luxury.buy_asset') {
    const catalogId = typeof action.parameters.catalogId === 'string' ? action.parameters.catalogId : '';
    const item = luxuryItem(catalogId);
    if (!item) return blocked(source, 'Choose a known purchase.');
    if (age < item.minimumAge) return blocked(source, `${item.name} opens at age ${item.minimumAge}.`);

    let pilotCost = 0;
    let hiredOperator = false;
    if (item.category === 'car' && item.requiredLicense && !hasActiveLicense(source, item.requiredLicense)) {
      return blocked(source, "You need a driver's license first.");
    }
    if (item.category === 'aircraft') {
      const mode = action.parameters.operationMode;
      if (mode === 'self') {
        if (!hasActiveLicense(source, 'private-pilot')) return blocked(source, 'You need a pilot license to fly it yourself.');
      } else if (mode === 'pilot') {
        hiredOperator = true;
        pilotCost = item.pilotAnnualCostCents ?? 0;
      } else {
        return blocked(source, 'Choose whether to fly it yourself or hire a pilot.');
      }
    }

    const total = item.priceCents + pilotCost;
    if (actor.cashCents < total) return blocked(source, `You need ${money(total)} in cash.`);
    const world = normalizeWealthLifestyleState(clone(source));
    const nextActor = world.characters[world.playerCharacterId];
    nextActor.cashCents -= total;
    const id = allocateId(world, 'asset');
    world.personalAssets![id] = {
      id,
      ownerId: nextActor.id,
      catalogId: item.id,
      category: item.category,
      name: item.name,
      purchasePriceCents: item.priceCents,
      valueCents: item.priceCents,
      weeklyUpkeepCents: item.weeklyUpkeepCents,
      annualChangeBps: item.annualChangeBps,
      acquiredWeek: world.calendar.week,
      requiredLicense: item.requiredLicense,
      hiredOperator: item.category === 'aircraft' ? hiredOperator : undefined,
      operatorAnnualCostCents: item.category === 'aircraft' ? item.pilotAnnualCostCents : undefined,
      operatorPaidThroughWeek: hiredOperator ? world.calendar.week + 52 : undefined,
    };
    world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: `personal-asset-${item.category}`, amountCents: -item.priceCents, fromId: nextActor.id, toId: id, memo: `Purchased ${item.name}` });
    if (pilotCost > 0) world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'pilot-contract', amountCents: -pilotCost, fromId: nextActor.id, toId: id, memo: `Pilot for ${item.name}` });
    recordHistory(world, 'life', `${item.name} purchased`, hiredOperator ? `Bought it and hired a pilot for ${money(pilotCost)}/year.` : 'Paid in cash.', { subjectIds: [nextActor.id], importance: item.priceCents >= 100_000_000 ? 3 : 2 });
    return ok(world, `You bought ${item.name}.${hiredOperator ? ' Pilot hired.' : ''}`);
  }

  if (action.verb === 'luxury.hire_pilot') {
    const assetId = action.targetIds[0];
    const asset = source.personalAssets?.[assetId];
    if (!asset || asset.ownerId !== actor.id || asset.category !== 'aircraft') return blocked(source, 'Choose an aircraft you own.');
    if (asset.hiredOperator && (asset.operatorPaidThroughWeek ?? 0) > source.calendar.week) return blocked(source, 'A pilot is already under contract.');
    const annualCost = asset.operatorAnnualCostCents ?? 18_000_000;
    if (actor.cashCents < annualCost) return blocked(source, `You need ${money(annualCost)} for the pilot contract.`);
    const world = normalizeWealthLifestyleState(clone(source));
    const nextActor = world.characters[world.playerCharacterId];
    const next = world.personalAssets![assetId];
    nextActor.cashCents -= annualCost;
    next.hiredOperator = true;
    next.operatorPaidThroughWeek = world.calendar.week + 52;
    world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'pilot-contract', amountCents: -annualCost, fromId: nextActor.id, toId: next.id, memo: `Pilot for ${next.name}` });
    return ok(world, `Pilot hired for ${money(annualCost)}/year.`);
  }

  if (action.verb === 'luxury.sell_asset') {
    const assetId = action.targetIds[0];
    const asset = source.personalAssets?.[assetId];
    if (!asset || asset.ownerId !== actor.id) return blocked(source, 'Choose an asset you own.');
    const proceeds = Math.round(asset.valueCents * 0.94);
    const world = normalizeWealthLifestyleState(clone(source));
    const nextActor = world.characters[world.playerCharacterId];
    nextActor.cashCents += proceeds;
    delete world.personalAssets![assetId];
    world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'personal-asset-sale', amountCents: proceeds, fromId: assetId, toId: nextActor.id, memo: `Sold ${asset.name}` });
    recordHistory(world, 'life', `${asset.name} sold`, `Sold for ${money(proceeds)} after transaction costs.`, { subjectIds: [nextActor.id], importance: 2 });
    return ok(world, `You sold ${asset.name} for ${money(proceeds)}.`);
  }

  if (action.verb === 'charity.donate') {
    if (age < 18) return blocked(source, 'Independent charitable giving opens at 18.');
    const requested = action.parameters.amountCents;
    const donation = typeof requested === 'number' && Number.isFinite(requested) ? Math.max(10_000, Math.round(requested)) : 0;
    if (donation <= 0 || actor.cashCents < donation) return blocked(source, 'Choose an affordable donation amount.');
    const world = normalizeWealthLifestyleState(clone(source));
    const nextActor = world.characters[world.playerCharacterId];
    nextActor.cashCents -= donation;
    let charity = Object.values(world.organizations).find((organization) => organization.kind === 'charity' && organization.name === 'Harbor Community Foundation');
    if (!charity) {
      const id = allocateId(world, 'organization');
      world.organizations[id] = { id, kind: 'charity', name: 'Harbor Community Foundation', resourcesCents: 0, influence: 34, stability: 72, memberIds: [], history: ['A local community foundation.'] };
      charity = world.organizations[id];
    }
    charity.resourcesCents += donation;
    const scale = Math.log10(Math.max(1, donation / 100_000) + 1);
    const publicGain = Math.min(5, 0.4 + scale * 1.15);
    const politicalGain = Math.min(7, 0.5 + scale * 1.4);
    nextActor.reputation.public = clamp(nextActor.reputation.public + publicGain);
    nextActor.reputation.political = clamp(nextActor.reputation.political + politicalGain);
    nextActor.empathy = clamp(nextActor.empathy + Math.min(1.5, scale * 0.35));
    const campaign = world.politics[nextActor.id]?.campaign;
    if (campaign) campaign.support = clamp(campaign.support + Math.min(3, politicalGain * 0.35));
    world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'charitable-donation', amountCents: -donation, fromId: nextActor.id, toId: charity.id, memo: `Donation to ${charity.name}` });
    recordHistory(world, 'politics', 'Charitable donation', `${money(donation)} to ${charity.name}.`, { subjectIds: [nextActor.id, charity.id], importance: donation >= 10_000_000 ? 3 : 2 });
    return ok(world, `${money(donation)} donated. Public and political support improved a little.`);
  }

  return null;
}

export function applyWealthLifestyleAdvance(before: WorldState, after: WorldState): WorldState {
  const weeks = Math.max(0, after.calendar.week - before.calendar.week);
  if (weeks <= 0) return after;
  const world = normalizeWealthLifestyleState(clone(after));
  const actor = world.characters[world.playerCharacterId];

  for (const license of Object.values(world.licenses ?? {})) {
    if (license.status !== 'training') continue;
    const minimumActiveAge = license.kind === 'driver' ? 16 : 17;
    const age = Math.max(0, Math.floor((world.calendar.week - actor.birthWeek) / 52));
    if (world.calendar.week - license.startedWeek >= license.requiredWeeks && age >= minimumActiveAge) {
      license.status = 'active';
      license.completedWeek = world.calendar.week;
      recordHistory(world, 'life', license.kind === 'driver' ? "Driver's license earned" : 'Pilot license earned', license.kind === 'driver' ? 'You can drive on your own now.' : 'Flight training is complete.', { subjectIds: [actor.id], importance: 3 });
    }
  }

  let upkeepTotal = 0;
  for (const asset of Object.values(world.personalAssets ?? {})) {
    const owner = world.characters[asset.ownerId];
    if (!owner?.isAlive) continue;
    const upkeep = Math.max(0, Math.round(asset.weeklyUpkeepCents * weeks));
    owner.cashCents = clampCents(owner.cashCents - upkeep);
    if (owner.id === actor.id) upkeepTotal += upkeep;
    const annualFactor = 1 + asset.annualChangeBps / 10_000;
    asset.valueCents = Math.max(0, Math.round(asset.valueCents * Math.pow(Math.max(0.1, annualFactor), weeks / 52)));

    while (asset.hiredOperator && asset.operatorAnnualCostCents && (asset.operatorPaidThroughWeek ?? 0) <= world.calendar.week) {
      const cost = asset.operatorAnnualCostCents;
      if (owner.cashCents < cost) {
        asset.hiredOperator = false;
        asset.operatorPaidThroughWeek = undefined;
        recordHistory(world, 'life', `Pilot contract ended`, `${asset.name} no longer has a hired pilot.`, { subjectIds: [owner.id], importance: 2 });
        break;
      }
      owner.cashCents = clampCents(owner.cashCents - cost);
      asset.operatorPaidThroughWeek = (asset.operatorPaidThroughWeek ?? world.calendar.week) + 52;
      world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'pilot-contract', amountCents: -cost, fromId: owner.id, toId: asset.id, memo: `Pilot renewal for ${asset.name}` });
    }
  }

  if (upkeepTotal > 0) {
    world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'personal-asset-upkeep', amountCents: -upkeepTotal, fromId: actor.id, memo: 'Cars, aircraft, collectibles, and jewelry upkeep' });
  }
  if (world.transactions.length > 1_200) world.transactions.splice(0, world.transactions.length - 1_200);
  return world;
}
