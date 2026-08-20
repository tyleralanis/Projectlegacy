import { executeSecondarySchoolApplication } from './educationApplicationBridge';
import { applyLifeSystemsAdvance, executeLifeSystemsDepth } from './lifeSystemsDepth';
import {
  applySupplementalAdvance as applyBaseSupplementalAdvance,
  ceoCandidates,
  executeSupplementalDepth as executeBaseSupplementalDepth,
  getTuitionBalance,
  hasGymMembership,
  normalizeSupplementalState,
} from './supplementalDepth';
import type { ActionResult, IntentAction, WorldState } from './types';

export { ceoCandidates, getTuitionBalance, hasGymMembership, normalizeSupplementalState };

/**
 * OTA-safe extension point for life systems that were added after the original
 * supplemental engine grew large. Keeping the bridge tiny lets the app route
 * every player action through the newest local simulation without duplicating
 * the older tuition, CEO, relationship, faction, and track handlers.
 */
export function executeSupplementalDepth(
  source: WorldState,
  action: IntentAction,
  confirmed = false,
): ActionResult | null {
  const earlyApplication = executeSecondarySchoolApplication(source, action);
  if (earlyApplication) return earlyApplication;
  const systemic = executeLifeSystemsDepth(source, action);
  if (systemic) return systemic;
  return executeBaseSupplementalDepth(source, action, confirmed);
}

/**
 * Base supplemental effects run first. The systemic pass then consumes the
 * same before/after interval so lifestyle, advisor renewals, tenants,
 * development projects, sports careers, health pressure, and NPC education
 * all advance exactly once per player time jump.
 */
export function applySupplementalAdvance(before: WorldState, after: WorldState): WorldState {
  const base = applyBaseSupplementalAdvance(before, after);
  return applyLifeSystemsAdvance(before, base);
}
