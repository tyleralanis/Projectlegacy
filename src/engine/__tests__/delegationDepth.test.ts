import { describe, expect, it } from 'vitest';

import { createWorld } from '../createWorld';
import {
  applyDelegationAdvance,
  distributableBusinessCashCents,
  executeDelegationDepth,
  portfolioManagementFeeWeeklyCents,
  prepareDelegationAdvance,
} from '../delegationDepth';
import { normalizeDelegatedWorld } from '../delegationNormalize';
import type { Business, PropertyAsset, WorldState } from '../types';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function property(world: WorldState, id: string, rent = 100_000): PropertyAsset {
  return {
    id,
    name: `Property ${id}`,
    kind: 'multifamily',
    cityId: world.characters[world.playerCharacterId].cityId,
    ownerId: world.playerCharacterId,
    valueCents: 40_000_000,
    debtCents: 20_000_000,
    condition: 64,
    occupancy: 'tenant',
    weeklyRentCents: rent,
    weeklyCostsCents: 18_000,
    managed: false,
  };
}

function company(world: WorldState, id: string, quality: number): Business {
  const actor = world.characters[world.playerCharacterId];
  const organizationId = `organization-${id}`;
  world.organizations[organizationId] = {
    id: organizationId,
    kind: 'business',
    name: `${id} Holdings`,
    resourcesCents: 20_000_000,
    influence: 40,
    stability: 65,
    memberIds: [actor.id],
    leaderId: actor.id,
    history: [],
  };
  return {
    id,
    organizationId,
    name: `${id} Holdings`,
    sector: 'Real Estate',
    cityId: actor.cityId,
    founderId: actor.id,
    ownerId: actor.id,
    cashCents: 25_000_000,
    debtCents: 0,
    revenueWeeklyCents: 1_000_000,
    costWeeklyCents: 850_000,
    valuationCents: 100_000_000,
    playerOwnershipBps: 10_000,
    votingControlBps: 10_000,
    employees: 6,
    capacity: 50,
    demand: 90,
    quality: 62,
    reputation: 60,
    marketingBps: 600,
    pricePosition: 'market',
    growthPosture: 'balanced',
    delegated: true,
    active: true,
    managerName: quality >= 80 ? 'Strong CEO' : 'Weak CEO',
    managerQuality: quality,
    managerSalaryWeeklyCents: 250_000,
    personalTimeHours: 5,
    productLines: [],
    marketShare: 2,
    customerLoyalty: 58,
    culture: 60,
    complexity: 42,
    locations: 1,
  };
}

