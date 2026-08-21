import { executeAgeActionGate } from './ageActionGate';
import { applyAgeProgressionAdvance, normalizeAgeProgressionState, prepareAgeProgressionAdvance } from './ageProgressionWorld';
import { executeCareerApplication } from './careerApplicationBridge';
import { applyContinuityPolish } from './continuityPolish';
import { applyDelegationAdvance, executeDelegationDepth, prepareDelegationAdvance } from './delegationDepth';
import { normalizeDelegatedWorld } from './delegationNormalize';
import { executeSecondarySchoolApplication } from './educationApplicationBridge';
import { applyFactionPolishAdvance, executeFactionPolish } from './factionPolish';
import { applyFinanceEducationAdvance, executeFinanceEducationPolish, normalizeFinanceEducationState } from './financeEducationPolish';
import { applyLegalPolish } from './legalPolish';
import { applyLifeSystemsAdvance, executeLifeSystemsDepth } from './lifeSystemsDepth';
import { applyNarrativeDepth } from './narrativeDepth';
import { executePropertyPolishAction } from './propertyPolishActions';
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
import { applyWealthLifestyleAdvance, executeWealthLifestyleAction, normalizeWealthLifestyleState } from './wealthLifestyle';

export { ceoCandidates, getTuitionBalance, hasGymMembership };
export { businessRunwayReserveCents, distributableBusinessCashCents, portfolioManagementFeeWeeklyCents, propertyManagerActive } from './delegationDepth';
export { hasActiveLicense, licenseFor } from './wealthLifestyle';

export function normalizeSupplementalState(source: WorldState): WorldState {
  const base = normalizeBaseSupplementalState(source);
  const financed = normalizeFinanceEducationState(base);
  const delegated = normalizeDelegatedWorld(financed);
  const lifestyle = normalizeWealthLifestyleState(delegated);
  return normalizeAgeProgressionState(lifestyle);
}

export function executeSupplementalDepth(
  source: WorldState,
  action: IntentAction,
  confirmed = false,
): ActionResult | null {
  const ageGate = executeAgeActionGate(source, action);
  if (ageGate) return ageGate;
  const lifestyle = executeWealthLifestyleAction(source, action);
  if (lifestyle) return lifestyle;
  const property = executePropertyPolishAction(source, action);
  if (property) return property;
  const financeEducation = executeFinanceEducationPolish(source, action, confirmed);
  if (financeEducation) return financeEducation;
  const faction = executeFactionPolish(source, action, confirmed);
  if (faction) return faction;
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
  const lifestyle = applyWealthLifestyleAdvance(before, ageProgressed);
  const life = applyLifeSystemsAdvance(before, lifestyle);
  const delegated = applyDelegationAdvance(before, life);
  const faction = applyFactionPolishAdvance(before, delegated);
  const polished = applySystemPolishAdvance(before, faction);
  const continuous = applyContinuityPolish(before, polished);
  const legal = applyLegalPolish(before, continuous);
  const financed = applyFinanceEducationAdvance(before, legal);
  return normalizeAgeProgressionState(applyNarrativeDepth(before, financed));
}