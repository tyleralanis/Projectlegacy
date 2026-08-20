import { MemoryGameRepository } from './memoryRepository';
import type { GameRepository } from './repository';

export async function createRepository(): Promise<GameRepository> {
  return new MemoryGameRepository();
}
