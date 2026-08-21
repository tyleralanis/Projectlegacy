import { describe, expect, it } from 'vitest';

import { minimumAgeForWellnessVerb, normalizeFocusesForAge } from '../ageProgression';
import { normalizeAgeProgressionState } from '../ageProgressionWorld';
import { executeAgeActionGate } from '../ageActionGate';
import { createWorld } from '../createWorld';
import { netWorthCents } from '../money';
import { renovationOptionsForProperty } from '../propertyRenovations';
import type { PropertyAsset } from '../types';
import { applyWealthLifestyleAdvance, executeWealthLifestyleAction, hasActiveLicense } from '../wealthLifestyle';

const nowISO = '2026-08-21T00:00:00.000Z';

function worldAtAge(age: number) {
  return createWorld({ seed: `age-aware-${age}`, firstName: 'Jayna', lastName: 'Lawson', startAgeYears: age, nowISO });
}

describe('age-aware life rules', () => {
  it('blocks adult wellness actions for babies and toddlers', () => {
    const world = worldAtAge(1);
    const run = executeAgeActionGate(world, { verb: 'health.run', targetIds: [], parameters: {} });
    const gym = executeAgeActionGate(world, { verb: 'health.join_gym', targetIds: [], parameters: {} });

    expect(run?.validation.valid).toBe(false);
    expect(gym?.validation.valid).toBe(false);
    expect(run?.message).toContain('caregivers');
    expect(gym?.message).toContain('caregivers');
    expect(minimumAgeForWellnessVerb('health.run')).toBe(8);
    expect(minimumAgeForWellnessVerb('health.join_gym')).toBe(16);
  });

  it('forces young-child priorities instead of preserving adult focus choices', () => {
    expect(normalizeFocusesForAge(1, ['Job', 'Startup', 'Campaign'])).toEqual(['Family', 'Health', 'Creative Work']);
    expect(normalizeFocusesForAge(4, ['Job', 'Startup', 'Campaign'])).toEqual(['Academics', 'Family', 'Creative Work']);
    expect(normalizeFocusesForAge(15, ['Job', 'Startup', 'Campaign'])).toEqual(['Academics', 'Family', 'Health']);
  });

  it('cleans invalid parent pressure from an existing toddler save', () => {
    const world = worldAtAge(1);
    const actor = world.characters[world.playerCharacterId];
    const parentId = actor.parentIds[0];
    const relationship = Object.values(world.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(parentId));
    expect(relationship).toBeDefined();
    relationship!.lastInteractionWeek = 0;

    world.memories['memory-invalid-parent-thread'] = {
      id: 'memory-invalid-parent-thread',
      participantIds: [actor.id, parentId],
      category: 'Thread · Relationship',
      week: world.calendar.week,
      valence: -0.4,
      importance: 65,
      permanent: false,
      unresolved: true,
      visibility: 'shared',
      narrative: 'A parent is waiting for you to call.',
    };
    world.feed.unshift({ id: 'feed-invalid-call', week: world.calendar.week, domain: 'family', title: 'Have a real call', detail: 'Reconnect without rearranging the whole week.', important: false });
    world.timeline.unshift({ id: 'timeline-invalid-call', week: world.calendar.week, generation: 1, category: 'relationship', title: 'Have a real call', detail: 'Reconnect without rearranging the whole week.', subjectIds: [actor.id], importance: 2 });
    world.events.push({
      id: 'event-invalid-parent-reachout',
      templateId: 'story.family-reach-out',
      domain: 'family',
      severity: 'S2',
      week: world.calendar.week,
      title: 'Parent asks when they are going to see you',
      narrative: 'You have not made time.',
      participantIds: [actor.id, parentId],
      choices: [],
      otherActionFamilies: ['family'],
      resolved: false,
    });

    const normalized = normalizeAgeProgressionState(world);
    const nextRelationship = Object.values(normalized.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(parentId));

    expect(nextRelationship?.lastInteractionWeek).toBe(normalized.calendar.week);
    expect(normalized.memories['memory-invalid-parent-thread']).toBeUndefined();
    expect(normalized.feed.some((entry) => entry.title === 'Have a real call')).toBe(false);
    expect(normalized.timeline.some((entry) => entry.title === 'Have a real call')).toBe(false);
    expect(normalized.events.some((event) => event.id === 'event-invalid-parent-reachout')).toBe(false);
  });
});

