import { LATEST_SCHEMA_VERSION } from './migrations';

import { WORLD_CONTENT } from '@/content/worldContent';
import { assertWorldValid } from '@/engine/invariants';
import type { WorldState } from '@/engine/types';


type LegacyWorld = Partial<WorldState> & {
  metadata?: Partial<WorldState['metadata']>;
  settings?: Partial<WorldState['settings']>;
};

export function migrateWorld(input: unknown): WorldState {
  const world = JSON.parse(JSON.stringify(input)) as LegacyWorld;
  const version = world.metadata?.schemaVersion ?? 1;
  if (version > LATEST_SCHEMA_VERSION) throw new Error('This world was created by a newer schema version.');
  if (!world.metadata) throw new Error('The world metadata is missing.');

  if (version < 2) {
    world.metadata.nextSequence = world.metadata.nextSequence ?? 1000;
    world.metadata.generation = world.metadata.generation ?? world.dynasty?.generation ?? 1;
    world.settings = {
      hapticsEnabled: world.settings?.hapticsEnabled ?? true,
      reducedMotion: world.settings?.reducedMotion ?? false,
      enhancedAIEnabled: world.settings?.enhancedAIEnabled ?? true,
      qualitativeRiskOnly: world.settings?.qualitativeRiskOnly ?? true,
      highContrast: world.settings?.highContrast ?? false,
      autoDownloadUpdates: world.settings?.autoDownloadUpdates ?? true,
      developerUnlocked: world.settings?.developerUnlocked ?? false,
    };
    world.memories = world.memories ?? {};
    world.exposures = world.exposures ?? {};
    world.legalCases = world.legalCases ?? {};
    world.metadata.schemaVersion = 2;
  }

  if (version < 3) {
    const player = world.characters?.[world.playerCharacterId ?? ''];
    world.metadata.displayName = world.metadata.displayName ?? `${player?.firstName ?? 'Legacy'} ${player?.lastName ?? 'save'} · Generation ${world.dynasty?.generation ?? 1}`;
    const characters = world.characters ?? {};
    for (const character of Object.values(characters)) {
      character.detailTier = character.id === world.playerCharacterId ? 'full' : 'standard';
      character.lastMeaningfulWeek = world.calendar?.week ?? 0;
    }
    world.timeline = world.timeline ?? (world.feed ?? []).map((entry, index) => ({
      id: `migrated-timeline-${index}-${entry.id}`,
      week: entry.week,
      generation: world.dynasty?.generation ?? 1,
      category: entry.domain === 'family' || entry.domain === 'relationship' ? 'relationship' : entry.domain === 'markets' ? 'wealth' : entry.domain === 'geopolitics' || entry.domain === 'health' || entry.domain === 'reputation' || entry.domain === 'organization' ? 'world' : entry.domain === 'life' ? 'dynasty' : entry.domain,
      title: entry.title,
      detail: entry.detail,
      subjectIds: [world.playerCharacterId ?? ''].filter(Boolean),
      importance: entry.important ? 4 : 2,
    }));
    world.favorites = world.favorites ?? [];
    world.intentHistory = world.intentHistory ?? [];
    world.countries = world.countries ?? Object.fromEntries(WORLD_CONTENT.countries.map((country) => [country.id, { ...country }]));
    world.activeCountryId = world.activeCountryId ?? WORLD_CONTENT.countries[0].id;
    const country = world.countries[world.activeCountryId] ?? WORLD_CONTENT.countries[0];
    world.background = world.background ?? {
      population: country.population,
      households: Math.round(country.population / 2.42),
      businesses: Math.round(country.population / 31),
      industries: Object.fromEntries(WORLD_CONTENT.businessSectors.map((sector) => [sector.id, { outputIndex: 100, employment: Math.round(country.population * sector.laborIntensity * 0.04), confidence: 50 }])),
      lastAggregateWeek: world.calendar?.week ?? 0,
    };
    world.performance = world.performance ?? {
      fullNpcLimit: WORLD_CONTENT.performance.fullNpcLimit,
      standardNpcLimit: WORLD_CONTENT.performance.standardNpcLimit,
      memoryLimit: WORLD_CONTENT.performance.memoryLimit,
      timelineLimit: WORLD_CONTENT.performance.timelineLimit,
      intentLogLimit: WORLD_CONTENT.performance.intentLogLimit,
    };
    world.settings = {
      hapticsEnabled: world.settings?.hapticsEnabled ?? true,
      reducedMotion: world.settings?.reducedMotion ?? false,
      enhancedAIEnabled: world.settings?.enhancedAIEnabled ?? true,
      qualitativeRiskOnly: world.settings?.qualitativeRiskOnly ?? true,
      highContrast: world.settings?.highContrast ?? false,
      autoDownloadUpdates: world.settings?.autoDownloadUpdates ?? true,
      developerUnlocked: world.settings?.developerUnlocked ?? false,
    };
    world.metadata.schemaVersion = 3;
  }

  const migrated = world as WorldState;
  for (const business of Object.values(migrated.businesses)) business.ownerId ??= business.founderId;
  assertWorldValid(migrated);
  return migrated;
}
