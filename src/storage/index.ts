import { Platform } from 'react-native';

import type { GameRepository } from './repository';

export async function createRepository(): Promise<GameRepository> {
  if (Platform.OS === 'web') {
    const { MemoryGameRepository } = await import('./memoryRepository');
    return new MemoryGameRepository();
  }
  const { SQLiteGameRepository } = await import('./sqliteRepository');
  return new SQLiteGameRepository();
}
