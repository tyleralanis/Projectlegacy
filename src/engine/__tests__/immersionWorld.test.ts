import { describe, expect, it } from 'vitest';

import { createWorld } from '../createWorld';
import { applyImmersionWorld, getImmersionSnapshot, relationshipPortrait } from '../immersionWorld';
import type { WorldState } from '../types';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('deep immersion layer', () => {
  it('gives a working adult a persistent workplace social cast', () => {
    const before = createWorld({ seed: 'immersive-work', startAgeYears: 18, nowISO: '2026-01-01T00:00:00.000Z' });
    const source = clone(before);
    source.calendar.week += 13;

    const after = applyImmersionWorld(before, source);
    const career = Object.values(after.careers).find((item) => item.characterId === after.playerCharacterId && item.active)!;
    const professionalContacts = Object.values(after.relationships)
      .filter((relationship) => relationship.kind === 'professional' && relationship.characterIds.includes(after.playerCharacterId))
      .map((relationship) => relationship.characterIds.find((id) => id !== after.playerCharacterId)!)
      .filter((id) => Object.values(after.careers).some((otherCareer) => otherCareer.characterId === id && otherCareer.employerId === career.employerId));

    expect(professionalContacts.length).toBeGreaterThanOrEqual(3);
    expect(after.feed.some((entry) => entry.title === 'Work has faces now')).toBe(true);
  });

  it('creates classmates around an active school life', () => {
    const before = createWorld({ seed: 'immersive-school', startAgeYears: 10, nowISO: '2026-01-01T00:00:00.000Z' });
    const source = clone(before) as WorldState;
    source.education['school-test'] = {
      id: 'school-test',
      characterId: source.playerCharacterId,
      institutionId: 'organization-harborview-academy',
      status: 'school',
      startedWeek: source.calendar.week,
      level: 'General studies',
      recordedGrade: 72,
      knowledgeGain: 30,
      prestige: 52,
      network: 35,
      tuitionCentsPerYear: 0,
      manipulatedCredential: false,
    };
    source.calendar.week += 13;

    const after = applyImmersionWorld(before, source);
    const classmates = Object.values(after.relationships)
      .filter((relationship) => relationship.characterIds.includes(after.playerCharacterId) && ['friend', 'acquaintance'].includes(relationship.kind))
      .map((relationship) => relationship.characterIds.find((id) => id !== after.playerCharacterId)!)
      .filter((id) => Object.values(after.education).some((record) => record.characterId === id && record.institutionId === 'organization-harborview-academy'));

    expect(classmates.length).toBeGreaterThanOrEqual(4);
    expect(after.feed.some((entry) => entry.title === 'A social world forms around school')).toBe(true);
  });

  it('turns people into readable lives instead of relationship meters only', () => {
    const world = createWorld({ seed: 'portrait', startAgeYears: 18, nowISO: '2026-01-01T00:00:00.000Z' });
    const parent = world.characters['character-elena'];
    const portrait = relationshipPortrait(world, parent.id);

    expect(portrait.summary.length).toBeGreaterThan(25);
    expect(portrait.traits.length).toBe(4);
    expect(portrait.currentLife).toContain(parent.firstName);
  });

  it('builds a state-grounded life snapshot', () => {
    const world = createWorld({ seed: 'snapshot', startAgeYears: 18, nowISO: '2026-01-01T00:00:00.000Z' });
    const items = getImmersionSnapshot(world);

    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.some((item) => item.title.includes('Operations') || item.title.includes('week'))).toBe(true);
  });
});