describe('contextual property improvements', () => {
  const base: PropertyAsset = {
    id: 'property-test',
    name: 'Test property',
    kind: 'single-family',
    cityId: 'city-harborview',
    ownerId: 'character-player',
    valueCents: 50_000_000,
    debtCents: 0,
    condition: 70,
    occupancy: 'owner',
    weeklyRentCents: 0,
    weeklyCostsCents: 20_000,
    managed: false,
  };

  it('gives retail/commercial property commercial work rather than house remodeling', () => {
    const commercial = { ...base, kind: 'commercial' as const, name: 'Harbor Retail Strip' };
    const options = renovationOptionsForProperty(commercial);

    expect(options.some((option) => option.id === 'parking-lot' && option.costCents === 2_500_000)).toBe(true);
    expect(options.some((option) => /kitchen|bath/i.test(option.label))).toBe(false);
  });

  it('offers a $50k backyard pool for a house', () => {
    const house = { ...base, kind: 'single-family' as const, name: 'Three-bedroom house' };
    const pool = renovationOptionsForProperty(house).find((option) => option.id === 'house-pool');
    expect(pool?.costCents).toBe(5_000_000);
  });
});

describe('licenses, luxury assets, and giving', () => {
  it('lets a 15-year-old train now and activates the driver license at 16', () => {
    const before = worldAtAge(15);
    before.characters[before.playerCharacterId].cashCents = 10_000_000;
    const started = executeWealthLifestyleAction(before, { verb: 'license.start_driver_training', targetIds: [], parameters: {} });
    expect(started?.validation.valid).toBe(true);
    expect(started && hasActiveLicense(started.world, 'driver')).toBe(false);

    const after = JSON.parse(JSON.stringify(started!.world)) as typeof before;
    after.calendar.week += 52;
    const progressed = applyWealthLifestyleAdvance(started!.world, after);
    expect(hasActiveLicense(progressed, 'driver')).toBe(true);
  });

  it('requires a driver license before buying a car', () => {
    const world = worldAtAge(18);
    world.characters[world.playerCharacterId].cashCents = 100_000_000;
    const result = executeWealthLifestyleAction(world, { verb: 'luxury.buy_asset', targetIds: [], parameters: { catalogId: 'car-luxury-sedan' } });
    expect(result?.validation.valid).toBe(false);
    expect(result?.message).toContain("driver's license");
  });

  it('can buy an aircraft by hiring a pilot without holding a pilot license', () => {
    const world = worldAtAge(25);
    world.characters[world.playerCharacterId].cashCents = 100_000_000;
    const result = executeWealthLifestyleAction(world, { verb: 'luxury.buy_asset', targetIds: [], parameters: { catalogId: 'aircraft-piston', operationMode: 'pilot' } });

    expect(result?.validation.valid).toBe(true);
    const asset = result && Object.values(result.world.personalAssets ?? {})[0];
    expect(asset?.category).toBe('aircraft');
    expect(asset?.hiredOperator).toBe(true);
  });

  it('counts personal assets in net worth and charity raises political reputation', () => {
    const world = worldAtAge(30);
    const actor = world.characters[world.playerCharacterId];
    actor.cashCents = 200_000_000;
    world.personalAssets = {
      'asset-test': {
        id: 'asset-test',
        ownerId: actor.id,
        catalogId: 'collectible-watch',
        category: 'collectible',
        name: 'Vintage watch',
        purchasePriceCents: 2_500_000,
        valueCents: 2_500_000,
        weeklyUpkeepCents: 500,
        annualChangeBps: 100,
        acquiredWeek: world.calendar.week,
      },
    };
    const expectedWorth = actor.cashCents + 2_500_000;
    expect(netWorthCents(world)).toBe(expectedWorth);

    const politicalBefore = actor.reputation.political;
    const donation = executeWealthLifestyleAction(world, { verb: 'charity.donate', targetIds: [], parameters: { amountCents: 1_000_000 } });
    expect(donation?.validation.valid).toBe(true);
    expect(donation!.world.characters[world.playerCharacterId].reputation.political).toBeGreaterThan(politicalBefore);
  });
});
