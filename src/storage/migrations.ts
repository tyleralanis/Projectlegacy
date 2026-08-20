export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

export const LATEST_SCHEMA_VERSION = 3;

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_local_world_store',
    statements: [
      `CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS save_slots (
        save_id TEXT PRIMARY KEY NOT NULL,
        schema_version INTEGER NOT NULL,
        engine_version TEXT NOT NULL,
        content_version TEXT NOT NULL,
        world_seed TEXT NOT NULL,
        player_character_id TEXT NOT NULL,
        world_json TEXT NOT NULL,
        checksum TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS recovery_checkpoints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        save_id TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        world_json TEXT NOT NULL,
        checksum TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(save_id) REFERENCES save_slots(save_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS event_journal (
        id TEXT PRIMARY KEY NOT NULL,
        save_id TEXT NOT NULL,
        week INTEGER NOT NULL,
        domain TEXT NOT NULL,
        important INTEGER NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL,
        FOREIGN KEY(save_id) REFERENCES save_slots(save_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS local_entitlements (
        product_id TEXT PRIMARY KEY NOT NULL,
        status TEXT NOT NULL,
        verified_at TEXT NOT NULL,
        transaction_id TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS local_diagnostics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 2,
    name: 'recovery_and_history_indexes',
    statements: [
      'CREATE INDEX IF NOT EXISTS idx_checkpoints_save_created ON recovery_checkpoints(save_id, created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_event_journal_save_week ON event_journal(save_id, week DESC)',
      'CREATE INDEX IF NOT EXISTS idx_save_slots_updated ON save_slots(updated_at DESC)',
    ],
  },
  {
    version: 3,
    name: 'named_slots_and_long_term_history',
    statements: [
      "ALTER TABLE save_slots ADD COLUMN display_name TEXT NOT NULL DEFAULT 'Legacy save'",
      'CREATE INDEX IF NOT EXISTS idx_checkpoints_slot_id ON recovery_checkpoints(save_id, id DESC)',
    ],
  },
];

export function migrationsAfter(version: number): Migration[] {
  return MIGRATIONS.filter((migration) => migration.version > version).sort((a, b) => a.version - b.version);
}
