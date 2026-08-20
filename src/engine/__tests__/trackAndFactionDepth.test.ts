import { describe, expect, it } from 'vitest';

import { createWorld } from '../createWorld';
import { innerCircleProfile } from '../factionDepth';
import { executeSupplementalDepth } from '../supplementalDepth';
import { getTrackMemory } from '../trackDepth';

describe('deep playable life tracks', () => {
  it('persists an investing philosophy instead of treating trades as isolated taps', () => {
    const world = createWorld({ seed: 'deep-investing', startAgeYears: 28, nowISO: '2026-01-01T00:00:00.000Z' });
    const result = executeSupplementalDepth(world, { verb: 'markets.set_strategy', targetIds: [], parameters: { strategy: 'value' } });

    expect(result?.validation.valid).toBe(true);
    expect(getTrackMemory(result!.world, 'Track · Investing strategy')).toContain('value:');
    expect(result!.world.timeline.some((entry) => entry.title === 'Investment strategy: value')).toBe(true);
  });

  it('lets college specialization change the actual education record', () => {
    const world = createWorld({ seed: 'deep-college', startAgeYears: 19, nowISO: '2026-01-01T00:00:00.000Z' });
    const actor = world.characters[world.playerCharacterId];
    world.education['college-test'] = {
      id: 'college-test',
      characterId: actor.id,
      institutionId: 'organization-harborview-academy',
      status: 'higher',
      startedWeek: world.calendar.week,
      level: 'Undergraduate program',
      recordedGrade: 76,
      knowledgeGain: actor.knowledge,
      prestige: 60,
      network: 48,
      tuitionCentsPerYear: 0,
      manipulatedCredential: false,
    };

    const result = executeSupplementalDepth(world, { verb: 'education.choose_major', targetIds: ['college-test'], parameters: { major: 'Computer Science' } });

    expect(result?.validation.valid).toBe(true);
    expect(result!.world.education['college-test'].level).toBe('Undergraduate · Computer Science');
    expect(getTrackMemory(result!.world, 'Track · College major')).toContain('Computer Science');
  });

  it('turns a job into an active progression loop with performance and stress tradeoffs', () => {
    const world = createWorld({ seed: 'deep-career', startAgeYears: 24, nowISO: '2026-01-01T00:00:00.000Z' });
    const actor = world.characters[world.playerCharacterId];
    for (const career of Object.values(world.careers)) if (career.characterId === actor.id) career.active = false;
    const careerId = 'career-test';
    world.careers[careerId] = {
      id: careerId,
      characterId: actor.id,
      employerId: 'organization-northstar-logistics',
      title: 'Operations analyst',
      sector: 'Operations',
      weeklySalaryCents: 125_000,
      performance: 55,
      satisfaction: 63,
      weeksInRole: 60,
      active: true,
    };
    const beforeStress = actor.stress;

    const result = executeSupplementalDepth(world, { verb: 'career.work_hard', targetIds: [careerId], parameters: {} });

    expect(result?.validation.valid).toBe(true);
    expect(result!.world.careers[careerId].performance).toBeGreaterThan(55);
    expect(result!.world.characters[actor.id].stress).toBeGreaterThan(beforeStress);
  });
});

describe('hidden private movement', () => {
  it('is unlocked explicitly and can begin with a dictated archetype', () => {
    const world = createWorld({ seed: 'hidden-movement', startAgeYears: 30, nowISO: '2026-01-01T00:00:00.000Z' });
    world.characters[world.playerCharacterId].cashCents = 2_000_000;

    const result = executeSupplementalDepth(world, { verb: 'organization.found_inner_circle', targetIds: [], parameters: { archetype: 'military', name: 'The Quiet Order' } });
    const profile = innerCircleProfile(result!.world);

    expect(result?.validation.valid).toBe(true);
    expect(profile?.name).toBe('The Quiet Order');
    expect(profile?.archetype).toBe('military');
    expect(profile?.security).toBeGreaterThan(10);
    expect(profile?.followers).toBeGreaterThanOrEqual(6);
  });

  it('resolves a national power attempt at a strategic level and leaves persistent consequences', () => {
    const world = createWorld({ seed: 'power-struggle', startAgeYears: 35, nowISO: '2026-01-01T00:00:00.000Z' });
    world.characters[world.playerCharacterId].cashCents = 5_000_000;
    const founded = executeSupplementalDepth(world, { verb: 'organization.found_inner_circle', targetIds: [], parameters: { archetype: 'military' } })!;
    const profile = innerCircleProfile(founded.world)!;
    const beforeExposureCount = Object.keys(founded.world.exposures).length;

    const result = executeSupplementalDepth(founded.world, { verb: 'faction.attempt_power_seizure', targetIds: [profile.organizationId], parameters: {}, destructive: true }, true)!;

    expect(result.validation.valid).toBe(true);
    expect(Object.keys(result.world.exposures).length).toBeGreaterThan(beforeExposureCount);
    expect(result.world.timeline.some((entry) => entry.title === 'The power seizure failed' || entry.title === 'The movement seized national power')).toBe(true);
  });

  it('keeps additional spouses independent from the primary partner pointer', () => {
    const world = createWorld({ seed: 'plural-household', startAgeYears: 35, nowISO: '2026-01-01T00:00:00.000Z' });
    const actor = world.characters[world.playerCharacterId];
    actor.cashCents = 5_000_000;
    actor.partnerId = 'character-riley';
    world.characters['character-riley'].partnerId = actor.id;
    world.relationships['relationship-player-riley'].kind = 'spouse';

    const founded = executeSupplementalDepth(world, { verb: 'organization.found_inner_circle', targetIds: [], parameters: { archetype: 'religious' } })!;
    const profile = innerCircleProfile(founded.world)!;
    const organization = founded.world.organizations[profile.organizationId];
    const extraSpouseId = organization.memberIds.find((id) => id !== actor.id)!;
    const extraRelationship = Object.values(founded.world.relationships).find((relationship) => relationship.characterIds.includes(actor.id) && relationship.characterIds.includes(extraSpouseId))!;
    extraRelationship.kind = 'spouse';
    const beforeAffection = extraRelationship.affection;

    const dated = executeSupplementalDepth(founded.world, { verb: 'relationship.date_night', targetIds: [extraSpouseId], parameters: { amountCents: 12_000 } })!;
    expect(dated.world.characters[actor.id].partnerId).toBe('character-riley');
    expect(dated.world.relationships[extraRelationship.id].affection).toBeGreaterThan(beforeAffection);

    const separated = executeSupplementalDepth(dated.world, { verb: 'relationship.separate', targetIds: [extraSpouseId], parameters: {}, destructive: true }, true)!;
    expect(separated.world.characters[actor.id].partnerId).toBe('character-riley');
    expect(separated.world.relationships[extraRelationship.id].kind).not.toBe('spouse');
  });

  it('preserves the older generic takeover path when no hidden movement exists', () => {
    const world = createWorld({ seed: 'legacy-power-path', startAgeYears: 35, nowISO: '2026-01-01T00:00:00.000Z' });
    const result = executeSupplementalDepth(world, { verb: 'misconduct.faction_power_seizure_attempt', targetIds: [], parameters: {}, destructive: true }, true);
    expect(result).toBeNull();
  });
});
