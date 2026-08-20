
import { allocateId, playerAgeYears } from './createWorld';
import { explain, recordHistory } from './history';
import { clampCents } from './money';
import { nextRandom } from './random';
import type { ActionResult, ActionValidation, Domain, IntentAction, OutcomeExplanation, WorldState } from './types';

import { actionDefinition } from '@/content/actionCatalog';
import { WORLD_CONTENT } from '@/content/worldContent';

function cloneWorld(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world)) as WorldState;
}

function amount(parameters: IntentAction['parameters'], key = 'amountCents'): number {
  const value = parameters[key];
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
}

function player(world: WorldState) {
  return world.characters[world.playerCharacterId];
}

function findOwnedBusiness(world: WorldState, targetIds: string[]) {
  return targetIds.map((id) => world.businesses[id]).find((item) => (item?.ownerId ?? item?.founderId) === world.playerCharacterId && item.active && item.playerOwnershipBps > 0);
}

function findOwnedProperty(world: WorldState, targetIds: string[]) {
  return targetIds.map((id) => world.properties[id]).find((item) => item?.ownerId === world.playerCharacterId);
}

export function validateAction(world: WorldState, action: IntentAction): ActionValidation {
  const definition = actionDefinition(action.verb);
  const actor = player(world);
  if (!definition) {
    return { valid: false, reason: 'That action is not supported by the current engine.', prerequisites: ['Choose a registered action.'], requiresConfirmation: false };
  }
  if (!actor?.isAlive) {
    return { valid: false, reason: 'The active character cannot act.', prerequisites: ['Resolve succession.'], requiresConfirmation: false };
  }
  const requiresConfirmation = Boolean(action.destructive || definition.destructive || definition.confirmationMandatory);
  const cashRequired = amount(action.parameters);
  if (cashRequired < 0) return { valid: false, reason: 'The amount cannot be negative.', requiresConfirmation };
  if (cashRequired > actor.cashCents && !['business.borrow', 'property.refinance'].includes(action.verb)) {
    return { valid: false, reason: 'There is not enough liquid cash.', prerequisites: ['Raise cash, sell an asset, or lower the amount.'], requiresConfirmation };
  }
  if (['relationship.transfer_cash', 'business.contribute_capital', 'organization.fund'].includes(action.verb) && cashRequired <= 0) {
    return { valid: false, reason: 'Enter a positive amount for this transfer.', requiresConfirmation };
  }
  if (action.verb === 'business.create') {
    if (playerAgeYears(world) < 16) return { valid: false, reason: 'The character is not old enough to found a business.', prerequisites: ['Reach age 16.'], requiresConfirmation };
    const plannedCapital = Math.max(100_000, cashRequired || Math.min(actor.cashCents, 500_000));
    if (plannedCapital > actor.cashCents) return { valid: false, reason: 'A new business needs at least $1,000.00 in liquid starting capital.', prerequisites: ['Save at least $1,000.00.'], requiresConfirmation };
  }
  if (action.verb.startsWith('business.') && action.verb !== 'business.create' && !findOwnedBusiness(world, action.targetIds)) {
    return { valid: false, reason: 'Choose an active business you own or control.', prerequisites: ['Own or found a business.'], requiresConfirmation };
  }
  const ownedBusiness = findOwnedBusiness(world, action.targetIds);
  if (action.verb === 'business.hire' && ownedBusiness) {
    const hiringCost = Math.max(1, Math.min(500, amount(action.parameters, 'count') || 1)) * 90_000;
    if (hiringCost > ownedBusiness.cashCents) return { valid: false, reason: 'The business does not have enough cash for that hiring plan.', prerequisites: ['Add capital or borrow first.'], requiresConfirmation };
  }
  if (action.verb === 'business.delegate' && ownedBusiness && ownedBusiness.cashCents < 250_000) {
    return { valid: false, reason: 'The business needs $2,500.00 in cash to install management.', prerequisites: ['Build business runway first.'], requiresConfirmation };
  }
  if (action.verb.startsWith('property.') && action.verb !== 'property.buy' && !findOwnedProperty(world, action.targetIds)) {
    return { valid: false, reason: 'Choose a property you own.', prerequisites: ['Purchase a property first.'], requiresConfirmation };
  }
  if (action.verb === 'career.quit' || action.verb === 'career.request_raise') {
    const activeCareer = Object.values(world.careers).some((career) => career.characterId === actor.id && career.active);
    if (!activeCareer) return { valid: false, reason: 'There is no active job for that action.', prerequisites: ['Find employment.'], requiresConfirmation };
  }
  if (action.verb.startsWith('relationship.') && action.verb !== 'relationship.separate') {
    const targetId = action.targetIds[0];
    const target = world.characters[targetId];
    const relationship = Object.values(world.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(targetId));
    if (!target?.isAlive || target.id === actor.id || !relationship) return { valid: false, reason: 'Choose another living person with an established relationship.', prerequisites: ['Select a known person.'], requiresConfirmation };
    if (action.verb === 'relationship.date') {
      if (playerAgeYears(world) < 16 || Math.floor((world.calendar.week - target.birthWeek) / 52) < 16) return { valid: false, reason: 'Both characters must be old enough to date.', prerequisites: ['Reach age 16.'], requiresConfirmation };
      if (actor.partnerId || target.partnerId) return { valid: false, reason: 'One of the characters already has a partner.', requiresConfirmation };
      if (['parent', 'child', 'sibling'].includes(relationship.kind)) return { valid: false, reason: 'Choose an eligible non-family relationship.', requiresConfirmation };
    }
    if (action.verb === 'relationship.propose') {
      if (actor.partnerId || target.partnerId) return { valid: false, reason: 'One of the characters already has a partner.', requiresConfirmation };
      if (relationship.kind !== 'partner') return { valid: false, reason: 'A committed partnership must exist before marriage.', prerequisites: ['Build the relationship and begin dating first.'], requiresConfirmation };
      if (relationship.affection < 55 || relationship.trust < 45) return { valid: false, reason: 'The relationship is not ready for a proposal.', prerequisites: ['Build affection and trust.'], requiresConfirmation };
    }
  }
  if (action.verb === 'relationship.separate') {
    const targetId = actor.partnerId ?? action.targetIds[0];
    if (!targetId || actor.partnerId !== targetId) return { valid: false, reason: 'There is no active partnership to end.', requiresConfirmation };
  }
  if (action.verb === 'education.apply') {
    if (playerAgeYears(world) < 16) return { valid: false, reason: 'The character is not old enough for this application.', prerequisites: ['Reach age 16.'], requiresConfirmation };
    const openRecord = Object.values(world.education).some((record) => record.characterId === actor.id && !['completed', 'withdrawn'].includes(record.status));
    if (openRecord) return { valid: false, reason: 'Finish, enroll in, or withdraw from the current education path first.', requiresConfirmation };
  }
  if (action.verb === 'education.enroll') {
    const accepted = action.targetIds.map((id) => world.education[id]).find((record) => record?.characterId === actor.id && record.status === 'accepted')
      ?? Object.values(world.education).find((record) => record.characterId === actor.id && record.status === 'accepted');
    if (!accepted) return { valid: false, reason: 'There is no accepted education offer to enroll in.', prerequisites: ['Apply and receive an offer first.'], requiresConfirmation };
  }
  if (action.verb === 'education.withdraw') {
    const active = Object.values(world.education).some((record) => record.characterId === actor.id && !['completed', 'withdrawn'].includes(record.status));
    if (!active) return { valid: false, reason: 'There is no active education path to withdraw from.', requiresConfirmation };
  }
  if (action.verb === 'politics.run_for_office') {
    if (playerAgeYears(world) < 18) return { valid: false, reason: 'The character is not old enough to run.', prerequisites: ['Reach adulthood.'], requiresConfirmation };
    if (world.politics[actor.id]?.campaign) return { valid: false, reason: 'A campaign is already active.', prerequisites: ['Finish the current election.'], requiresConfirmation };
  }
  if (action.verb.startsWith('misconduct.') && playerAgeYears(world) < Math.min(...WORLD_CONTENT.laws.filter((law) => law.abstractOnly).map((law) => law.minimumAge))) {
    return { valid: false, reason: 'Dangerous and illegal strategic systems are gated to adult characters and remain abstract.', prerequisites: ['Reach adulthood.'], requiresConfirmation };
  }
  if (action.verb === 'politics.policy_action' && (world.politics[actor.id]?.authority ?? 0) < 1) {
    return { valid: false, reason: 'This character does not hold an office with that authority.', prerequisites: ['Win or receive an eligible office.'], requiresConfirmation };
  }
  if (action.verb === 'politics.campaign_action' && !world.politics[actor.id]?.campaign) {
    return { valid: false, reason: 'There is no active campaign.', prerequisites: ['Begin a campaign first.'], requiresConfirmation };
  }
  if (action.verb.startsWith('legal.')) {
    const activeCase = Object.values(world.legalCases).some((legalCase) => legalCase.characterId === actor.id && legalCase.stage !== 'resolved');
    if (!activeCase) return { valid: false, reason: 'There is no active legal matter.', prerequisites: ['Select an active case.'], requiresConfirmation };
  }
  if (action.verb === 'relationship.transfer_cash') {
    const target = world.characters[action.targetIds[0]];
    if (!target?.isAlive || target.id === actor.id) return { valid: false, reason: 'Choose another living person.', prerequisites: ['Select a valid person.'], requiresConfirmation };
  }
  if (action.verb.startsWith('organization.')) {
    const organization = world.organizations[action.targetIds[0]];
    if (!organization) return { valid: false, reason: 'Choose a known organization.', prerequisites: ['Select an organization.'], requiresConfirmation };
    if (action.verb === 'organization.take_control_attempt' && !organization.memberIds.includes(actor.id)) return { valid: false, reason: 'Control can only be attempted from inside the organization.', prerequisites: ['Join the organization first.'], requiresConfirmation };
  }
  if (action.verb === 'markets.buy') {
    if (!world.securities[action.targetIds[0]]) return { valid: false, reason: 'Choose a listed generated security.', requiresConfirmation };
    if (cashRequired <= 0) return { valid: false, reason: 'Enter an amount to invest.', requiresConfirmation };
  }
  if (action.verb === 'markets.allocate' && (cashRequired <= 0 || cashRequired > actor.cashCents)) {
    return { valid: false, reason: 'Enter an affordable positive amount to allocate.', requiresConfirmation };
  }
  if (action.verb === 'estate.gift_asset') {
    const property = action.targetIds.map((id) => world.properties[id]).find((item) => item?.ownerId === actor.id);
    const holding = action.targetIds.map((id) => world.holdings[id]).find((item) => item?.ownerId === actor.id);
    const requestedRecipient = typeof action.parameters.recipientId === 'string' ? world.characters[action.parameters.recipientId] : undefined;
    const recipient = action.targetIds.map((id) => world.characters[id]).find((item) => item?.isAlive && item.id !== actor.id) ?? requestedRecipient ?? (world.dynasty.activeHeirId ? world.characters[world.dynasty.activeHeirId] : undefined);
    if (!property && !holding) return { valid: false, reason: 'Choose a property or market holding you own.', prerequisites: ['Select an owned asset.'], requiresConfirmation };
    if (!recipient?.isAlive || recipient.id === actor.id) return { valid: false, reason: 'Choose a living recipient.', prerequisites: ['Designate an heir or select a family member.'], requiresConfirmation };
  }
  return { valid: true, requiresConfirmation };
}

