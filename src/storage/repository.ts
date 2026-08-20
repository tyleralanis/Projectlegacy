import type { WorldState } from '@/engine/types';

export interface SaveSlotSummary {
  saveId: string;
  displayName: string;
  generation: number;
  playerName: string;
  week: number;
  updatedAt: string;
}

export interface RecoveryCheckpointSummary {
  id: number;
  saveId: string;
  createdAt: string;
  week: number;
  generation: number;
}

export interface GameRepository {
  initialize(): Promise<void>;
  loadLatest(): Promise<WorldState | null>;
  loadSave(saveId: string): Promise<WorldState | null>;
  listSaves(): Promise<SaveSlotSummary[]>;
  listCheckpoints(saveId: string): Promise<RecoveryCheckpointSummary[]>;
  rollbackToCheckpoint(saveId: string, checkpointId: number): Promise<WorldState>;
  saveWorld(world: WorldState): Promise<void>;
  deleteSave(saveId: string): Promise<void>;
  deleteAll(): Promise<void>;
  exportWorld(world: WorldState): Promise<string>;
  importWorld(): Promise<WorldState>;
}
