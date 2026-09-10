import { netWorthCents } from './money';
import type { WorldState } from './types';

import { PERSONAL_PROJECTS } from '@/content/journeyCatalog';

export interface InvariantViolation {
  code: string;
  message: string;
  entityId?: string;
}

function finite(violations: InvariantViolation[], value: number, label: string, entityId?: string): void {
  if (!Number.isFinite(value)) violations.push({ code: 'non_finite', message: `${label} is not finite.`, entityId });
}

export function validateWorld(world: WorldState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  if (!world.characters[world.playerCharacterId]) violations.push({ code: 'missing_player', message: 'The active player character does not exist.' });
  if (!Number.isInteger(world.metadata.schemaVersion) || world.metadata.schemaVersion < 1) violations.push({ code: 'schema_version', message: 'Schema version is invalid.' });
  if (!world.metadata.worldSeed) violations.push({ code: 'missing_seed', message: 'The world seed is missing.' });
  finite(violations, world.calendar.week, 'Calendar week');
  finite(violations, world.economy.marketIndex, 'Market index');
  finite(violations, world.economy.housingIndex, 'Housing index');

  for (const character of Object.values(world.characters)) {
    finite(violations, character.cashCents, 'Character cash', character.id);
    for (const field of ['health', 'mood', 'stress', 'discipline', 'ambition', 'empathy', 'riskTolerance', 'ethics', 'knowledge', 'charisma', 'fitness'] as const) {
      finite(violations, character[field], `Character ${field}`, character.id);
      if (character[field] < 0 || character[field] > 100) violations.push({ code: 'bounded_stat', message: `${field} is outside 0-100.`, entityId: character.id });
    }
    for (const relativeId of [...character.parentIds, ...character.childIds]) {
      if (!world.characters[relativeId]) violations.push({ code: 'orphan_character_ref', message: `Character reference ${relativeId} does not exist.`, entityId: character.id });
    }
    for (const parentId of character.parentIds) {
      if (world.characters[parentId] && !world.characters[parentId].childIds.includes(character.id)) violations.push({ code: 'family_ref_mismatch', message: 'Parent and child references are not reciprocal.', entityId: character.id });
    }
    if (character.partnerId) {
      const partner = world.characters[character.partnerId];
      if (!partner) violations.push({ code: 'orphan_partner', message: 'Partner reference does not exist.', entityId: character.id });
      else if (partner.partnerId !== character.id) violations.push({ code: 'partner_ref_mismatch', message: 'Partner references are not reciprocal.', entityId: character.id });
    }
  }

  for (const relationship of Object.values(world.relationships)) {
    if (relationship.characterIds.some((id) => !world.characters[id])) violations.push({ code: 'orphan_relationship', message: 'Relationship references a missing character.', entityId: relationship.id });
    for (const field of ['trust', 'affection', 'respect', 'resentment'] as const) {
      finite(violations, relationship[field], `Relationship ${field}`, relationship.id);
      if (relationship[field] < 0 || relationship[field] > 100) violations.push({ code: 'bounded_relationship', message: `${field} is outside 0-100.`, entityId: relationship.id });
    }
  }
  for (const education of Object.values(world.education)) {
    if (!world.characters[education.characterId]) violations.push({ code: 'orphan_education_character', message: 'Education character is missing.', entityId: education.id });
    if (!world.organizations[education.institutionId]) violations.push({ code: 'orphan_education_institution', message: 'Education institution is missing.', entityId: education.id });
    finite(violations, education.recordedGrade, 'Education grade', education.id);
  }
  for (const career of Object.values(world.careers)) {
    if (!world.characters[career.characterId]) violations.push({ code: 'orphan_career_character', message: 'Career character is missing.', entityId: career.id });
    if (!world.organizations[career.employerId]) violations.push({ code: 'orphan_employer', message: 'Career employer is missing.', entityId: career.id });
  }
  for (const organization of Object.values(world.organizations)) {
    if (organization.memberIds.some((id) => !world.characters[id])) violations.push({ code: 'orphan_organization_member', message: 'Organization member is missing.', entityId: organization.id });
    if (organization.leaderId && !world.characters[organization.leaderId]) violations.push({ code: 'orphan_organization_leader', message: 'Organization leader is missing.', entityId: organization.id });
  }
  for (const business of Object.values(world.businesses)) {
    finite(violations, business.cashCents, 'Business cash', business.id);
    finite(violations, business.valuationCents, 'Business valuation', business.id);
    if (business.playerOwnershipBps < 0 || business.playerOwnershipBps > 10_000) violations.push({ code: 'ownership_bounds', message: 'Business ownership is outside 0-100%.', entityId: business.id });
    if (business.votingControlBps < 0 || business.votingControlBps > 10_000) violations.push({ code: 'control_bounds', message: 'Voting control is outside 0-100%.', entityId: business.id });
    if (!world.organizations[business.organizationId]) violations.push({ code: 'orphan_business_org', message: 'Business organization is missing.', entityId: business.id });
    if (!world.characters[business.founderId]) violations.push({ code: 'orphan_founder', message: 'Business founder is missing.', entityId: business.id });
    if (!world.characters[business.ownerId ?? business.founderId] && !world.organizations[business.ownerId ?? business.founderId]) violations.push({ code: 'orphan_business_owner', message: 'Business owner is missing.', entityId: business.id });
  }
  for (const property of Object.values(world.properties)) {
    finite(violations, property.valueCents, 'Property value', property.id);
    finite(violations, property.debtCents, 'Property debt', property.id);
    if (!world.characters[property.ownerId] && !world.organizations[property.ownerId]) violations.push({ code: 'orphan_property_owner', message: 'Property owner is missing.', entityId: property.id });
  }
  for (const holding of Object.values(world.holdings)) {
    if (!world.securities[holding.securityId]) violations.push({ code: 'orphan_security', message: 'Holding security is missing.', entityId: holding.id });
    if (!world.characters[holding.ownerId] && !world.organizations[holding.ownerId]) violations.push({ code: 'orphan_holding_owner', message: 'Holding owner is missing.', entityId: holding.id });
    if (holding.unitsMilli < 0) violations.push({ code: 'negative_holding', message: 'Holding units cannot be negative.', entityId: holding.id });
  }
  for (const liability of Object.values(world.liabilities)) {
    finite(violations, liability.principalCents, 'Liability principal', liability.id);
    if (liability.principalCents < 0) violations.push({ code: 'negative_liability', message: 'Liability principal cannot be negative.', entityId: liability.id });
    if (!world.characters[liability.debtorId] && !world.organizations[liability.debtorId] && !world.businesses[liability.debtorId]) violations.push({ code: 'orphan_debtor', message: 'Liability debtor is missing.', entityId: liability.id });
  }
  for (const legalCase of Object.values(world.legalCases)) {
    if (!world.characters[legalCase.characterId]) violations.push({ code: 'orphan_legal_character', message: 'Legal-case character is missing.', entityId: legalCase.id });
    if (!world.exposures[legalCase.exposureId]) violations.push({ code: 'orphan_legal_exposure', message: 'Legal-case evidence record is missing.', entityId: legalCase.id });
  }
  for (const event of world.events) {
    for (const participantId of event.participantIds) {
      if (!world.characters[participantId] && !world.organizations[participantId] && !world.businesses[participantId] && !world.properties[participantId]) {
        violations.push({ code: 'orphan_event_participant', message: `Event participant ${participantId} is missing.`, entityId: event.id });
      }
    }
  }
  finite(violations, netWorthCents(world), 'Player net worth', world.playerCharacterId);
  if (world.journey) {
    const projects = Object.values(world.journey.projects);
    if (projects.length > 120) violations.push({ code: 'project_limit', message: 'The project journal exceeds its limit.' });
    for (const [id, project] of Object.entries(world.journey.projects)) {
      const invalid = id !== project.id || !world.characters[project.characterId] || !PERSONAL_PROJECTS.some((item) => item.id === project.catalogId)
        || !['active', 'paused', 'completed', 'abandoned'].includes(project.status) || !['steady', 'stretch', 'shared'].includes(project.approach)
        || typeof project.checkpointHandled !== 'boolean' || typeof project.update !== 'string'
        || !Number.isInteger(project.hoursPerWeek) || project.hoursPerWeek < 1 || project.hoursPerWeek > 6
        || !Number.isInteger(project.durationWeeks) || project.durationWeeks < 1 || project.durationWeeks > 16
        || !Number.isInteger(project.completedWeeks) || project.completedWeeks < 0 || project.completedWeeks > project.durationWeeks
        || !Number.isInteger(project.startedWeek) || project.startedWeek < 0 || project.startedWeek > world.calendar.week
        || !Number.isInteger(project.lastProcessedWeek) || project.lastProcessedWeek < project.startedWeek || project.lastProcessedWeek > world.calendar.week
        || (project.completedWeek !== undefined && (!Number.isInteger(project.completedWeek) || project.completedWeek < project.startedWeek || project.completedWeek > world.calendar.week))
        || (project.status === 'completed' && (project.completedWeeks !== project.durationWeeks || project.completedWeek === undefined));
      if (invalid) violations.push({ code: 'invalid_personal_project', message: 'The personal project contains invalid progress or references.', entityId: id });
      if (['active', 'paused'].includes(project.status) && projects.filter((item) => item.characterId === project.characterId && ['active', 'paused'].includes(item.status)).length > 1) violations.push({ code: 'multiple_active_projects', message: 'A character can have only one unfinished personal project.', entityId: id });
    }
    const planIds = ['connections', 'independence', 'craft', 'career', 'community', 'legacy'];
    for (const [characterId, planId] of Object.entries(world.journey.activePlans)) {
      if (!world.characters[characterId] || !planIds.includes(planId)) violations.push({ code: 'invalid_life_plan', message: 'The selected life plan or character is invalid.' });
    }
    for (const [key, week] of Object.entries(world.journey.completedPlans)) {
      const split = key.lastIndexOf(':');
      if (!world.characters[key.slice(0, split)] || !planIds.includes(key.slice(split + 1)) || !Number.isInteger(week) || week < 0 || week > world.calendar.week) violations.push({ code: 'invalid_life_milestone', message: 'A recorded life milestone is invalid.' });
    }
    for (const [characterId, week] of Object.entries(world.journey.socialWeeks)) {
      if (!world.characters[characterId] || !Number.isInteger(week) || week < 0 || week > world.calendar.week) violations.push({ code: 'invalid_social_week', message: 'The social catch-up record is invalid.' });
    }
  }
  return violations;
}

export function assertWorldValid(world: WorldState): void {
  const violations = validateWorld(world);
  if (violations.length > 0) throw new Error(violations.map((item) => `${item.code}: ${item.message}`).join('\n'));
}
