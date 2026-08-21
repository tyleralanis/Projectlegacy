import { minimumAgeForWellnessVerb, wellnessAgeMessage } from './ageProgression';
import { playerAgeYears } from './createWorld';
import type { ActionResult, IntentAction, WorldState } from './types';

const WELLNESS_VERBS = new Set(['health.run', 'health.gym', 'health.join_gym', 'health.group_class', 'health.therapy', 'health.outdoors']);

function blocked(source: WorldState, message: string, prerequisite?: string): ActionResult {
  return {
    world: source,
    validation: { valid: false, requiresConfirmation: false, prerequisites: prerequisite ? [prerequisite] : undefined },
    message,
  };
}

export function executeAgeActionGate(source: WorldState, action: IntentAction): ActionResult | null {
  const age = playerAgeYears(source);
  const actor = source.characters[source.playerCharacterId];

  if (age < 5 && action.verb.startsWith('health.')) {
    return blocked(source, 'Your caregivers handle health decisions at this age.');
  }

  if (WELLNESS_VERBS.has(action.verb)) {
    const minimumAge = minimumAgeForWellnessVerb(action.verb);
    if (age < minimumAge) return blocked(source, wellnessAgeMessage(action.verb, age), `Reach age ${minimumAge}.`);
  }

  if (action.verb.startsWith('relationship.')) {
    if (age < 5) return blocked(source, 'Caregivers handle relationships at this age.');
    const targetId = action.targetIds[0];
    if (age < 8 && targetId && actor.parentIds.includes(targetId)) {
      return blocked(source, 'Your relationship with a parent is still mostly shaped by their caregiving and availability.');
    }
  }

  if (age < 18 && (action.verb.startsWith('property.') || action.verb.startsWith('markets.'))) {
    return blocked(source, 'Independent property and investing decisions open at 18.', 'Reach age 18.');
  }

  return null;
}
