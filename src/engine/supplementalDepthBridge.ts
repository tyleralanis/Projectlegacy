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
import { applySystemPolishAdvance } from './systemPolish';
import { executeSystemPolishAction } from './systemPolishActions';
import type { ActionResult, IntentAction, WorldState } from './types';

export { ceoCandidates, getTuitionBalance, hasGymMembership };
export { businessRunwayReserveCents, distributableBusinessCashCents, portfolioManagementFeeWeeklyCents, propertyManagerActive } from './delegationDepth';

export function normalizeSupplementalState(source: WorldState): WorldState {
  return normalizeDelegatedWorld(normalizeBaseSupplementalState(source));
}

/**
 * OTA-safe extension point for life systems that were added after the original
 * supplemental engine grew large. Existing verbs that needed better economics
 * or consequence modeling are intercepted first; no new menu-only duplicate
 * actions are required for the polish pass.
 */
export function executeSupplementalDepth(
  source: WorldState,
  action: IntentAction,
  confirmed = false,
): ActionResult | null {
  const polished = executeSystemPolishAction(source, action);
  if (polished) return polished;
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
 * followed by recurring life systems, owner/manager delegation, and a final
 * consistency pass for recurring cash yield, tuition years, career reviews,
 * managed leasing, CEO reports, and sports contracts.
 */
export function applySupplementalAdvance(before: WorldState, after: WorldState): WorldState {
  const prepared = prepareDelegationAdvance(before, after);
  const base = applyBaseSupplementalAdvance(before, prepared);
  const life = applyLifeSystemsAdvance(before, base);
  const delegated = applyDelegationAdvance(before, life);
  return applySystemPolishAdvance(before, delegated);
}
