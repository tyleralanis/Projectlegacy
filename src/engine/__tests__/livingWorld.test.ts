import { describe, expect, it } from 'vitest';

import { createWorld } from '../createWorld';
import { applyLivingWorldPass, getTimeBudget } from '../livingWorld';

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('living world pass', () => {
  it('turns overlapping work into a finite weekly time budget', () => {
    const world = createWorld({ seed: 'time-budget', startAgeYears: 30, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = world.characters[world.playerCharacterId];
    world.businesses['business-one'] = {
      id: 'business-one', organizationId: 'organization-northstar-logistics', name: 'Side Company', sector: 'Services', cityId: actor.cityId,
      founderId: actor.id, ownerId: actor.id, cashCents: 5_000_000, debtCents: 0, revenueWeeklyCents: 300_000, costWeeklyCents: 200_000,
      valuationCents: 20_000_000, playerOwnershipBps: 10_000, votingControlBps: 10_000, employees: 4, capacity: 40, demand: 35,
      quality: 60, reputation: 55, marketingBps: 500, pricePosition: 'market', growthPosture: 'balanced', delegated: false, active: true,
    };
    const budget = getTimeBudget(world);
    expect(budget.committedHours).toBeGreaterThan(budget.capacityHours);
    expect(['overloaded', 'unsustainable']).toContain(budget.status);
  });

  it('records growing-up milestones instead of making childhood empty time', () => {
    const before = createWorld({ seed: 'growing-up', startAgeYears: 17, nowISO: '2026-08-20T00:00:00.000Z' });
    const after = copy(before);
    after.calendar.week += 52;
    const result = applyLivingWorldPass(before, after);
    expect(result.timeline.some((entry) => entry.title === 'Legally grown')).toBe(true);
  });

  it('makes an unsustainable schedule hurt instead of allowing infinite commitments for free', () => {
    const before = createWorld({ seed: 'overload', startAgeYears: 30, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = before.characters[before.playerCharacterId];
    for (let index = 0; index < 2; index += 1) {
      before.businesses[`business-${index}`] = {
        id: `business-${index}`, organizationId: 'organization-northstar-logistics', name: `Company ${index}`, sector: 'Services', cityId: actor.cityId,
        founderId: actor.id, ownerId: actor.id, cashCents: 5_000_000, debtCents: 0, revenueWeeklyCents: 300_000, costWeeklyCents: 200_000,
        valuationCents: 20_000_000, playerOwnershipBps: 10_000, votingControlBps: 10_000, employees: 4, capacity: 40, demand: 35,
        quality: 60, reputation: 55, marketingBps: 500, pricePosition: 'market', growthPosture: 'balanced', delegated: false, active: true,
      };
    }
    const after = copy(before);
    after.calendar.week += 13;
    const startingStress = after.characters[after.playerCharacterId].stress;
    const startingPerformance = after.careers['career-player'].performance;
    const result = applyLivingWorldPass(before, after);
    expect(result.characters[result.playerCharacterId].stress).toBeGreaterThan(startingStress);
    expect(result.careers['career-player'].performance).toBeLessThan(startingPerformance);
    expect(result.timeline.some((entry) => entry.title === 'There are not enough hours')).toBe(true);
  });

  it('is deterministic for the same world and time jump', () => {
    const before = createWorld({ seed: 'living-determinism', startAgeYears: 20, nowISO: '2026-08-20T00:00:00.000Z' });
    const after = copy(before);
    after.calendar.week += 13;
    expect(applyLivingWorldPass(before, after)).toEqual(applyLivingWorldPass(before, after));
  });
});
