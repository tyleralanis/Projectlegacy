import { describe, expect, it } from 'vitest';

import { applyAutonomousWorld, getOpenStoryThreads } from '../autonomousWorld';
import { createWorld } from '../createWorld';
import type { WorldState } from '../types';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('autonomous world', () => {
  it('lets important NPCs build careers without waiting for player actions', () => {
    const before = createWorld({ seed: 'npc-careers', startAgeYears: 0, nowISO: '2026-01-01T00:00:00.000Z' });
    const source = clone(before);
    source.calendar.week += 52;

    const after = applyAutonomousWorld(before, source);
    const parentCareers = Object.values(after.careers).filter((career) => ['character-jonah', 'character-elena'].includes(career.characterId) && career.active);

    expect(parentCareers.length).toBe(2);
    expect(after.characters['character-jonah'].professionId).toBeTruthy();
    expect(after.characters['character-elena'].professionId).toBeTruthy();
  });

  it('turns long relationship neglect into a persistent story and then an event', () => {
    const start = createWorld({ seed: 'relationship-thread', startAgeYears: 18, nowISO: '2026-01-01T00:00:00.000Z' });
    start.relationships['relationship-player-mother'].lastInteractionWeek = start.calendar.week - 40;
    const firstSource = clone(start);
    firstSource.calendar.week += 4;
    const first = applyAutonomousWorld(start, firstSource);

    expect(getOpenStoryThreads(first).some((memory) => memory.category === 'Thread · Relationship')).toBe(true);

    const secondSource = clone(first);
    secondSource.calendar.week += 5;
    const second = applyAutonomousWorld(first, secondSource);
    const event = second.events.find((item) => !item.resolved && item.templateId === 'relationship.reconnect');

    expect(event).toBeTruthy();
    expect(event?.participantIds).toContain('character-elena');
  });

  it('recognizes an overloaded job plus owner-led company as an ongoing life problem', () => {
    const before = createWorld({ seed: 'time-thread', startAgeYears: 18, nowISO: '2026-01-01T00:00:00.000Z' });
    const source = clone(before) as WorldState;
    source.businesses['business-test'] = {
      id: 'business-test',
      organizationId: 'organization-northstar-logistics',
      name: 'Second Shift LLC',
      sector: 'Local services',
      cityId: source.characters[source.playerCharacterId].cityId,
      founderId: source.playerCharacterId,
      ownerId: source.playerCharacterId,
      cashCents: 2_000_000,
      debtCents: 0,
      revenueWeeklyCents: 250_000,
      costWeeklyCents: 190_000,
      valuationCents: 8_000_000,
      playerOwnershipBps: 10_000,
      votingControlBps: 10_000,
      employees: 2,
      capacity: 20,
      demand: 16,
      quality: 65,
      reputation: 55,
      marketingBps: 600,
      pricePosition: 'market',
      growthPosture: 'balanced',
      delegated: false,
      active: true,
      personalTimeHours: 30,
    };
    source.calendar.week += 4;

    const after = applyAutonomousWorld(before, source);
    const timeThread = getOpenStoryThreads(after).find((memory) => memory.category === 'Thread · Time pressure');

    expect(timeThread).toBeTruthy();
    expect(timeThread?.narrative).toContain('committed hours');
  });
});
