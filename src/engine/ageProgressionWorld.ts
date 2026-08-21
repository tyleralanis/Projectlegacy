import { normalizeFocusesForAge } from './ageProgression';
import { playerAgeYears } from './createWorld';
import { recordHistory } from './history';
import type { Character, Relationship, WorldState } from './types';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function ageAtWeek(character: Character, week: number): number {
  return Math.max(0, Math.floor((week - character.birthWeek) / 52));
}

function relationshipWith(world: WorldState, leftId: string, rightId: string): Relationship | undefined {
  return Object.values(world.relationships).find((relationship) => relationship.characterIds.includes(leftId) && relationship.characterIds.includes(rightId));
}

function activeCareer(world: WorldState, characterId: string) {
  return Object.values(world.careers).find((career) => career.characterId === characterId && career.active);
}

function crossedAge(before: WorldState, after: WorldState, age: number): boolean {
  const actor = after.characters[after.playerCharacterId];
  if (!actor) return false;
  return ageAtWeek(actor, before.calendar.week) < age && ageAtWeek(actor, after.calendar.week) >= age;
}

function crossedYearBoundary(before: WorldState, after: WorldState): boolean {
  return Math.floor(before.calendar.week / 52) < Math.floor(after.calendar.week / 52);
}

function caregiverAvailability(world: WorldState, parent: Character): { score: number; reason: 'present' | 'work' | 'separate' } {
  const actor = world.characters[world.playerCharacterId];
  const sameHousehold = parent.householdId === actor.householdId;
  const career = activeCareer(world, parent.id);
  const hours = career?.hoursPerWeek ?? (career ? 40 : 0);
  const workHeavy = Boolean(career && (hours >= 50 || parent.focuses.includes('Job')));
  const stressPenalty = Math.max(0, parent.stress - 60) / 100;

  if (!sameHousehold) return { score: Math.max(0.15, 0.38 - stressPenalty), reason: 'separate' };
  if (workHeavy) return { score: Math.max(0.42, 0.68 - stressPenalty), reason: 'work' };
  return { score: Math.max(0.65, 0.92 - stressPenalty), reason: 'present' };
}

/**
 * Runs before the older simulation layers. Young children do not "forget" to
 * prioritize a parent or accidentally create a stale-contact thread; caregiver
 * presence drives those relationships until the player is old enough to own
 * more of their social life.
 */
export function prepareAgeProgressionAdvance(_before: WorldState, after: WorldState): WorldState {
  const world = clone(after);
  const actor = world.characters[world.playerCharacterId];
  if (!actor) return world;
  const age = playerAgeYears(world);
  actor.focuses = normalizeFocusesForAge(age, actor.focuses);

  if (age < 8) {
    for (const parentId of actor.parentIds) {
      const relationship = relationshipWith(world, actor.id, parentId);
      if (relationship) relationship.lastInteractionWeek = world.calendar.week;
    }
  }
  return world;
}

/** Applies caregiver-driven childhood relationship consequences and age gates. */
export function applyAgeProgressionAdvance(before: WorldState, after: WorldState): WorldState {
  const weeks = Math.max(0, after.calendar.week - before.calendar.week);
  if (weeks <= 0) return after;
  const world = clone(after);
  const actor = world.characters[world.playerCharacterId];
  if (!actor) return world;
  const age = playerAgeYears(world);
  actor.focuses = normalizeFocusesForAge(age, actor.focuses);

  if (age < 8) {
    for (const parentId of actor.parentIds) {
      const parent = world.characters[parentId];
      const relationship = relationshipWith(world, actor.id, parentId);
      if (!parent?.isAlive || !relationship) continue;
      const availability = caregiverAvailability(world, parent);
      relationship.lastInteractionWeek = world.calendar.week;

      if (availability.reason === 'present') {
        relationship.trust = clamp(relationship.trust + Math.min(4, weeks * 0.03 * availability.score));
        relationship.affection = clamp(relationship.affection + Math.min(5, weeks * 0.04 * availability.score));
        relationship.resentment = clamp(relationship.resentment - Math.min(2, weeks * 0.02));
      } else if (availability.reason === 'work') {
        relationship.trust = clamp(relationship.trust + Math.min(2, weeks * 0.012));
        relationship.affection = clamp(relationship.affection + Math.min(2, weeks * 0.014));
      } else {
        relationship.trust = clamp(relationship.trust - Math.min(3, weeks * 0.018));
        relationship.affection = clamp(relationship.affection - Math.min(3, weeks * 0.015));
        actor.stress = clamp(actor.stress + Math.min(2, weeks * 0.01));
      }

      if (crossedYearBoundary(before, world) && availability.reason !== 'present') {
        if (availability.reason === 'work') {
          recordHistory(world, 'family', `${parent.firstName} was around less`, 'Work kept them away more than usual.', { subjectIds: [actor.id, parent.id], importance: 2 });
        } else {
          recordHistory(world, 'family', `${parent.firstName} lived apart`, 'Living in different households limited everyday time together.', { subjectIds: [actor.id, parent.id], importance: 2 });
        }
      }
    }
  }

  if (crossedAge(before, world, 15)) {
    recordHistory(world, 'life', 'Driving is coming up', 'You can start driver training now and be ready at 16.', { subjectIds: [actor.id], importance: 3 });
  }

  return world;
}
