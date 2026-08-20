import * as SQLite from 'expo-sqlite';


import { migrationsAfter } from './migrations';
import type { GameRepository, RecoveryCheckpointSummary, SaveSlotSummary } from './repository';
import { checksumWorld, exportSavePackage, importSavePackage } from './savePackage';
import { migrateWorld } from './worldMigrations';

import { assertWorldValid } from '@/engine/invariants';
import type { WorldState } from '@/engine/types';

interface MetaRow {
  value: string;
}

interface SaveRow {
  save_id?: string;
  world_json: string;
  checksum: string;
  updated_at?: string;
}

interface CheckpointRow extends SaveRow {
  id: number;
  save_id: string;
  created_at: string;
}

export class SQLiteGameRepository implements GameRepository {
  private database: SQLite.SQLiteDatabase | null = null;

  private async db(): Promise<SQLite.SQLiteDatabase> {
    if (!this.database) this.database = await SQLite.openDatabaseAsync('project-legacy.db');
    return this.database;
  }

  async initialize(): Promise<void> {
    const db = await this.db();
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    await db.execAsync('CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
    const row = await db.getFirstAsync<MetaRow>("SELECT value FROM app_meta WHERE key = 'schema_version'");
    const currentVersion = row ? Number.parseInt(row.value, 10) : 0;
    for (const migration of migrationsAfter(currentVersion)) {
      await db.withExclusiveTransactionAsync(async (transaction) => {
        for (const statement of migration.statements) await transaction.execAsync(statement);
        await transaction.runAsync(
          "INSERT INTO app_meta(key, value) VALUES('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
          String(migration.version),
        );
      });
    }
  }

  async loadLatest(): Promise<WorldState | null> {
    const db = await this.db();
    const row = await db.getFirstAsync<SaveRow>('SELECT world_json, checksum FROM save_slots ORDER BY updated_at DESC LIMIT 1');
    if (!row) return null;
    if ((await checksumWorld(row.world_json)) === row.checksum) {
      return migrateWorld(JSON.parse(row.world_json));
    }
    const parsed = JSON.parse(row.world_json) as Partial<WorldState>;
    const saveId = parsed.metadata?.saveId;
    if (!saveId) throw new Error('The damaged save does not identify its recovery slot.');
    const checkpoint = await db.getFirstAsync<SaveRow>('SELECT world_json, checksum FROM recovery_checkpoints WHERE save_id = ? ORDER BY created_at DESC LIMIT 1', saveId);
    if (!checkpoint || (await checksumWorld(checkpoint.world_json)) !== checkpoint.checksum) throw new Error('The save and its recovery checkpoint are both invalid.');
    return migrateWorld(JSON.parse(checkpoint.world_json));
  }

  async loadSave(saveId: string): Promise<WorldState | null> {
    const db = await this.db();
    const row = await db.getFirstAsync<SaveRow>('SELECT world_json, checksum FROM save_slots WHERE save_id = ?', saveId);
    if (!row) return null;
    if ((await checksumWorld(row.world_json)) === row.checksum) return migrateWorld(JSON.parse(row.world_json));
    const checkpoint = await db.getFirstAsync<SaveRow>('SELECT world_json, checksum FROM recovery_checkpoints WHERE save_id = ? ORDER BY created_at DESC LIMIT 1', saveId);
    if (!checkpoint || (await checksumWorld(checkpoint.world_json)) !== checkpoint.checksum) throw new Error('The selected save and its recovery checkpoint are both invalid.');
    return migrateWorld(JSON.parse(checkpoint.world_json));
  }

  async listSaves(): Promise<SaveSlotSummary[]> {
    const db = await this.db();
    const rows = await db.getAllAsync<SaveRow>('SELECT save_id, world_json, checksum, updated_at FROM save_slots ORDER BY updated_at DESC');
    const saves: SaveSlotSummary[] = [];
    for (const row of rows) {
      if ((await checksumWorld(row.world_json)) !== row.checksum) continue;
      const world = migrateWorld(JSON.parse(row.world_json));
      const actor = world.characters[world.playerCharacterId];
      saves.push({ saveId: world.metadata.saveId, displayName: world.metadata.displayName, generation: world.dynasty.generation, playerName: `${actor.firstName} ${actor.lastName}`, week: world.calendar.week, updatedAt: row.updated_at ?? world.metadata.updatedAt });
    }
    return saves;
  }

  async listCheckpoints(saveId: string): Promise<RecoveryCheckpointSummary[]> {
    const db = await this.db();
    const rows = await db.getAllAsync<CheckpointRow>('SELECT id, save_id, world_json, checksum, created_at FROM recovery_checkpoints WHERE save_id = ? ORDER BY created_at DESC', saveId);
    const summaries: RecoveryCheckpointSummary[] = [];
    for (const row of rows) {
      if ((await checksumWorld(row.world_json)) !== row.checksum) continue;
      const world = migrateWorld(JSON.parse(row.world_json));
      summaries.push({ id: row.id, saveId: row.save_id, createdAt: row.created_at, week: world.calendar.week, generation: world.dynasty.generation });
    }
    return summaries;
  }

  async rollbackToCheckpoint(saveId: string, checkpointId: number): Promise<WorldState> {
    const db = await this.db();
    const row = await db.getFirstAsync<CheckpointRow>('SELECT id, save_id, world_json, checksum, created_at FROM recovery_checkpoints WHERE save_id = ? AND id = ?', saveId, checkpointId);
    if (!row || (await checksumWorld(row.world_json)) !== row.checksum) throw new Error('That recovery checkpoint is missing or damaged.');
    const world = migrateWorld(JSON.parse(row.world_json));
    world.metadata.updatedAt = new Date().toISOString();
    await this.saveWorld(world);
    return world;
  }

  async saveWorld(world: WorldState): Promise<void> {
    assertWorldValid(world);
    const db = await this.db();
    const worldJSON = JSON.stringify(world);
    const checksum = await checksumWorld(worldJSON);
    await db.withExclusiveTransactionAsync(async (transaction) => {
      const prior = await transaction.getFirstAsync<SaveRow>('SELECT world_json, checksum FROM save_slots WHERE save_id = ?', world.metadata.saveId);
      if (prior) {
        await transaction.runAsync(
          'INSERT INTO recovery_checkpoints(save_id, schema_version, world_json, checksum, created_at) VALUES (?, ?, ?, ?, ?)',
          world.metadata.saveId,
          world.metadata.schemaVersion,
          prior.world_json,
          prior.checksum,
          new Date().toISOString(),
        );
      }
      await transaction.runAsync(
        `INSERT INTO save_slots(save_id, schema_version, engine_version, content_version, world_seed, player_character_id, world_json, checksum, created_at, updated_at, display_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(save_id) DO UPDATE SET schema_version = excluded.schema_version, engine_version = excluded.engine_version,
           content_version = excluded.content_version, player_character_id = excluded.player_character_id, world_json = excluded.world_json,
           checksum = excluded.checksum, updated_at = excluded.updated_at, display_name = excluded.display_name`,
        world.metadata.saveId,
        world.metadata.schemaVersion,
        world.metadata.engineVersion,
        world.metadata.contentVersion,
        world.metadata.worldSeed,
        world.playerCharacterId,
        worldJSON,
        checksum,
        world.metadata.createdAt,
        world.metadata.updatedAt,
        world.metadata.displayName,
      );
      await transaction.runAsync(
        'DELETE FROM recovery_checkpoints WHERE id IN (SELECT id FROM recovery_checkpoints WHERE save_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET 3)',
        world.metadata.saveId,
      );
      const recent = world.feed.slice(0, 8);
      for (const entry of recent) {
        await transaction.runAsync(
          'INSERT OR IGNORE INTO event_journal(id, save_id, week, domain, important, payload_json) VALUES (?, ?, ?, ?, ?, ?)',
          entry.id,
          world.metadata.saveId,
          entry.week,
          entry.domain,
          entry.important ? 1 : 0,
          JSON.stringify(entry),
        );
      }
    });
  }

  async deleteSave(saveId: string): Promise<void> {
    const db = await this.db();
    await db.runAsync('DELETE FROM save_slots WHERE save_id = ?', saveId);
  }

  async deleteAll(): Promise<void> {
    const db = await this.db();
    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync('DELETE FROM event_journal; DELETE FROM recovery_checkpoints; DELETE FROM save_slots; DELETE FROM local_diagnostics;');
    });
  }

  async exportWorld(world: WorldState): Promise<string> {
    return exportSavePackage(world);
  }

  async importWorld(): Promise<WorldState> {
    const world = migrateWorld(await importSavePackage());
    world.metadata.updatedAt = new Date().toISOString();
    return world;
  }
}
