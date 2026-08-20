import type { GameRepository } from './repository';
import { SQLiteGameRepository } from './sqliteRepository';

export async function createRepository(): Promise<GameRepository> {
  return new SQLiteGameRepository();
}
