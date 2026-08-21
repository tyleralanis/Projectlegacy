import { describe, expect, it } from 'vitest';

import { createWorld } from '../createWorld';
import { executeFactionDepth, innerCircleProfile } from '../factionDepth';
import { executeFactionPolish, factionCadenceStatus } from '../factionPolish';

function movementWorld(seed: string) {
  const world = createWorld({ seed, startAgeYears: 30, nowISO: '2026-08-21T00:00:00.000Z' });
  world.characters[world.playerCharacterId].cashCents = 5_000_000;
  const founded = executeFactionDepth(world, {
    verb: 'organization.found_inner_circle',
    targetIds: [],
    parameters: { name: 'Test Circle', archetype: 'religious', amountCents: 50_000 },
  });
  if (!founded) throw new Error('Expected movement creation to be handled.');
  return founded.world;
}

describe('movement pacing polish', () => {
  it('allows one outreach push per week and scales recruitment with movement reach', () => {
    const world = movementWorld('movement-recruitment');
    const first = executeFactionPolish(world, { verb: 'faction.recruit', targetIds: [], parameters: {} })!;
    expect(first.validation.valid).toBe(true);
    const afterFirst = innerCircleProfile(first.world)!;
    const starting = innerCircleProfile(world)!;
    expect(afterFirst.followers).toBeGreaterThan(starting.followers);

    const repeated = executeFactionPolish(first.world, { verb: 'faction.recruit', targetIds: [], parameters: {} })!;
    expect(repeated.validation.valid).toBe(false);
    expect(repeated.message).toContain('Advance 1 more week');

    first.world.calendar.week += 1;
    const cadence = factionCadenceStatus(first.world)!;
    expect(cadence.recruitInWeeks).toBe(0);
    const nextWeek = executeFactionPolish(first.world, { verb: 'faction.recruit', targetIds: [], parameters: {} })!;
    expect(nextWeek.validation.valid).toBe(true);
  });

  it('spaces contribution drives and makes aggressive fundraising costly', () => {
    const world = movementWorld('movement-fundraising');
    const org = Object.values(world.organizations).find((item) => item.leaderId === world.playerCharacterId && item.kind === 'faction')!;
    org.resourcesCents = 100_000;
    const before = innerCircleProfile(world)!;
    const drive = executeFactionPolish(world, { verb: 'faction.collect_contributions', targetIds: [], parameters: { pressure: 'aggressive' } })!;
    const after = innerCircleProfile(drive.world)!;
    expect(drive.validation.valid).toBe(true);
    expect(drive.world.organizations[org.id].resourcesCents).toBeGreaterThan(org.resourcesCents);
    expect(after.cohesion).toBeLessThan(before.cohesion);
    expect(Object.values(drive.world.exposures).some((exposure) => exposure.category === 'coercive-organization-finance')).toBe(true);

    const repeated = executeFactionPolish(drive.world, { verb: 'faction.collect_contributions', targetIds: [], parameters: { pressure: 'normal' } })!;
    expect(repeated.validation.valid).toBe(false);
    expect(factionCadenceStatus(drive.world)?.fundraisingInWeeks).toBe(4);
  });

  it('supports leave, dissolve, and cash-out as distinct confirmed exits', () => {
    const leaveWorld = movementWorld('movement-leave');
    const leaveProposal = executeFactionPolish(leaveWorld, { verb: 'faction.leave', targetIds: [], parameters: {}, destructive: true })!;
    expect(leaveProposal.validation.requiresConfirmation).toBe(true);
    const left = executeFactionPolish(leaveWorld, { verb: 'faction.leave', targetIds: [], parameters: {}, destructive: true }, true)!;
    expect(innerCircleProfile(left.world)).toBeUndefined();

    const dissolveWorld = movementWorld('movement-dissolve');
    const dissolved = executeFactionPolish(dissolveWorld, { verb: 'faction.dissolve', targetIds: [], parameters: {}, destructive: true }, true)!;
    const dissolvedOrg = Object.values(dissolved.world.organizations).find((item) => item.name === 'Test Circle')!;
    expect(dissolvedOrg.leaderId).toBeUndefined();
    expect(dissolvedOrg.resourcesCents).toBe(0);

    const cashWorld = movementWorld('movement-cashout');
    const cashOrg = Object.values(cashWorld.organizations).find((item) => item.leaderId === cashWorld.playerCharacterId && item.kind === 'faction')!;
    cashOrg.resourcesCents = 2_000_000;
    const actorCash = cashWorld.characters[cashWorld.playerCharacterId].cashCents;
    const cashed = executeFactionPolish(cashWorld, { verb: 'faction.cash_out', targetIds: [], parameters: {}, destructive: true }, true)!;
    expect(cashed.world.characters[cashWorld.playerCharacterId].cashCents).toBe(actorCash + 1_640_000);
    expect(innerCircleProfile(cashed.world)).toBeUndefined();
    expect(Object.values(cashed.world.exposures).some((exposure) => exposure.category === 'faction-fund-misappropriation')).toBe(true);
  });
});
