import { normalizeFocusesForAge } from './ageProgression';
import { playerAgeYears } from './createWorld';
import { recordHistory } from './history';
import type { Character, Relationship, WorldState } from './types';

const YOUNG_CHILD_RELATIONSHIP_EVENT_TEMPLATES = new Set(['relationship.reconnect', 'story.family-reach-out']);
const INVALID_YOUNG_CHILD_CHOICE_TITLES = new Set(['Make actual time', 'Have a real call', 'Say you will catch up later', 'Make time', 'Keep some distance']);

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

function isParentRelationshipEvent(world: WorldState, participantIds: string[]): boolean {
  const actor = world.characters[world.playerCharacterId];
  return participantIds.some((id) => actor.parentIds.includes(id));
}

/**
 * Repairs saves created under the older adult-first rules. This intentionally
 * removes only relationship pressure that could not have been the child's
 * responsibility at the age it was created; birth, household, school, and
 * ordinary family history are left intact.
 */
export function normalizeAgeProgressionState(source: WorldState): WorldState {
  const sourceActor = source.characters[source.playerCharacterId];
  if (!sourceActor) return source;
  const age = playerAgeYears(source);
  const normalizedFocuses = normalizeFocusesForAge(age, sourceActor.focuses);
  const focusChanged = normalizedFocuses.length !== sourceActor.focuses.length || normalizedFocuses.some((focus, index) => focus !== sourceActor.focuses[index]);
  const staleParentRelationship = age < 8 && sourceActor.parentIds.some((parentId) => {
    const relationship = relationshipWith(source, sourceActor.id, parentId);
    return Boolean(relationship && relationship.lastInteractionWeek !== source.calendar.week);
  });
  const invalidThread = age < 8 && Object.values(source.memories).some((memory) => memory.unresolved && memory.category === 'Thread · Relationship' && memory.participantIds.some((id) => sourceActor.parentIds.includes(id)));
  const invalidEvent = source.events.some((event) => !event.resolved && YOUNG_CHILD_RELATIONSHIP_EVENT_TEMPLATES.has(event.templateId) && (age < 5 || (age < 8 && isParentRelationshipEvent(source, event.participantIds))));
  const invalidFeed = age < 5 && source.feed.some((entry) => INVALID_YOUNG_CHILD_CHOICE_TITLES.has(entry.title));

  if (!focusChanged && !staleParentRelationship && !invalidThread && !invalidEvent && !invalidFeed) return source;

  const world = clone(source);
  const actor = world.characters[world.playerCharacterId];
  actor.focuses = normalizedFocuses;

  if (age < 8) {
    for (const parentId of actor.parentIds) {
      const relationship = relationshipWith(world, actor.id, parentId);
      if (relationship) relationship.lastInteractionWeek = world.calendar.week;
    }

    for (const [id, memory] of Object.entries(world.memories)) {
      if (memory.unresolved && memory.category === 'Thread · Relationship' && memory.participantIds.some((participantId) => actor.parentIds.includes(participantId))) {
        delete world.memories[id];
      }
    }
  }

  world.events = world.events.filter((event) => {
    if (event.resolved || !YOUNG_CHILD_RELATIONSHIP_EVENT_TEMPLATES.has(event.templateId)) return true;
    if (age < 5) return false;
    if (age < 8 && isParentRelationshipEvent(world, event.participantIds)) return false;
    return true;
  });

  if (age < 5) {
    world.feed = world.feed.filter((entry) => !INVALID_YOUNG_CHILD_CHOICE_TITLES.has(entry.title));
    world.timeline = world.timeline.filter((entry) => !INVALID_YOUNG_CHILD_CHOICE_TITLES.has(entry.title));
    for (const [id, memory] of Object.entries(world.memories)) {
      if (memory.category.startsWith('Decision · relationship.reconnect') || memory.category.startsWith('Decision · story.family-reach-out')) delete world.memories[id];
    }
  }

  return world;
}

/**
 * Runs before the older simulation layers. Young children do not "forget" to
 * prioritize a parent or accidentally create a stale-contact thread; caregiver
 * presence drives those relationships until the player is old enough to own
 * more of their social life.
 */
export function prepareAgeProgressionAdvance(_before: WorldState, after: WorldState): WorldState {
  const world = normalizeAgeProgressionState(clone(after));
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
  if (weeks <= 0) return normalizeAgeProgressionState(after);
  const world = normalizeAgeProgressionState(clone(after));
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

  return normalizeAgeProgressionState(world);
}
