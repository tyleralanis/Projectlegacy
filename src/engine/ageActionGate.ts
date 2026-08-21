import { minimumAgeForWellnessVerb, wellnessAgeMessage } from './ageProgression';
import { playerAgeYears } from './createWorld';
import type { ActionResult, IntentAction, WorldState } from './types';

const WELLNESS_VERBS = new Set(['health.run', 'health.gym', 'health.join_gym', 'health.group_class', 'health.therapy', 'health.outdoors']);

export function executeAgeActionGate(source: WorldState, action: IntentAction): ActionResult | null {
  const age = playerAgeYears(source);

  if (WELLNESS_VERBS.has(action.verb)) {
    const minimumAge = minimumAgeForWellnessVerb(action.verb);
    if (age < minimumAge) {
      return {
        world: source,
        validation: { valid: false, requiresConfirmation: false, prerequisites: [`Reach age ${minimumAge}.`] },
        message: wellnessAgeMessage(action.verb, age),
      };
    }
  }

  if (age < 5 && action.verb.startsWith('relationship.')) {
    return {
      world: source,
      validation: { valid: false, requiresConfirmation: false },
      message: 'Caregivers handle relationships at this age.',
    };
  }

  return null;
}