function domainForVerb(verb: string): Domain {
  const domain = verb.split('.')[0];
  if (domain === 'misconduct') return 'legal';
  if (domain === 'estate') return 'dynasty';
  if (domain === 'organization') return 'organization';
  return ['relationship', 'education', 'career', 'business', 'property', 'markets', 'politics', 'legal'].includes(domain) ? domain as Domain : 'life';
}

function addFeed(world: WorldState, verb: string, title: string, detail: string, explanation?: OutcomeExplanation): void {
  recordHistory(world, domainForVerb(verb), title, detail, { important: ['relationship.propose', 'relationship.separate', 'business.create', 'business.sell', 'politics.run_for_office', 'estate.gift_asset'].includes(verb), explanation });
}

function recordTransaction(world: WorldState, kind: string, amountCents: number, memo: string, fromId?: string, toId?: string): void {
  world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind, amountCents: clampCents(amountCents), fromId, toId, memo });
  if (world.transactions.length > 1_200) world.transactions.splice(0, world.transactions.length - 1_200);
}

function takeRoll(world: WorldState): number {
  const result = nextRandom(world.rngState);
  world.rngState = result.state;
  return result.value;
}

export function executeAction(source: WorldState, action: IntentAction, confirmed = false): ActionResult {
  const validation = validateAction(source, action);
  if (!validation.valid) return { world: source, validation, message: validation.reason ?? 'That action cannot be completed.' };
  if (validation.requiresConfirmation && !confirmed) {
    return { world: source, validation, message: 'Confirmation is required before this action can change the world.' };
  }

  const world = cloneWorld(source);
  const actor = player(world);
  const targetBusiness = findOwnedBusiness(world, action.targetIds);
  const targetProperty = findOwnedProperty(world, action.targetIds);
  const cashAmount = amount(action.parameters);
  let message = 'The action was completed.';
  let explanation: OutcomeExplanation | undefined;

  switch (action.verb) {
    case 'relationship.contact':
    case 'relationship.spend_time': {
      const targetId = action.targetIds[0];
      const relationship = Object.values(world.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(targetId));
      if (relationship) {
        relationship.trust = Math.min(100, relationship.trust + (action.verb.endsWith('spend_time') ? 5 : 2));
        relationship.affection = Math.min(100, relationship.affection + (action.verb.endsWith('spend_time') ? 7 : 2));
        relationship.lastInteractionWeek = world.calendar.week;
        actor.mood = Math.min(100, actor.mood + 2);
        message = `You made time for ${world.characters[targetId]?.firstName ?? 'the relationship'}.`;
      }
      break;
    }
    case 'relationship.support': {
      const target = world.characters[action.targetIds[0]];
      const relationship = Object.values(world.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(target.id))!;
      const support = Math.min(actor.cashCents, cashAmount || 10_000);
      actor.cashCents -= support;
      target.cashCents += support;
      if (support > 0) recordTransaction(world, 'relationship-support', -support, `Support for ${target.firstName} ${target.lastName}`, actor.id, target.id);
      target.mood = Math.min(100, target.mood + 4);
      relationship.trust = Math.min(100, relationship.trust + 5);
      relationship.affection = Math.min(100, relationship.affection + 3);
      relationship.lastInteractionWeek = world.calendar.week;
      message = `You supported ${target.firstName}${support > 0 ? ` with ${(support / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}` : ''}.`;
      break;
    }
    case 'relationship.date': {
      const target = world.characters[action.targetIds[0]];
      const relationship = Object.values(world.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(target.id))!;
      const accepted = takeRoll(world) < Math.min(0.9, 0.3 + relationship.affection / 180 + actor.charisma / 400);
      if (accepted) {
        actor.partnerId = target.id;
        target.partnerId = actor.id;
        relationship.kind = 'partner';
        relationship.affection = Math.min(100, relationship.affection + 8);
        relationship.trust = Math.min(100, relationship.trust + 3);
        message = `You and ${target.firstName} began dating. The relationship now competes for time and attention.`;
      } else {
        relationship.respect = Math.min(100, relationship.respect + 1);
        message = `${target.firstName} declined the date without ending the relationship.`;
      }
      break;
    }
    case 'relationship.transfer_cash': {
      const target = world.characters[action.targetIds[0]];
      actor.cashCents = clampCents(actor.cashCents - cashAmount);
      target.cashCents = clampCents(target.cashCents + cashAmount);
      recordTransaction(world, 'relationship-transfer', -cashAmount, `Transfer to ${target.firstName} ${target.lastName}`, actor.id, target.id);
      message = `You transferred ${(cashAmount / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} to ${target.firstName}.`;
      break;
    }
    case 'relationship.propose': {
      const target = world.characters[action.targetIds[0]];
      const relationship = Object.values(world.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(target.id))!;
      const accepted = takeRoll(world) < Math.min(0.94, 0.25 + relationship.affection / 170 + relationship.trust / 260);
      if (accepted) {
        actor.partnerId = target.id;
        target.partnerId = actor.id;
        relationship.kind = 'spouse';
        relationship.affection = Math.min(100, relationship.affection + 8);
        relationship.trust = Math.min(100, relationship.trust + 5);
        const id = allocateId(world, 'memory');
        world.memories[id] = { id, participantIds: [actor.id, target.id], category: 'partnership', week: world.calendar.week, valence: 85, importance: 90, permanent: true, unresolved: false, visibility: 'shared', narrative: `${actor.firstName} and ${target.firstName} committed to a life together.` };
        message = `${target.firstName} accepted. The partnership now affects both lives.`;
      } else {
        relationship.resentment = Math.min(100, relationship.resentment + 4);
        actor.mood = Math.max(0, actor.mood - 6);
        message = `${target.firstName} was not ready to accept the proposal.`;
      }
      break;
    }
    case 'relationship.separate': {
      const target = world.characters[actor.partnerId!];
      const relationship = Object.values(world.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(target.id));
      delete actor.partnerId;
      delete target.partnerId;
      if (relationship) {
        relationship.kind = relationship.resentment > 60 ? 'rival' : 'friend';
        relationship.affection = Math.max(0, relationship.affection - 24);
        relationship.trust = Math.max(0, relationship.trust - 18);
        relationship.resentment = Math.min(100, relationship.resentment + 20);
      }
      const id = allocateId(world, 'memory');
      world.memories[id] = { id, participantIds: [actor.id, target.id], category: 'separation', week: world.calendar.week, valence: -70, importance: 84, permanent: true, unresolved: true, visibility: 'shared', narrative: `${actor.firstName} and ${target.firstName} ended their partnership.` };
      message = `You and ${target.firstName} separated. Shared history remains part of the world.`;
      break;
    }
    case 'education.apply': {
      const chance = Math.min(0.95, 0.42 + actor.knowledge / 190 + actor.reputation.professional / 450 - world.economy.unemployment * 0.3);
      const acceptedApplication = takeRoll(world) < chance;
      if (acceptedApplication) {
        const level = typeof action.parameters.level === 'string' ? action.parameters.level : 'Undergraduate program';
        const trade = level.toLowerCase().includes('trade') || action.parameters.path === 'trade';
        const institution = action.targetIds.map((id) => world.organizations[id]).find((item) => item?.kind === 'school');
        const university = WORLD_CONTENT.universities.find((item) => item.id === institution?.id) ?? WORLD_CONTENT.universities[0];
        const id = allocateId(world, 'education');
        world.education[id] = { id, characterId: actor.id, institutionId: institution?.id ?? university.id, status: 'accepted', level: trade ? 'Trade apprenticeship' : level, recordedGrade: 70, knowledgeGain: actor.knowledge, prestige: trade ? 48 : university.prestige, network: trade ? 52 : university.network, tuitionCentsPerYear: trade ? 320_000 : university.tuitionCentsPerYear, manipulatedCredential: false };
        message = `You received an offer for ${world.education[id].level}. Enroll when you are ready to begin.`;
      } else {
        actor.knowledge = Math.min(100, actor.knowledge + 0.3);
        message = 'The application was not accepted, but the attempt sharpened the next one.';
      }
      explanation = explain(acceptedApplication ? 'The application was accepted because the full record cleared the institution’s threshold.' : 'The application fell short when the full record was considered.', [
        { label: 'Grades and knowledge', impact: actor.knowledge >= 65 ? 'positive' : actor.knowledge < 45 ? 'negative' : 'neutral', detail: `Academic readiness was ${Math.round(actor.knowledge)} out of 100.` },
        { label: 'Recommendation and reputation', impact: actor.reputation.professional >= 60 ? 'positive' : actor.reputation.professional < 40 ? 'negative' : 'neutral', detail: `Professional reputation was ${Math.round(actor.reputation.professional)}.` },
        { label: 'Competition', impact: world.economy.unemployment > 0.08 ? 'negative' : 'neutral', detail: `Labor-market pressure was ${(world.economy.unemployment * 100).toFixed(1)}%.` },
      ]);
      break;
    }
    case 'education.enroll': {
      const accepted = action.targetIds.map((id) => world.education[id]).find((record) => record?.characterId === actor.id && record.status === 'accepted')
        ?? Object.values(world.education).find((record) => record.characterId === actor.id && record.status === 'accepted')!;
      accepted.status = accepted.level.toLowerCase().includes('trade') ? 'trade' : 'higher';
      accepted.startedWeek = world.calendar.week;
      actor.focuses = ['Academics' as const, ...actor.focuses.filter((focus) => focus !== 'Academics')].slice(0, 3);
      message = `You enrolled in ${accepted.level}. Tuition, performance, skills, and network will process weekly.`;
      break;
    }
    case 'education.study': {
      actor.focuses = ['Academics' as const, ...actor.focuses.filter((focus) => focus !== 'Academics')].slice(0, 3);
      message = 'Academics is now one of your standing focuses.';
      break;
    }
    case 'education.withdraw': {
      const active = Object.values(world.education).find((record) => record.characterId === actor.id && !['completed', 'withdrawn'].includes(record.status));
      if (active) active.status = 'withdrawn';
      message = 'You withdrew from the active program. Skills and relationships earned so far remain.';
      break;
    }
    case 'career.apply': {
      const chance = Math.min(0.9, 0.22 + actor.knowledge / 220 + actor.reputation.professional / 300 - world.economy.unemployment);
      if (takeRoll(world) < chance) {
        Object.values(world.careers).forEach((career) => { if (career.characterId === actor.id) career.active = false; });
        const id = allocateId(world, 'career');
        world.careers[id] = {
          id,
          characterId: actor.id,
          employerId: 'organization-northstar-logistics',
          title: typeof action.parameters.title === 'string' ? action.parameters.title : 'Project coordinator',
          sector: typeof action.parameters.sector === 'string' ? action.parameters.sector : 'Operations',
          weeklySalaryCents: Math.round(72_000 + actor.knowledge * 550),
          performance: 52,
          satisfaction: 60,
          weeksInRole: 0,
          active: true,
        };
        message = 'The application led to an offer, and you accepted the role.';
      } else message = 'The application did not become an offer. The attempt still added experience.';
      break;
    }
    case 'career.request_raise': {
      const career = Object.values(world.careers).find((item) => item.characterId === actor.id && item.active)!;
      const success = takeRoll(world) < Math.min(0.85, (career.performance + actor.charisma) / 210);
      if (success) {
        career.weeklySalaryCents = Math.round(career.weeklySalaryCents * 1.09);
        message = 'Your manager approved a meaningful raise.';
      } else {
        career.satisfaction = Math.max(0, career.satisfaction - 4);
        message = 'The request was declined, with clearer expectations for the next review.';
      }
      break;
    }
    case 'career.quit': {
      const career = Object.values(world.careers).find((item) => item.characterId === actor.id && item.active)!;
      career.active = false;
      message = `You left your role as ${career.title}.`;
      break;
    }
    case 'business.create': {
      const capital = Math.max(100_000, cashAmount || Math.min(actor.cashCents, 500_000));
      actor.cashCents -= capital;
      recordTransaction(world, 'business-capital', -capital, 'New business starting capital', actor.id);
      const organizationId = allocateId(world, 'organization');
      const businessId = allocateId(world, 'business');
      const name = typeof action.parameters.name === 'string' ? action.parameters.name : `${actor.lastName} & Co.`;
      const sectorDefinition = WORLD_CONTENT.businessSectors.find((sector) => sector.name === action.parameters.sector) ?? WORLD_CONTENT.businessSectors[0];
      world.organizations[organizationId] = { id: organizationId, kind: 'business', name, resourcesCents: capital, influence: 10, stability: 48, memberIds: [actor.id], leaderId: actor.id, history: ['Founded by the active character.'] };
      world.businesses[businessId] = { id: businessId, organizationId, name, sector: sectorDefinition.name, cityId: actor.cityId, founderId: actor.id, ownerId: actor.id, cashCents: capital, debtCents: 0, revenueWeeklyCents: 0, costWeeklyCents: 0, valuationCents: capital, playerOwnershipBps: 10_000, votingControlBps: 10_000, employees: 1, capacity: sectorDefinition.baseCapacity, demand: Math.max(6, Math.round(sectorDefinition.baseCapacity * 0.6)), quality: 58, reputation: 36, marketingBps: 600, pricePosition: 'market', growthPosture: 'balanced', delegated: false, active: true };
      message = `${name} is now operating with ${(capital / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} in starting capital.`;
      break;
    }
    case 'business.contribute_capital':
      actor.cashCents -= cashAmount;
      targetBusiness!.cashCents += cashAmount;
      recordTransaction(world, 'business-capital', -cashAmount, `Capital contribution to ${targetBusiness!.name}`, actor.id, targetBusiness!.id);
      message = `You added ${(cashAmount / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} to ${targetBusiness!.name}.`;
      break;
    case 'business.borrow': {
      const borrowed = cashAmount || 2_500_000;
      targetBusiness!.debtCents += borrowed;
      targetBusiness!.cashCents += borrowed;
      message = `${targetBusiness!.name} added debt and runway. Interest will process every week.`;
      break;
    }
    case 'business.advertise':
      targetBusiness!.marketingBps = Math.max(0, Math.min(3_000, amount(action.parameters, 'marketingBps') || 800));
      message = `Marketing is now ${(targetBusiness!.marketingBps / 100).toFixed(1)}% of revenue.`;
      break;
    case 'business.set_price':
      targetBusiness!.pricePosition = action.parameters.position === 'value' || action.parameters.position === 'premium' ? action.parameters.position : 'market';
      message = `${targetBusiness!.name} now uses ${targetBusiness!.pricePosition} pricing.`;
      break;
    case 'business.hire': {
      const count = Math.max(1, Math.min(500, amount(action.parameters, 'count') || 1));
      const hiringCost = count * 90_000;
      targetBusiness!.cashCents -= hiringCost;
      targetBusiness!.employees += count;
      targetBusiness!.capacity += count * 8;
      message = `${targetBusiness!.name} hired ${count} ${count === 1 ? 'person' : 'people'} and added capacity.`;
      break;
    }
    case 'business.delegate':
      targetBusiness!.delegated = true;
      targetBusiness!.cashCents -= 250_000;
      message = `Routine decisions at ${targetBusiness!.name} are now delegated.`;
      break;
    case 'business.raise_capital': {
      const dilutionBps = Math.max(500, Math.min(4_900, amount(action.parameters, 'equityBps') || 1_500));
      const requestedFinancierId = typeof action.parameters.financierId === 'string' ? action.parameters.financierId : undefined;
      const banker = Object.values(world.characters).find((character) => character.id === requestedFinancierId && character.professionId === 'profession-banker')
        ?? Object.values(world.characters).find((character) => character.professionId === 'profession-banker' && Object.values(world.relationships).some((relationship) => relationship.characterIds.includes(actor.id) && relationship.characterIds.includes(character.id)));
      const bankerRelationship = banker ? Object.values(world.relationships).find((relationship) => relationship.characterIds.includes(actor.id) && relationship.characterIds.includes(banker.id)) : undefined;
      const relationshipPremium = bankerRelationship ? 1 + Math.max(0, bankerRelationship.trust - 50) / 500 : 1;
      const proceeds = Math.round((targetBusiness!.valuationCents * dilutionBps) / Math.max(1, 10_000 - dilutionBps) * relationshipPremium);
      targetBusiness!.cashCents += proceeds;
      targetBusiness!.playerOwnershipBps -= dilutionBps;
      targetBusiness!.votingControlBps = Math.max(targetBusiness!.playerOwnershipBps, targetBusiness!.votingControlBps - Math.round(dilutionBps * 0.6));
      if (banker) banker.lastMeaningfulWeek = world.calendar.week;
      message = `${targetBusiness!.name} raised capital${banker ? ` through ${banker.firstName}'s banking network` : ''} and diluted your ownership to ${(targetBusiness!.playerOwnershipBps / 100).toFixed(1)}%.`;
      explanation = explain('The financing terms reflected company value, the equity offered, and any trusted banking relationship.', [
        { label: 'Company valuation', impact: targetBusiness!.valuationCents >= 100_000_000 ? 'positive' : 'neutral', detail: 'Higher enterprise value supported larger proceeds.' },
        { label: 'Equity sold', impact: dilutionBps > 2500 ? 'negative' : 'neutral', detail: `${(dilutionBps / 100).toFixed(1)}% of ownership was exchanged.` },
        { label: 'Banking relationship', impact: bankerRelationship && bankerRelationship.trust > 60 ? 'positive' : 'neutral', detail: banker ? `${banker.firstName}'s trust influenced the terms.` : 'No established banker relationship improved the terms.' },
      ]);
      break;
    }
    case 'business.sell': {
      const proceeds = Math.round((targetBusiness!.valuationCents * targetBusiness!.playerOwnershipBps) / 10_000 * 0.94);
      actor.cashCents += proceeds;
      targetBusiness!.playerOwnershipBps = 0;
      targetBusiness!.votingControlBps = 0;
      message = `You sold your interest in ${targetBusiness!.name}.`;
      break;
    }
    case 'property.buy': {
      const value = Math.max(8_000_000, amount(action.parameters, 'valueCents') || 32_000_000);
      const downPayment = Math.max(Math.round(value * 0.2), cashAmount || 0);
      if (downPayment > actor.cashCents) return { world: source, validation: { valid: false, reason: 'The down payment is not affordable.', requiresConfirmation: false }, message: 'The down payment is not affordable.' };
      actor.cashCents -= downPayment;
      recordTransaction(world, 'property-purchase', -downPayment, 'Property down payment', actor.id);
      const id = allocateId(world, 'property');
      world.properties[id] = { id, name: typeof action.parameters.name === 'string' ? action.parameters.name : 'Harborview duplex', kind: 'multifamily', cityId: actor.cityId, ownerId: actor.id, valueCents: value, debtCents: value - downPayment, condition: 72, occupancy: 'vacant', weeklyRentCents: Math.round(value * 0.0009), weeklyCostsCents: Math.round(value * 0.00024), managed: false };
      message = `You bought ${world.properties[id].name}. Cash and net worth now tell different stories.`;
      break;
    }
    case 'property.rent_out':
      targetProperty!.occupancy = 'tenant';
      message = `${targetProperty!.name} is now occupied by a tenant.`;
      break;
    case 'property.set_rent':
      targetProperty!.weeklyRentCents = Math.max(0, amount(action.parameters, 'weeklyRentCents') || targetProperty!.weeklyRentCents);
      message = `The weekly rent target is now ${(targetProperty!.weeklyRentCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.`;
      break;
    case 'property.manage':
      targetProperty!.managed = true;
      message = 'A property manager will trade fees for fewer routine interruptions.';
      break;
    case 'property.renovate': {
      const spend = Math.min(actor.cashCents, cashAmount || Math.round(targetProperty!.valueCents * 0.03));
      actor.cashCents -= spend;
      recordTransaction(world, 'property-renovation', -spend, `Renovation of ${targetProperty!.name}`, actor.id, targetProperty!.id);
      targetProperty!.condition = Math.min(100, targetProperty!.condition + spend / targetProperty!.valueCents * 900);
      targetProperty!.valueCents += Math.round(spend * 0.65);
      message = `The renovation improved ${targetProperty!.name}, though not every dollar became market value.`;
      break;
    }
    case 'property.refinance': {
      const maxDebt = Math.round(targetProperty!.valueCents * 0.72);
      const proceeds = Math.max(0, maxDebt - targetProperty!.debtCents - Math.round(targetProperty!.valueCents * 0.012));
      targetProperty!.debtCents = maxDebt;
      actor.cashCents += proceeds;
      recordTransaction(world, 'property-refinance', proceeds, `Refinance of ${targetProperty!.name}`, targetProperty!.id, actor.id);
      message = `The refinance released ${(proceeds / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} after costs.`;
      break;
    }
    case 'property.sell': {
      const proceeds = Math.max(0, Math.round(targetProperty!.valueCents * 0.94) - targetProperty!.debtCents);
      actor.cashCents += proceeds;
      recordTransaction(world, 'property-sale', proceeds, `Sale of ${targetProperty!.name}`, targetProperty!.id, actor.id);
      delete world.properties[targetProperty!.id];
      message = `You sold ${targetProperty!.name} and received the remaining equity after debt and costs.`;
      break;
    }
    case 'markets.buy':
    case 'markets.allocate': {
      const securityId = action.verb === 'markets.allocate' ? 'security-common' : action.targetIds[0];
      const security = world.securities[securityId];
      const invest = cashAmount || Math.min(actor.cashCents, 100_000);
      const unitsMilli = Math.floor((invest * 1000) / security.priceCents);
      const actualCost = Math.round((unitsMilli * security.priceCents) / 1000);
      actor.cashCents -= actualCost;
      recordTransaction(world, 'market-purchase', -actualCost, `Purchase of ${security.name}`, actor.id, security.id);
      const existing = Object.values(world.holdings).find((holding) => holding.ownerId === actor.id && holding.securityId === securityId);
      if (existing) {
        existing.costBasisCents += actualCost;
        existing.unitsMilli += unitsMilli;
      } else {
        const id = allocateId(world, 'holding');
        world.holdings[id] = { id, ownerId: actor.id, securityId, unitsMilli, costBasisCents: actualCost };
      }
      message = `You invested ${(actualCost / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} in ${security.name}.`;
      break;
    }
    case 'markets.sell': {
      const holding = Object.values(world.holdings).find((item) => item.ownerId === actor.id && item.securityId === action.targetIds[0]);
      if (!holding) return { world: source, validation: { valid: false, reason: 'You do not own that security.', requiresConfirmation: false }, message: 'You do not own that security.' };
      const security = world.securities[holding.securityId];
      const requested = cashAmount || Math.round((holding.unitsMilli * security.priceCents) / 1000);
      const units = Math.min(holding.unitsMilli, Math.floor((requested * 1000) / security.priceCents));
      const proceeds = Math.round((units * security.priceCents) / 1000);
      holding.unitsMilli -= units;
      actor.cashCents += proceeds;
      recordTransaction(world, 'market-sale', proceeds, `Sale of ${security.symbol}`, security.id, actor.id);
      if (holding.unitsMilli <= 0) delete world.holdings[holding.id];
      message = `You sold ${security.symbol} for ${(proceeds / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.`;
      break;
    }
    case 'organization.join': {
      const organization = world.organizations[action.targetIds[0]];
      if (!organization) return { world: source, validation: { valid: false, reason: 'Choose a known organization.', requiresConfirmation: false }, message: 'Choose a known organization.' };
      if (!organization.memberIds.includes(actor.id)) organization.memberIds.push(actor.id);
      message = `You joined ${organization.name}.`;
      break;
    }
    case 'organization.fund': {
      const organization = world.organizations[action.targetIds[0]];
      if (!organization) return { world: source, validation: { valid: false, reason: 'Choose a known organization.', requiresConfirmation: false }, message: 'Choose a known organization.' };
      actor.cashCents -= cashAmount;
      organization.resourcesCents += cashAmount;
      recordTransaction(world, 'organization-funding', -cashAmount, `Funding for ${organization.name}`, actor.id, organization.id);
      organization.influence = Math.min(100, organization.influence + Math.log10(Math.max(1, cashAmount / 100)));
      message = `Your contribution increased ${organization.name}’s resources and your connection to it.`;
      break;
    }
    case 'organization.take_control_attempt': {
      const organization = world.organizations[action.targetIds[0]];
      const support = actor.charisma * 0.35 + actor.reputation.faction * 0.35 + actor.reputation.professional * 0.2 + organization.influence * 0.1;
      const resistance = organization.stability * 0.55 + organization.influence * 0.35 + 12;
      if (takeRoll(world) * 100 + support > resistance) {
        organization.leaderId = actor.id;
        organization.history.push(`${actor.firstName} ${actor.lastName} gained control in week ${world.calendar.week}.`);
        actor.reputation.faction = Math.min(100, actor.reputation.faction + 12);
        message = `You gained control of ${organization.name}; its members and history remain independent constraints.`;
      } else {
        organization.stability = Math.max(0, organization.stability - 6);
        actor.reputation.faction = Math.max(0, actor.reputation.faction - 8);
        message = `The attempt to control ${organization.name} failed and weakened your standing inside it.`;
      }
      break;
    }
    case 'politics.run_for_office': {
      const office = typeof action.parameters.office === 'string' ? action.parameters.office : 'Harborview Council';
      const employmentInfluence = Object.values(world.businesses).filter((business) => (business.ownerId ?? business.founderId) === actor.id && business.active).reduce((total, business) => total + business.employees, 0);
      const economicSupport = Math.min(18, Math.log10(Math.max(1, employmentInfluence)) * 4);
      world.politics[actor.id] = world.politics[actor.id] ?? { characterId: actor.id, authority: 0, approval: 50 };
      world.politics[actor.id].campaign = { office, weeksRemaining: 26, fundsCents: cashAmount || Math.min(actor.cashCents, 500_000), support: actor.reputation.political * 0.55 + actor.charisma * 0.15 + economicSupport, opposition: 48 };
      actor.cashCents -= world.politics[actor.id].campaign!.fundsCents;
      recordTransaction(world, 'campaign-funding', -world.politics[actor.id].campaign!.fundsCents, `Campaign for ${office}`, actor.id);
      actor.focuses = ['Campaign' as const, ...actor.focuses.filter((focus) => focus !== 'Campaign')].slice(0, 3);
      message = `The campaign for ${office} has begun.`;
      explanation = explain('The opening coalition reflects reputation, personal appeal, and economic importance.', [
        { label: 'Political reputation', impact: actor.reputation.political >= 60 ? 'positive' : 'neutral', detail: `Reputation contributed from a score of ${Math.round(actor.reputation.political)}.` },
        { label: 'Economic footprint', impact: employmentInfluence >= 100 ? 'positive' : 'neutral', detail: `Player-controlled companies employ ${employmentInfluence.toLocaleString()} people.` },
        { label: 'Opposition', impact: 'negative', detail: 'Organized opposition begins at a meaningful baseline.' },
      ]);
      break;
    }
    case 'politics.campaign_action': {
      const campaign = world.politics[actor.id]?.campaign;
      if (!campaign) return { world: source, validation: { valid: false, reason: 'There is no active campaign.', requiresConfirmation: false }, message: 'There is no active campaign.' };
      const spend = Math.min(actor.cashCents, cashAmount || 100_000);
      actor.cashCents -= spend;
      campaign.fundsCents += spend;
      recordTransaction(world, 'campaign-funding', -spend, 'Campaign contribution', actor.id);
      campaign.support = Math.min(100, campaign.support + actor.charisma / 30 + spend / 200_000);
      message = 'The campaign added support, while opposition continues to react.';
      break;
    }
    case 'politics.policy_action':
      world.politics[actor.id].approval = Math.max(0, Math.min(100, world.politics[actor.id].approval + (takeRoll(world) - 0.48) * 12));
      actor.reputation.political = Math.max(0, Math.min(100, actor.reputation.political + 1));
      message = 'The policy moved through the authority of your office; institutions and public opinion reacted.';
      break;
    case 'misconduct.tax_evasion_attempt':
    case 'misconduct.insider_trade_attempt':
    case 'misconduct.bribery_attempt':
    case 'misconduct.faction_power_seizure_attempt': {
      const id = allocateId(world, 'exposure');
      const upside = cashAmount || Math.round(Math.max(100_000, actor.cashCents * 0.08));
      actor.cashCents += action.verb.includes('power_seizure') ? 0 : upside;
      if (!action.verb.includes('power_seizure')) recordTransaction(world, 'misconduct-proceeds', upside, 'Unlawful proceeds with persistent exposure', undefined, actor.id);
      world.exposures[id] = { id, characterId: actor.id, category: action.verb, severity: action.verb.includes('power_seizure') ? 92 : 60, evidence: 35 + takeRoll(world) * 45, discoverability: 28 + takeRoll(world) * 52, createdWeek: world.calendar.week, discovered: false, resolved: false };
      actor.reputation.faction = Math.min(100, actor.reputation.faction + 8);
      message = 'The high-level fictional misconduct created short-term leverage and a persistent evidence record. No operational method is modeled.';
      explanation = explain('The system models strategic consequences only, never real-world instructions.', [
        { label: 'Short-term leverage', impact: 'positive', detail: 'The fictional attempt may create money or faction influence.' },
        { label: 'Persistent evidence', impact: 'negative', detail: 'Evidence and discoverability remain for future investigations.' },
        { label: 'Abstraction boundary', impact: 'neutral', detail: 'No operational steps, targets, or real-world methods are simulated.' },
      ]);
      break;
    }
    case 'legal.hire_counsel':
    case 'legal.cooperate':
    case 'legal.contest': {
      const legalCase = Object.values(world.legalCases).find((item) => item.characterId === actor.id && item.stage !== 'resolved')!;
      if (action.verb === 'legal.hire_counsel') {
        const spend = Math.min(actor.cashCents, cashAmount || 1_500_000);
        actor.cashCents -= spend;
        recordTransaction(world, 'legal-cost', -spend, 'Legal counsel', actor.id);
        legalCase.counselQuality = Math.min(95, 35 + Math.log10(Math.max(10, spend / 100)) * 10);
        legalCase.risk = Math.max(0, legalCase.risk - legalCase.counselQuality * 0.14);
      } else if (action.verb === 'legal.cooperate') legalCase.risk = Math.max(0, legalCase.risk - 10);
      else legalCase.risk = Math.max(0, Math.min(100, legalCase.risk + (takeRoll(world) - 0.55) * 18));
      message = 'The legal response changed risk, cost, and reputation without overriding the evidence.';
      break;
    }
    case 'estate.designate_successor': {
      const successor = world.characters[action.targetIds[0]];
      if (!successor?.isAlive || successor.id === actor.id) return { world: source, validation: { valid: false, reason: 'Choose an eligible living family successor.', requiresConfirmation: false }, message: 'Choose an eligible living family successor.' };
      world.dynasty.activeHeirId = successor.id;
      message = `${successor.firstName} is now the preferred successor.`;
      break;
    }
    case 'estate.gift_asset': {
      const property = action.targetIds.map((id) => world.properties[id]).find((item) => item?.ownerId === actor.id);
      const holding = action.targetIds.map((id) => world.holdings[id]).find((item) => item?.ownerId === actor.id);
      const requestedRecipient = typeof action.parameters.recipientId === 'string' ? world.characters[action.parameters.recipientId] : undefined;
      const recipient = action.targetIds.map((id) => world.characters[id]).find((item) => item?.isAlive && item.id !== actor.id)
        ?? requestedRecipient
        ?? world.characters[world.dynasty.activeHeirId!];
      const assetName = property?.name ?? (holding ? world.securities[holding.securityId]?.name : undefined) ?? 'asset';
      if (property) property.ownerId = recipient.id;
      if (holding) holding.ownerId = recipient.id;
      recordTransaction(world, 'estate-gift', 0, `Gift of ${assetName}`, actor.id, recipient.id);
      message = `${assetName} now belongs to ${recipient.firstName}. The transfer remains in family history.`;
      break;
    }
    default:
      return { world: source, validation: { valid: false, reason: 'That registered action does not have an authoritative handler in this build.', requiresConfirmation: false }, message: 'That action is unavailable in this build.' };
  }

  world.metadata.updatedAt = new Date().toISOString();
  addFeed(world, action.verb, actionDefinition(action.verb)?.label ?? action.verb, message, explanation);
  return { world, validation, message, explanation };
}
