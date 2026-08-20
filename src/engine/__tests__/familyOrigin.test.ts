import { describe, expect, it } from 'vitest';

import { createWorld } from '../createWorld';
import { generateFamilyOrigin } from '../familyOrigin';

const nowISO = '2026-08-20T00:00:00.000Z';

describe('family origin generation', () => {
  it('is deterministic for the same world seed', () => {
    expect(generateFamilyOrigin('origin-repeatable')).toEqual(generateFamilyOrigin('origin-repeatable'));
    const first = createWorld({ seed: 'origin-repeatable', firstName: 'Alex', lastName: 'Mercer', startAgeYears: 0, nowISO });
    const second = createWorld({ seed: 'origin-repeatable', firstName: 'Alex', lastName: 'Mercer', startAgeYears: 0, nowISO });
    expect(first).toEqual(second);
  });

  it('changes material family circumstances across different seeds', () => {
    const first = generateFamilyOrigin('origin-one');
    const second = generateFamilyOrigin('origin-two');
    const firstSignature = [first.wealthTier, first.climate, first.parentOne.firstName, first.parentTwo.firstName, first.parentOne.professionId, first.parentTwo.professionId, first.sibling.firstName].join('|');
    const secondSignature = [second.wealthTier, second.climate, second.parentOne.firstName, second.parentTwo.firstName, second.parentOne.professionId, second.parentTwo.professionId, second.sibling.firstName].join('|');
    expect(firstSignature).not.toBe(secondSignature);
  });

  it('carries the origin into permanent family memory and adult starting resources', () => {
    const world = createWorld({ seed: 'origin-adult', firstName: 'Alex', lastName: 'Mercer', startAgeYears: 18, nowISO });
    const actor = world.characters[world.playerCharacterId];
    const origin = generateFamilyOrigin('origin-adult');
    expect(actor.cashCents).toBe(origin.playerAdultCashCents);
    expect(world.memories['memory-family-origin'].permanent).toBe(true);
    expect(world.memories['memory-family-origin'].narrative).toContain(origin.label);
    expect(world.dynasty.notableHistory.some((entry) => entry.includes(origin.label))).toBe(true);
  });
});
