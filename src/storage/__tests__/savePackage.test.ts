import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';

import { createSaveArchive, decodeSaveArchive } from '../savePackage';

import { createWorld } from '@/engine/createWorld';
import { executeJourneyAction, personalProjects, tickLifeJourney } from '@/engine/lifeJourney';

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, value: string) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
    return `test-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  },
}));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }));
vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
}));
vi.mock('expo-sharing', () => ({ isAvailableAsync: vi.fn(), shareAsync: vi.fn() }));

describe('portable save package', () => {
  it('round-trips a valid world with a manifest and checksum', async () => {
    const world = createWorld({ seed: 'archive-roundtrip', startAgeYears: 18, nowISO: '2026-08-19T00:00:00.000Z' });
    const archive = await createSaveArchive(world);
    const decoded = await decodeSaveArchive(archive.bytes);
    expect(decoded).toEqual(world);
    expect(archive.manifest.databaseFile).toBe('world.json');
    expect(archive.manifest.displaySummary.playerName).toBe('Alex Mercer');
  });

  it('preserves project progress and its pending branch through export and import', async () => {
    let world = createWorld({ seed: 'journey-archive', startAgeYears: 30, nowISO: '2026-09-09T00:00:00.000Z' });
    world.events = [];
    world.characters[world.playerCharacterId].health = 95;
    world.characters[world.playerCharacterId].focuses = ['Health'];
    world = executeJourneyAction(world, { verb: 'life.choose_plan', parameters: { planId: 'craft' }, targetIds: [] })!.world;
    world = executeJourneyAction(world, { verb: 'life.project_start', parameters: { projectId: 'creative' }, targetIds: [] })!.world;
    for (let week = 0; week < 4; week += 1) { world.calendar.week += 1; tickLifeJourney(world); }
    const archive = await createSaveArchive(world);
    const decoded = await decodeSaveArchive(archive.bytes);
    expect(decoded).toEqual(world);
    expect(personalProjects(decoded)[0].completedWeeks).toBe(4);
    expect(decoded.events.some((event) => event.templateId.startsWith('project.checkpoint:') && !event.resolved)).toBe(true);
    expect(decoded.journey?.activePlans[decoded.playerCharacterId]).toBe('craft');
  });

  it('rejects a package whose world bytes no longer match the manifest checksum', async () => {
    const world = createWorld({ seed: 'archive-corruption', startAgeYears: 18, nowISO: '2026-08-19T00:00:00.000Z' });
    const archive = await createSaveArchive(world);
    const files = unzipSync(archive.bytes);
    const changed = JSON.parse(strFromU8(files['world.json']));
    changed.characters[changed.playerCharacterId].cashCents += 1_000_000;
    files['world.json'] = strToU8(JSON.stringify(changed));
    await expect(decodeSaveArchive(zipSync(files))).rejects.toThrow('checksum');
  });
});