describe('delegation depth', () => {
  it('uses one property manager across the whole portfolio with a scaling fee', () => {
    const world = createWorld({ seed: 'portfolio-manager', startAgeYears: 30, nowISO: '2026-08-20T00:00:00.000Z' });
    world.properties['property-a'] = property(world, 'property-a', 100_000);
    world.properties['property-b'] = property(world, 'property-b', 200_000);

    const managed = executeDelegationDepth(world, { verb: 'property.manage_portfolio', targetIds: [], parameters: {} })!;
    expect(Object.values(managed.world.properties).every((item) => item.managed)).toBe(true);
    expect(portfolioManagementFeeWeeklyCents(managed.world)).toBe(27_000);

    managed.world.properties['property-c'] = property(managed.world, 'property-c', 300_000);
    const before = clone(managed.world);
    const after = clone(managed.world);
    after.calendar.week += 1;
    const advanced = applyDelegationAdvance(before, after);
    expect(advanced.properties['property-c'].managed).toBe(true);
    expect(portfolioManagementFeeWeeklyCents(advanced)).toBe(54_000);
  });

  it('lets owners withdraw only company cash above operating runway', () => {
    const world = createWorld({ seed: 'owner-distribution', startAgeYears: 30, nowISO: '2026-08-20T00:00:00.000Z' });
    world.businesses['business-owned'] = company(world, 'business-owned', 82);
    world.businesses['business-owned'].cashCents = 10_000_000;
    world.businesses['business-owned'].costWeeklyCents = 100_000;
    world.businesses['business-owned'].managerSalaryWeeklyCents = 0;
    const beforeCash = world.characters[world.playerCharacterId].cashCents;
    const available = distributableBusinessCashCents(world.businesses['business-owned']);

    const result = executeDelegationDepth(world, { verb: 'business.withdraw_funds', targetIds: ['business-owned'], parameters: { amountCents: 1_000_000 } })!;
    expect(result.validation.valid).toBe(true);
    expect(result.world.characters[result.world.playerCharacterId].cashCents).toBe(beforeCash + 1_000_000);
    expect(result.world.businesses['business-owned'].cashCents).toBe(9_000_000);
    expect(available).toBeGreaterThan(1_000_000);
  });

  it('makes an 80+ CEO materially outperform a weak CEO and staff capacity automatically', () => {
    const goodBefore = createWorld({ seed: 'good-ceo', startAgeYears: 30, nowISO: '2026-08-20T00:00:00.000Z' });
    goodBefore.businesses.good = company(goodBefore, 'good', 85);
    const goodSource = clone(goodBefore);
    goodSource.calendar.week += 1;

    const badBefore = createWorld({ seed: 'bad-ceo', startAgeYears: 30, nowISO: '2026-08-20T00:00:00.000Z' });
    badBefore.businesses.bad = company(badBefore, 'bad', 45);
    const badSource = clone(badBefore);
    badSource.calendar.week += 1;

    const good = applyDelegationAdvance(goodBefore, goodSource).businesses.good;
    const bad = applyDelegationAdvance(badBefore, badSource).businesses.bad;

    expect(good.revenueWeeklyCents - good.costWeeklyCents).toBeGreaterThan(bad.revenueWeeklyCents - bad.costWeeklyCents);
    expect(good.cashCents).toBeGreaterThan(bad.cashCents);
    expect(good.capacity).toBeGreaterThan(bad.capacity);
  });

  it('auto-renews a gym membership when affordable and allows cancellation', () => {
    const before = createWorld({ seed: 'gym-renewal', startAgeYears: 30, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = before.characters[before.playerCharacterId];
    actor.cashCents = 500_000;
    const started = before.calendar.week - 51;
    before.organizations.gym = { id: 'gym', kind: 'club', name: 'Harbor Athletic Club', resourcesCents: 78_000, influence: 15, stability: 80, memberIds: [actor.id], history: [`gym-membership:${started}:52`] };
    const source = clone(before);
    source.calendar.week += 1;

    const renewed = prepareDelegationAdvance(before, source);
    expect(renewed.characters[renewed.playerCharacterId].cashCents).toBe(422_000);
    expect(renewed.organizations.gym.history.some((entry) => entry === `gym-membership:${started + 52}:52`)).toBe(true);

    const cancelled = executeDelegationDepth(renewed, { verb: 'health.cancel_gym_membership', targetIds: [], parameters: {} })!;
    expect(cancelled.world.organizations.gym.history.some((entry) => entry.startsWith('gym-membership:'))).toBe(false);
  });

  it('clears an already-pending CEO capacity interruption when an old save loads', () => {
    const world = createWorld({ seed: 'delegated-existing-event', startAgeYears: 30, nowISO: '2026-08-20T00:00:00.000Z' });
    world.businesses.company = company(world, 'company', 84);
    world.events.push({
      id: 'event-capacity',
      templateId: 'business.capacity',
      domain: 'business',
      severity: 'S3',
      week: world.calendar.week,
      title: 'Growth is breaking capacity',
      narrative: 'Routine capacity pressure.',
      participantIds: [world.playerCharacterId, world.businesses.company.organizationId],
      choices: [{ id: 'delegate', label: 'Delegate', detail: 'Let management handle it.' }],
      otherActionFamilies: ['business'],
      resolved: false,
    });

    const normalized = normalizeDelegatedWorld(world);
    expect(normalized.events.find((event) => event.id === 'event-capacity')?.resolved).toBe(true);
    expect(normalized.businesses.company.capacity).toBeGreaterThan(50);
  });
});
