import { executeAgeActionGate } from './ageActionGate';
import { applyAgeProgressionAdvance, prepareAgeProgressionAdvance } from './ageProgressionWorld';
import { executeCareerApplication } from './careerApplicationBridge';
import { applyContinuityPolish } from './continuityPolish';
import { applyDelegationAdvance, executeDelegationDepth, prepareDelegationAdvance } from './delegationDepth';
import { normalizeDelegatedWorld } from './delegationNormalize';
import { executeSecondarySchoolApplication } from './educationApplicationBridge';
import { applyLegalPolish } from './legalPolish';
import { applyLifeSystemsAdvance, executeLifeSystemsDepth } from './lifeSystemsDepth';
import { applyNarrativeDepth } from './narrativeDepth';
import { executeRebalancePolish } from './rebalancePolish';
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

export function executeSupplementalDepth(
  source: WorldState,
  action: IntentAction,
  confirmed = false,
): ActionResult | null {
  const ageGate = executeAgeActionGate(source, action);
  if (ageGate) return ageGate;
  const rebalance = executeRebalancePolish(source, action);
  if (rebalance) return rebalance;
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

/** Young children do not create adult priority or relationship problems. */
export function applySupplementalAdvance(before: WorldState, after: WorldState): WorldState {
  const aged = prepareAgeProgressionAdvance(before, after);
  const prepared = prepareDelegationAdvance(before, aged);
  const base = applyBaseSupplementalAdvance(before, prepared);
  const ageProgressed = applyAgeProgressionAdvance(before, base);
  const life = applyLifeSystemsAdvance(before, ageProgressed);
  const delegated = applyDelegationAdvance(before, life);
  const polished = applySystemPolishAdvance(before, delegated);
  const continuous = applyContinuityPolish(before, polished);
  const legal = applyLegalPolish(before, continuous);
  return applyNarrativeDepth(before, legal);
}
