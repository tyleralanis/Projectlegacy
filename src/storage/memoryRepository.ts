
import type { GameRepository, RecoveryCheckpointSummary, SaveSlotSummary } from './repository';
import { createSaveArchive, decodeSaveArchive } from './savePackage';

import type { WorldState } from '@/engine/types';

export class MemoryGameRepository implements GameRepository {
  private worlds = new Map<string, WorldState>();
  private checkpoints = new Map<string, { id: number; world: WorldState; createdAt: string }[]>();
  private nextCheckpointId = 1;

  async initialize(): Promise<void> {}

  async loadLatest(): Promise<WorldState | null> {
    const world = [...this.worlds.values()].sort((a, b) => b.metadata.updatedAt.localeCompare(a.metadata.updatedAt))[0];
    return world ? (JSON.parse(JSON.stringify(world)) as WorldState) : null;
  }

  async loadSave(saveId: string): Promise<WorldState | null> {
    const world = this.worlds.get(saveId);
    return world ? JSON.parse(JSON.stringify(world)) as WorldState : null;
  }

  async listSaves(): Promise<SaveSlotSummary[]> {
    return [...this.worlds.values()].sort((a, b) => b.metadata.updatedAt.localeCompare(a.metadata.updatedAt)).map((world) => {
      const actor = world.characters[world.playerCharacterId];
      return { saveId: world.metadata.saveId, displayName: world.metadata.displayName, generation: world.dynasty.generation, playerName: `${actor.firstName} ${actor.lastName}`, week: world.calendar.week, updatedAt: world.metadata.updatedAt };
    });
  }

  async listCheckpoints(saveId: string): Promise<RecoveryCheckpointSummary[]> {
    return (this.checkpoints.get(saveId) ?? []).map((checkpoint) => ({ id: checkpoint.id, saveId, createdAt: checkpoint.createdAt, week: checkpoint.world.calendar.week, generation: checkpoint.world.dynasty.generation }));
  }

  async rollbackToCheckpoint(saveId: string, checkpointId: number): Promise<WorldState> {
    const checkpoint = (this.checkpoints.get(saveId) ?? []).find((item) => item.id === checkpointId);
    if (!checkpoint) throw new Error('That recovery checkpoint no longer exists.');
    const world = JSON.parse(JSON.stringify(checkpoint.world)) as WorldState;
    world.metadata.updatedAt = new Date().toISOString();
    this.worlds.set(saveId, world);
    return JSON.parse(JSON.stringify(world)) as WorldState;
  }

  async saveWorld(world: WorldState): Promise<void> {
    const prior = this.worlds.get(world.metadata.saveId);
    if (prior) {
      const list = this.checkpoints.get(world.metadata.saveId) ?? [];
      list.unshift({ id: this.nextCheckpointId++, world: JSON.parse(JSON.stringify(prior)) as WorldState, createdAt: new Date().toISOString() });
      this.checkpoints.set(world.metadata.saveId, list.slice(0, 3));
    }
    this.worlds.set(world.metadata.saveId, JSON.parse(JSON.stringify(world)) as WorldState);
  }

  async deleteSave(saveId: string): Promise<void> {
    this.worlds.delete(saveId);
    this.checkpoints.delete(saveId);
  }

  async deleteAll(): Promise<void> {
    this.worlds.clear();
    this.checkpoints.clear();
  }

  async exportWorld(world: WorldState): Promise<string> {
    const archive = await createSaveArchive(world);
    return `memory://${archive.manifest.saveId}/${archive.bytes.byteLength}`;
  }

  async importWorld(): Promise<WorldState> {
    const world = await this.loadLatest();
    if (!world) throw new Error('There is no in-memory save to import.');
    const archive = await createSaveArchive(world);
    return decodeSaveArchive(archive.bytes);
  }
}
