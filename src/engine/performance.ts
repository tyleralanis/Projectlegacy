import type { Character, WorldState } from './types';

function relatedToPlayer(world: WorldState, character: Character): boolean {
  const actor = world.characters[world.playerCharacterId];
  return character.id === actor.id || actor.parentIds.includes(character.id) || actor.childIds.includes(character.id) || actor.partnerId === character.id;
}

export function normalizeSimulationDetail(world: WorldState): void {
  const ranked = Object.values(world.characters).sort((a, b) => {
    const aPriority = relatedToPlayer(world, a) ? 1_000_000 : a.lastMeaningfulWeek;
    const bPriority = relatedToPlayer(world, b) ? 1_000_000 : b.lastMeaningfulWeek;
    return bPriority - aPriority;
  });
  ranked.forEach((character, index) => {
    character.detailTier = index < world.performance.fullNpcLimit ? 'full' : index < world.performance.fullNpcLimit + world.performance.standardNpcLimit ? 'standard' : 'statistical';
  });

  const memories = Object.values(world.memories);
  if (memories.length > world.performance.memoryLimit) {
    const removable = memories
      .filter((memory) => !memory.permanent && !memory.unresolved)
      .sort((a, b) => a.importance - b.importance || a.week - b.week);
    for (const memory of removable.slice(0, memories.length - world.performance.memoryLimit)) delete world.memories[memory.id];
  }
}

export function updateBackgroundStatistics(world: WorldState): void {
  if (world.calendar.week - world.background.lastAggregateWeek < 4) return;
  const growth = world.economy.growth;
  world.background.population = Math.max(1, Math.round(world.background.population * (1 + (0.004 + growth * 0.08) / 13)));
  world.background.households = Math.round(world.background.population / 2.42);
  world.background.businesses = Math.max(1, Math.round(world.background.businesses * (1 + growth / 13)));
  for (const industry of Object.values(world.background.industries)) {
    industry.outputIndex = Math.max(20, industry.outputIndex * (1 + growth / 13));
    industry.employment = Math.max(0, Math.round(industry.employment * (1 + (growth - world.economy.unemployment * 0.02) / 13)));
    industry.confidence = Math.max(0, Math.min(100, industry.confidence + growth * 16 - world.economy.unemployment * 0.3));
  }
  world.background.lastAggregateWeek = world.calendar.week;
}

export function shouldSimulateNpcThisWeek(world: WorldState, character: Character): boolean {
  if (character.detailTier === 'full') return true;
  if (character.detailTier === 'standard') return world.calendar.week % 4 === 0;
  return world.calendar.week % 52 === Math.abs(character.birthWeek) % 52;
}
