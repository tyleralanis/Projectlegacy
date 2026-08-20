import { describe, expect, it } from 'vitest';

import { createWorld } from '../createWorld';
import { applyLifeSystemsAdvance, executeLifeSystemsDepth, lifestyleProfile } from '../lifeSystemsDepth';
import { executeSupplementalDepth } from '../supplementalDepthBridge';

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('systemic life depth', () => {
  it('routes new health actions through the authoritative supplemental bridge', () => {
    const world = createWorld({ seed: 'life-bridge-health', startAgeYears: 30, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = world.characters[world.playerCharacterId];
    actor.stress = 80;
    const result = executeSupplementalDepth(world, { verb: 'health.sleep', targetIds: [], parameters: {} });
    expect(result?.validation.valid).toBe(true);
    expect(result!.world.characters[world.playerCharacterId].stress).toBeLessThan(80);
  });

  it('lets career hours trade money and momentum for actual weekly capacity', () => {
    const world = createWorld({ seed: 'career-hours', startAgeYears: 30, nowISO: '2026-08-20T00:00:00.000Z' });
    const career = Object.values(world.careers).find((item) => item.characterId === world.playerCharacterId && item.active)!;
    career.hoursPerWeek = 40;
    const startingSalary = career.weeklySalaryCents;
    const result = executeLifeSystemsDepth(world, { verb: 'career.negotiate_hours', targetIds: [career.id], parameters: { hours: 50 } });
    expect(result?.validation.valid).toBe(true);
    expect(result!.world.careers[career.id].hoursPerWeek).toBe(50);
    expect(result!.world.careers[career.id].weeklySalaryCents).toBeGreaterThan(startingSalary);
    expect(result!.world.characters[world.playerCharacterId].stress).toBeGreaterThan(world.characters[world.playerCharacterId].stress);
  });

  it('charges a chosen lifestyle every simulated week instead of making wealth free', () => {
    const world = createWorld({ seed: 'wealth-lifestyle', startAgeYears: 35, nowISO: '2026-08-20T00:00:00.000Z' });
    world.characters[world.playerCharacterId].cashCents = 100_000_000;
    const selected = executeLifeSystemsDepth(world, { verb: 'wealth.set_lifestyle', targetIds: [], parameters: { posture: 'luxury' } })!;
    expect(lifestyleProfile(selected.world).posture).toBe('luxury');
    const before = selected.world;
    const after = copy(before);
    after.calendar.week += 4;
    const startingCash = after.characters[after.playerCharacterId].cashCents;
    const advanced = applyLifeSystemsAdvance(before, after);
    expect(advanced.characters[advanced.playerCharacterId].cashCents).toBe(startingCash - 150_000 * 4);
    expect(advanced.transactions.some((transaction) => transaction.kind === 'lifestyle' && transaction.amountCents === -600_000)).toBe(true);
  });

  it('turns land development into a year-long project that becomes an operating asset', () => {
    const world = createWorld({ seed: 'property-development', startAgeYears: 40, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = world.characters[world.playerCharacterId];
    actor.cashCents = 500_000_000;
    world.properties['property-land-test'] = {
      id: 'property-land-test',
      name: 'River Parcel',
      kind: 'land',
      cityId: actor.cityId,
      ownerId: actor.id,
      valueCents: 50_000_000,
      debtCents: 0,
      condition: 70,
      occupancy: 'vacant',
      weeklyRentCents: 0,
      weeklyCostsCents: 10_000,
      managed: false,
    };
    const started = executeLifeSystemsDepth(world, { verb: 'property.develop', targetIds: ['property-land-test'], parameters: { targetKind: 'multifamily', amountCents: 30_000_000 } })!;
    expect(started.world.properties['property-land-test'].occupancy).toBe('construction');
    expect(started.world.properties['property-land-test'].kind).toBe('development');
    const before = started.world;
    const after = copy(before);
    after.calendar.week += 52;
    const completed = applyLifeSystemsAdvance(before, after);
    expect(completed.properties['property-land-test'].kind).toBe('multifamily');
    expect(completed.properties['property-land-test'].occupancy).toBe('vacant');
    expect(completed.properties['property-land-test'].weeklyRentCents).toBeGreaterThan(0);
  });

  it('renews a family office annually instead of treating the first retainer as permanent', () => {
    const world = createWorld({ seed: 'family-office-renewal', startAgeYears: 45, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = world.characters[world.playerCharacterId];
    actor.cashCents = 2_000_000_000;
    const created = executeLifeSystemsDepth(world, { verb: 'wealth.create_family_office', targetIds: [], parameters: {} })!;
    expect(created.validation.valid).toBe(true);
    const office = Object.values(created.world.organizations).find((organization) => /family office/i.test(organization.name))!;
    const before = created.world;
    const after = copy(before);
    after.calendar.week += 52;
    const startingCash = after.characters[after.playerCharacterId].cashCents;
    const renewed = applyLifeSystemsAdvance(before, after);
    expect(renewed.characters[renewed.playerCharacterId].cashCents).toBeLessThan(startingCash);
    expect(renewed.transactions.filter((transaction) => transaction.kind === 'advisor-retainer' && transaction.toId === office.id)).toHaveLength(2);
  });

  it('lets NPC education finish without waiting for the player to press a button', () => {
    const before = createWorld({ seed: 'npc-graduation', startAgeYears: 30, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = before.characters[before.playerCharacterId];
    const npcId = actor.parentIds[0];
    const npc = before.characters[npcId];
    expect(npc).toBeTruthy();
    before.education['education-npc-test'] = {
      id: 'education-npc-test',
      characterId: npc.id,
      institutionId: 'organization-harborview-academy',
      status: 'higher',
      startedWeek: before.calendar.week - 208,
      level: 'Undergraduate · Business',
      recordedGrade: 75,
      knowledgeGain: npc.knowledge,
      prestige: 60,
      network: 55,
      tuitionCentsPerYear: 0,
      manipulatedCredential: false,
    };
    const after = copy(before);
    after.calendar.week += 1;
    const result = applyLifeSystemsAdvance(before, after);
    expect(result.education['education-npc-test'].status).toBe('completed');
    expect(result.characters[npc.id].knowledge).toBeGreaterThan(npc.knowledge);
  });

  it('preserves the value of a professional sports career after retirement', () => {
    const world = createWorld({ seed: 'sports-retirement', startAgeYears: 32, nowISO: '2026-08-20T00:00:00.000Z' });
    const career = Object.values(world.careers).find((item) => item.characterId === world.playerCharacterId && item.active)!;
    career.title = 'Professional Basketball athlete';
    career.sector = 'Sports';
    career.weeksInRole = 260;
    const result = executeLifeSystemsDepth(world, { verb: 'sports.retire', targetIds: [career.id], parameters: {} })!;
    expect(result.validation.valid).toBe(true);
    expect(result.world.careers[career.id].active).toBe(false);
    expect(Object.values(result.world.memories).some((memory) => memory.category === 'Athletics · Retired professional' && memory.permanent)).toBe(true);
  });
});
