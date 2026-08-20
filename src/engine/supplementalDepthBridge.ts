import { executeCareerApplication } from './careerApplicationBridge';
import { applyDelegationAdvance, executeDelegationDepth, prepareDelegationAdvance } from './delegationDepth';
import { normalizeDelegatedWorld } from './delegationNormalize';
import { executeSecondarySchoolApplication } from './educationApplicationBridge';
import { applyLifeSystemsAdvance, executeLifeSystemsDepth } from './lifeSystemsDepth';
import {
  applySupplementalAdvance as applyBaseSupplementalAdvance,
  ceoCandidates,
  executeSupplementalDepth as executeBaseSupplementalDepth,
  getTuitionBalance,
  hasGymMembership,
  normalizeSupplementalState as normalizeBaseSupplementalState,
} from './supplementalDepth';
import type { ActionResult, IntentAction, WorldState } from './types';

export { ceoCandidates, getTuitionBalance, hasGymMembership };
export { businessRunwayReserveCents, distributableBusinessCashCents, portfolioManagementFeeWeeklyCents, propertyManagerActive } from './delegationDepth';

export function normalizeSupplementalState(source: WorldState): WorldState {
  return normalizeDelegatedWorld(normalizeBaseSupplementalState(source));
}

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
  const careerApplication = executeCareerApplication(source, action);
  if (careerApplication) return careerApplication;
  const delegated = executeDelegationDepth(source, action);
  if (delegated) return delegated;
  const systemic = executeLifeSystemsDepth(source, action);
  if (systemic) return systemic;
  return executeBaseSupplementalDepth(source, action, confirmed);
}

/**
 * Renewal state is prepared before the older supplemental pass so legacy
 * expiry logic sees a paid-forward membership. Base systems then run once,
 * followed by recurring life systems and finally owner/manager delegation.
 */
export function applySupplementalAdvance(before: WorldState, after: WorldState): WorldState {
  const prepared = prepareDelegationAdvance(before, after);
  const base = applyBaseSupplementalAdvance(before, prepared);
  const life = applyLifeSystemsAdvance(before, base);
  return applyDelegationAdvance(before, life);
}
