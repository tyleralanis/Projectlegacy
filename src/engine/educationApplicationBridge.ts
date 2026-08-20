import { allocateId, playerAgeYears } from './createWorld';
import { recordHistory } from './history';
import { nextRandom } from './random';
import type { ActionResult, IntentAction, WorldState } from './types';

import { WORLD_CONTENT } from '@/content/worldContent';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function blocked(source: WorldState, message: string): ActionResult {
  return { world: source, message, validation: { valid: false, reason: message, requiresConfirmation: false } };
}

function ok(world: WorldState, message: string): ActionResult {
  return { world, message, validation: { valid: true, requiresConfirmation: false } };
}

function roll(world: WorldState): number {
  const next = nextRandom(world.rngState);
  world.rngState = next.state;
  return next.value;
}

/**
 * The base education action correctly blocks stacking two active postsecondary
 * programs, but secondary school should not prevent a teenager from applying
 * ahead of graduation. This narrow bridge handles only that transition and
 * leaves every other education application on the existing authoritative path.
 */
export function executeSecondarySchoolApplication(source: WorldState, action: IntentAction): ActionResult | null {
  if (action.verb !== 'education.apply' || typeof action.parameters.universityId !== 'string') return null;
  const actor = source.characters[source.playerCharacterId];
  const secondary = Object.values(source.education).find((record) => record.characterId === actor.id && record.status === 'school');
  if (!secondary) return null;

  const university = WORLD_CONTENT.universities.find((item) => item.id === action.parameters.universityId);
  if (!university) return blocked(source, 'That school is not available.');
  if (playerAgeYears(source) < university.minimumAge) return blocked(source, `Applications open at age ${university.minimumAge}.`);
  const postsecondary = Object.values(source.education).find((record) => record.characterId === actor.id && ['accepted', 'higher', 'trade'].includes(record.status));
  if (postsecondary) return blocked(source, 'You already have an active postsecondary application or program.');

  const world = clone(source);
  const nextActor = world.characters[world.playerCharacterId];
  const nextSecondary = world.education[secondary.id];
  const gradeSignal = Math.max(-0.08, Math.min(0.12, (nextSecondary.recordedGrade - 72) / 180));
  const chance = Math.max(0.08, Math.min(0.96, 0.2 + nextActor.knowledge / 190 + nextActor.reputation.professional / 700 + nextActor.charisma / 1000 + gradeSignal - university.prestige / 250));
  if (roll(world) > chance) {
    recordHistory(world, 'education', `${university.name} declined the application`, 'Applying before graduation created a real admissions result without ending secondary school. The academic record can still improve before another cycle.', { subjectIds: [actor.id, secondary.id], importance: 2 });
    return ok(world, `${university.name} declined the application this cycle. You remain in secondary school and can keep building the record.`);
  }

  const id = allocateId(world, 'education');
  world.education[id] = {
    id,
    characterId: nextActor.id,
    institutionId: university.id,
    status: 'accepted',
    level: 'Undergraduate program',
    recordedGrade: nextSecondary.recordedGrade,
    knowledgeGain: nextActor.knowledge,
    prestige: university.prestige,
    network: university.network,
    tuitionCentsPerYear: university.tuitionCentsPerYear,
    manipulatedCredential: false,
  };
  recordHistory(world, 'education', `Accepted to ${university.name}`, 'The offer arrived before secondary school ended. Graduation still matters; the postsecondary place now waits as a real option rather than replacing school early.', { important: true, subjectIds: [actor.id, secondary.id, id], importance: 3 });
  return ok(world, `${university.name} accepted you. Finish secondary school, then decide whether the tuition and opportunity are worth taking.`);
}
