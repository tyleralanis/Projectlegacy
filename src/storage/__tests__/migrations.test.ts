import { describe, expect, it } from 'vitest';


import { LATEST_SCHEMA_VERSION, MIGRATIONS, migrationsAfter } from '../migrations';
import { migrateWorld } from '../worldMigrations';

import { createWorld } from '@/engine/createWorld';

describe('SQLite and world migrations', () => {
  it('is sequential and reaches the declared latest version', () => {
    expect(MIGRATIONS.map((migration) => migration.version)).toEqual([1, 2, 3]);
    expect(MIGRATIONS.at(-1)?.version).toBe(LATEST_SCHEMA_VERSION);
    expect(migrationsAfter(0)).toHaveLength(3);
    expect(migrationsAfter(1).map((migration) => migration.version)).toEqual([2, 3]);
  });

  it('migrates a schema-1 snapshot without losing identity or world history', () => {
    const current = createWorld({ seed: 'migration-seed', startAgeYears: 18, nowISO: '2026-08-19T00:00:00.000Z' });
    const legacy = JSON.parse(JSON.stringify(current));
    legacy.metadata.schemaVersion = 1;
    delete legacy.metadata.nextSequence;
    delete legacy.metadata.displayName;
    delete legacy.settings.qualitativeRiskOnly;
    delete legacy.settings.highContrast;
    delete legacy.settings.autoDownloadUpdates;
    delete legacy.settings.developerUnlocked;
    delete legacy.timeline;
    delete legacy.favorites;
    delete legacy.intentHistory;
    delete legacy.countries;
    delete legacy.activeCountryId;
    delete legacy.background;
    delete legacy.performance;
    for (const character of Object.values(legacy.characters) as Record<string, unknown>[]) {
      delete character.detailTier;
      delete character.lastMeaningfulWeek;
    }
    legacy.feed.unshift({ id: 'legacy-history', week: 10, domain: 'life', title: 'Before migration', detail: 'This record must remain.', important: true });
    const migrated = migrateWorld(legacy);
    expect(migrated.metadata.schemaVersion).toBe(3);
    expect(migrated.metadata.worldSeed).toBe('migration-seed');
    expect(migrated.feed.some((entry) => entry.id === 'legacy-history')).toBe(true);
    expect(migrated.settings.qualitativeRiskOnly).toBe(true);
    expect(migrated.metadata.nextSequence).toBeGreaterThan(0);
    expect(migrated.timeline.some((entry) => entry.title === 'Before migration')).toBe(true);
    expect(migrated.countries[migrated.activeCountryId]).toBeDefined();
    expect(migrated.characters[migrated.playerCharacterId].detailTier).toBe('full');
  });
});
