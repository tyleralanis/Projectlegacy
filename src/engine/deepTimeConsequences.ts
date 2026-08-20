import { allocateId } from './createWorld';
import { getTimeBudget } from './livingWorld';
import { getDeepTimeBudget } from './timeSystem';
import type { MemoryRecord, WorldState } from './types';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function upsert(world: WorldState, narrative: string, importance: number): void {
  const actor = world.characters[world.playerCharacterId];
  const existing = Object.values(world.memories).find((memory) => memory.category === 'System · Deep opportunity cost' && memory.participantIds.includes(actor.id));
  if (existing) {
    existing.narrative = narrative;
    existing.importance = Math.max(existing.importance, importance);
    existing.week = world.calendar.week;
    existing.unresolved = true;
    return;
  }
  const id = allocateId(world, 'memory');
  const memory: MemoryRecord = { id, participantIds: [actor.id], category: 'System · Deep opportunity cost', week: world.calendar.week, valence: -0.45, importance, permanent: false, unresolved: true, visibility: 'private', narrative };
  world.memories[id] = memory;
}

export function applyDeepTimeConsequences(before: WorldState, source: WorldState): WorldState {
  const weeks = Math.max(0, source.calendar.week - before.calendar.week);
  if (weeks <= 0) return source;
  const world = clone(source);
  const actor = world.characters[world.playerCharacterId];
  if (!actor?.isAlive) return world;

  const oldBudget = getTimeBudget(world);
  const deepBudget = getDeepTimeBudget(world);
  const extraOverload = Math.max(0, deepBudget.overloadHours - oldBudget.overloadHours);
  if (extraOverload <= 0) {
    const memory = Object.values(world.memories).find((item) => item.category === 'System · Deep opportunity cost' && item.participantIds.includes(actor.id) && item.unresolved);
    if (memory && deepBudget.overloadHours === 0) {
      memory.unresolved = false;
      memory.narrative = `${memory.narrative} Later, delegation or changing commitments brought the week back inside a sustainable range.`;
    }
    return world;
  }

  const extraRatio = extraOverload / Math.max(1, deepBudget.capacityHours);
  const pressure = Math.min(10, extraRatio * weeks * 0.34);
  actor.stress = clamp(actor.stress + pressure);
  actor.mood = clamp(actor.mood - pressure * 0.24);
  const protectedAreas = new Set(actor.focuses);

  const career = Object.values(world.careers).find((item) => item.characterId === actor.id && item.active);
  if (career && !protectedAreas.has('Job')) {
    career.performance = clamp(career.performance - pressure * 0.42);
    career.satisfaction = clamp(career.satisfaction - pressure * 0.3);
    career.promotionProgress = clamp((career.promotionProgress ?? 0) - pressure * 0.5);
  }

  const education = Object.values(world.education).find((item) => item.characterId === actor.id && ['school', 'higher', 'trade'].includes(item.status));
  if (education && !protectedAreas.has('Academics')) education.recordedGrade = clamp(education.recordedGrade - pressure * 0.5);

  if (!protectedAreas.has('Startup')) {
    for (const business of Object.values(world.businesses).filter((item) => item.active && (item.ownerId ?? item.founderId) === actor.id && !item.delegated)) {
      business.quality = clamp(business.quality - pressure * 0.14);
      business.culture = clamp((business.culture ?? 55) - pressure * 0.18);
      business.customerLoyalty = clamp((business.customerLoyalty ?? 50) - pressure * 0.08);
    }
  }

  if (!protectedAreas.has('Health')) actor.health = clamp(actor.health - pressure * (deepBudget.status === 'unsustainable' ? 0.18 : 0.06));
  if (!protectedAreas.has('Family') && !protectedAreas.has('Partner')) {
    for (const relationship of Object.values(world.relationships)) {
      if (!relationship.characterIds.includes(actor.id) || !['parent', 'child', 'sibling', 'partner', 'spouse', 'friend'].includes(relationship.kind)) continue;
      relationship.affection = clamp(relationship.affection - pressure * 0.12);
      relationship.resentment = clamp(relationship.resentment + pressure * 0.1);
    }
  }

  const top = deepBudget.commitments.slice(0, 5).map((item) => `${item.label} ${item.hours}h`).join(', ');
  upsert(world, `The richer schedule model finds ${deepBudget.committedHours} committed hours against roughly ${deepBudget.capacityHours} sustainable hours. ${extraOverload} of those overloaded hours come from complexity the simpler model did not see—things like products, locations, property administration, wealth administration, multiple relationships, organizations, or real job hours. Biggest demands: ${top}.`, deepBudget.status === 'unsustainable' ? 86 : 72);
  return world;
}
