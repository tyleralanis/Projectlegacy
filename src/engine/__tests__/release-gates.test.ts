import { describe, expect, it, vi } from 'vitest';

import { assertWorldContentValid, eventIsAgeEligible } from '@/content/worldContent';
import { executeAction } from '@/engine/actions';
import { createWorld } from '@/engine/createWorld';
import { classifyIntentConfidence } from '@/engine/intentConfidence';
import { normalizeSimulationDetail } from '@/engine/performance';
import { advanceWorld, getActiveEvent, resolveEvent } from '@/engine/simulation';
import { searchWorld, toggleFavorite } from '@/engine/worldIndex';
import { MemoryGameRepository } from '@/storage/memoryRepository';

vi.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digestStringAsync: vi.fn(async () => 'test-checksum') }));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }));
vi.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', EncodingType: { Base64: 'base64' }, readAsStringAsync: vi.fn(), writeAsStringAsync: vi.fn() }));
vi.mock('expo-sharing', () => ({ isAvailableAsync: vi.fn(async () => false), shareAsync: vi.fn() }));

describe('first serious build release gates', () => {
  it('plays fourteen generations without any network dependency', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => { throw new Error('airplane mode'); }) as typeof fetch;
    try {
      let world = createWorld({ seed: 'airplane-fourteen-generations', startAgeYears: 110, nowISO: '2026-08-19T00:00:00.000Z' });
      for (let generation = 1; generation < 14; generation += 1) {
        const actor = world.characters[world.playerCharacterId];
        actor.birthWeek = world.calendar.week - 110 * 52;
        actor.health = 1;
        world = advanceWorld(world, 1, { interrupt: true, autoResolveEvents: true }).world;
        const event = getActiveEvent(world);
        expect(event?.templateId).toBe('dynasty.succession');
        world = resolveEvent(world, event!.id, event!.choices[0].id);
      }
      expect(world.dynasty.generation).toBe(14);
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(world.timeline.some((entry) => entry.category === 'dynasty')).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('keeps multiple slots and can roll a selected slot back', async () => {
    const repository = new MemoryGameRepository();
    await repository.initialize();
    const first = createWorld({ seed: 'slot-one', startAgeYears: 18, nowISO: '2026-08-19T00:00:00.000Z' });
    const second = createWorld({ seed: 'slot-two', startAgeYears: 22, nowISO: '2026-08-19T00:00:00.000Z' });
    await repository.saveWorld(first);
    await repository.saveWorld(second);
    const advanced = advanceWorld(first, 4, { interrupt: false, autoResolveEvents: true }).world;
    await repository.saveWorld(advanced);
    expect(await repository.listSaves()).toHaveLength(2);
    const checkpoint = (await repository.listCheckpoints(first.metadata.saveId))[0];
    const restored = await repository.rollbackToCheckpoint(first.metadata.saveId, checkpoint.id);
    expect(restored.calendar.week).toBe(first.calendar.week);
    expect((await repository.loadSave(second.metadata.saveId))?.playerCharacterId).toBe(second.playerCharacterId);
  });

  it('validates data catalogs and enforces age gates', () => {
    expect(() => assertWorldContentValid()).not.toThrow();
    expect(eventIsAgeEligible('family.new-child', 8)).toBe(false);
    expect(eventIsAgeEligible('family.new-child', 30)).toBe(true);
    expect(eventIsAgeEligible('politics.election', 16)).toBe(false);
    expect(eventIsAgeEligible('politics.election', 40)).toBe(true);
    const childWorld = createWorld({ seed: 'child-safety', startAgeYears: 12, nowISO: '2026-08-19T00:00:00.000Z' });
    expect(executeAction(childWorld, { verb: 'misconduct.bribery_attempt', targetIds: [], parameters: {}, destructive: true }, true).validation.valid).toBe(false);
  });

  it('ages distant NPC detail and stays inside memory budgets', () => {
    const world = createWorld({ seed: 'detail-budget', startAgeYears: 25, nowISO: '2026-08-19T00:00:00.000Z' });
    const template = world.characters['character-riley'];
    for (let index = 0; index < 400; index += 1) {
      const id = `background-${index}`;
      world.characters[id] = { ...JSON.parse(JSON.stringify(template)), id, firstName: `Background${index}`, householdId: `household-${id}`, parentIds: [], childIds: [], lastMeaningfulWeek: index };
    }
    for (let index = 0; index < world.performance.memoryLimit + 25; index += 1) {
      const id = `memory-budget-${index}`;
      world.memories[id] = { id, participantIds: [world.playerCharacterId], category: 'passing', week: index, valence: 0, importance: 1, permanent: false, unresolved: false, visibility: 'private', narrative: 'A low-priority passing interaction.' };
    }
    normalizeSimulationDetail(world);
    expect(Object.values(world.characters).filter((character) => character.detailTier === 'full').length).toBeLessThanOrEqual(world.performance.fullNpcLimit);
    expect(Object.values(world.characters).filter((character) => character.detailTier === 'standard').length).toBeLessThanOrEqual(world.performance.standardNpcLimit);
    expect(Object.keys(world.memories).length).toBe(world.performance.memoryLimit);
  });

  it('links university-era relationships, banking, companies, politics, scandal, and inheritance', () => {
    let world = createWorld({ seed: 'interconnected-world', startAgeYears: 22, nowISO: '2026-08-19T00:00:00.000Z' });
    const banker = world.characters['character-riley'];
    world.characters[world.playerCharacterId].cashCents = 100_000_000;
    let result = executeAction(world, { verb: 'business.create', targetIds: [], parameters: { name: 'Mercer Realty', amountCents: 20_000_000, sector: 'Real Estate' } });
    world = result.world;
    const business = Object.values(world.businesses)[0];
    business.valuationCents = 500_000_000;
    business.employees = 8_000;
    result = executeAction(world, { verb: 'business.raise_capital', targetIds: [business.id], parameters: { equityBps: 1_000, financierId: banker.id } }, true);
    expect(result.message).toContain(`${banker.firstName}'s banking network`);
    world = result.world;
    result = executeAction(world, { verb: 'politics.run_for_office', targetIds: [], parameters: { office: 'Harborview Council', amountCents: 500_000 } });
    expect(result.explanation?.factors.find((factor) => factor.label === 'Economic footprint')?.impact).toBe('positive');
    world = result.world;
    const child = world.characters['character-mara'];
    world.characters[world.playerCharacterId].childIds = [child.id];
    child.parentIds = [world.playerCharacterId];
    world.relationships['relationship-player-sibling'].kind = 'child';
    const gifted = executeAction(world, { verb: 'estate.designate_successor', targetIds: [child.id], parameters: {} });
    expect(gifted.world.dynasty.activeHeirId).toBe(child.id);
    expect(gifted.world.timeline.some((entry) => entry.category === 'business')).toBe(true);
  });

  it('searches and pins across the player world', () => {
    const world = createWorld({ seed: 'world-search', startAgeYears: 18, nowISO: '2026-08-19T00:00:00.000Z' });
    const friend = world.characters['character-riley'];
    expect(searchWorld(world, friend.firstName)[0].id).toBe(friend.id);
    expect(toggleFavorite(world, 'character', friend.id, `${friend.firstName} ${friend.lastName}`)).toBe(true);
    expect(searchWorld(world, friend.firstName)[0].pinned).toBe(true);
  });

  it('uses confidence to act, confirm meaning, or return to normal buttons', () => {
    expect(classifyIntentConfidence(0.91)).toBe('act');
    expect(classifyIntentConfidence(0.68)).toBe('confirm-meaning');
    expect(classifyIntentConfidence(0.31)).toBe('buttons');
  });
});
