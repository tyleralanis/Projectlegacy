import type {
  CandidateEntity,
  IntentRequest,
  IntentResponse,
  LegacyAICapabilities,
} from '@project-legacy/legacy-ai';
import { Platform } from 'react-native';

import { ACTION_CATALOG, actionsForDomains } from '@/content/actionCatalog';
import type { Domain, WorldState } from '@/engine/types';

const ALIASES: Record<string, string[]> = {
  'relationship.contact': ['call', 'contact', 'message', 'reach out'],
  'relationship.spend_time': ['spend time', 'visit', 'hang out', 'see my'],
  'relationship.date': ['ask out', 'go on a date', 'start dating', 'date'],
  'relationship.support': ['support', 'help out', 'be there for'],
  'relationship.transfer_cash': ['give', 'send', 'transfer', 'gift cash'],
  'relationship.propose': ['propose', 'ask to marry', 'get married'],
  'relationship.separate': ['separate', 'break up', 'end the relationship'],
  'education.study': ['study', 'focus on school', 'academics'],
  'education.apply': ['apply to school', 'apply to college', 'university application'],
  'education.enroll': ['enroll', 'accept the school offer', 'start the program'],
  'career.apply': ['apply for', 'find a job', 'get a job'],
  'career.request_raise': ['ask for a raise', 'request a raise', 'more pay'],
  'career.quit': ['quit', 'resign', 'leave my job'],
  'business.create': ['start a business', 'found a company', 'open a company', 'start a company'],
  'business.contribute_capital': ['put money into', 'add capital', 'invest in my company'],
  'business.borrow': ['business loan', 'borrow for the company'],
  'business.advertise': ['advertise', 'marketing budget', 'increase marketing'],
  'business.hire': ['hire', 'add employees', 'recruit staff'],
  'business.delegate': ['delegate', 'hire a manager', 'operator'],
  'business.raise_capital': ['raise capital', 'sell equity', 'bring in investors'],
  'business.sell': ['sell my business', 'sell the company'],
  'property.buy': ['buy a property', 'buy a home', 'buy the duplex', 'purchase property'],
  'property.sell': ['sell the property', 'sell my house', 'sell the duplex'],
  'property.rent_out': ['rent it out', 'find a tenant', 'lease the property'],
  'property.set_rent': ['set rent', 'raise rent', 'lower rent'],
  'property.refinance': ['refinance', 'borrow against equity'],
  'markets.buy': ['buy shares', 'buy stock', 'invest in'],
  'markets.sell': ['sell shares', 'sell stock'],
  'markets.allocate': ['invest my savings', 'diversified fund', 'allocate'],
  'organization.join': ['join the', 'become a member'],
  'organization.fund': ['fund the', 'donate to'],
  'organization.take_control_attempt': ['take control of', 'lead the organization', 'challenge the leader'],
  'politics.run_for_office': ['run for', 'campaign for office'],
  'politics.campaign_action': ['campaign', 'fund my campaign'],
  'politics.policy_action': ['set policy', 'pass a policy', 'govern'],
  'legal.hire_counsel': ['hire a lawyer', 'hire counsel', 'get an attorney'],
  'legal.cooperate': ['cooperate', 'work with investigators'],
  'legal.contest': ['contest', 'fight the case'],
  'misconduct.tax_evasion_attempt': ['evade taxes', 'hide taxes'],
  'misconduct.insider_trade_attempt': ['trade on the information', 'insider trade'],
  'misconduct.bribery_attempt': ['bribe', 'pay off'],
  'misconduct.faction_power_seizure_attempt': ['seize power', 'take over the government', 'coup'],
  'estate.designate_successor': ['make my heir', 'designate successor', 'choose my heir'],
  'estate.gift_asset': ['gift my property', 'gift my shares', 'give an asset'],
};

function candidatesFromWorld(world: WorldState): CandidateEntity[] {
  const actor = world.characters[world.playerCharacterId];
  const people = Object.values(world.characters)
    .filter((character) => character.id !== actor.id && character.isAlive)
    .slice(0, 24)
    .map((character) => ({
      id: character.id,
      type: 'character',
      name: `${character.firstName} ${character.lastName}`,
      aliases: [character.firstName.toLowerCase(), character.lastName.toLowerCase(), character.parentIds.includes(actor.id) ? 'my child' : 'family'],
      facts: { relationshipRole: character.parentIds.includes(actor.id) ? 'child' : 'known person', isLiving: character.isAlive },
    }));
  const assets: CandidateEntity[] = [
    ...Object.values(world.businesses).map((business) => ({ id: business.id, type: 'business', name: business.name, aliases: ['my business', 'my company'], facts: { ownershipBps: business.playerOwnershipBps } })),
    ...Object.values(world.properties).map((property) => ({ id: property.id, type: 'property', name: property.name, aliases: ['my property', property.kind], facts: { ownerId: property.ownerId } })),
    ...Object.values(world.securities).map((security) => ({ id: security.id, type: 'security', name: security.name, aliases: [security.symbol.toLowerCase(), `${security.name.toLowerCase()} stock`] })),
    ...Object.values(world.organizations).map((organization) => ({ id: organization.id, type: 'organization', name: organization.name, aliases: [organization.kind] })),
    ...Object.values(world.education).filter((record) => record.characterId === actor.id && record.status === 'accepted').map((record) => ({ id: record.id, type: 'education', name: record.level, aliases: ['my offer', 'school offer', 'the program'] })),
  ];
  return [...people, ...assets].slice(0, 60);
}

function parseAmountCents(text: string): number | undefined {
  const match = text.replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d+)?)\s*(k|m|million|thousand)?/i);
  if (!match) return undefined;
  const multiplier = match[2]?.toLowerCase() === 'k' || match[2]?.toLowerCase() === 'thousand' ? 1_000 : match[2]?.toLowerCase() === 'm' || match[2]?.toLowerCase() === 'million' ? 1_000_000 : 1;
  return Math.round(Number.parseFloat(match[1]) * multiplier * 100);
}

function parsePercentBps(text: string): number | undefined {
  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? Math.round(Number.parseFloat(match[1]) * 100) : undefined;
}

function fallbackInterpret(request: IntentRequest): IntentResponse {
  const normalized = request.text.toLowerCase().replace(/[’']/g, "'").trim();
  const matches = request.allowedActions
    .map((actionId) => ({ actionId, score: Math.max(0, ...(ALIASES[actionId] ?? []).map((alias) => (normalized.includes(alias) ? alias.length : 0))) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);
  if (matches.length === 0) {
    return { requestId: request.requestId, status: 'unsupported', modeUsed: 'baseline', confidence: 0.2, requiresConfirmation: false, clarification: 'I could not map that to a supported local action. Try naming the person, asset, or action more directly.', actions: [], safetyFlags: [], diagnostics: { reason: 'no_supported_action_match' } };
  }
  const best = matches[0];
  const ambiguous = matches[1] && matches[1].score === best.score;
  if (ambiguous) {
    return { requestId: request.requestId, status: 'clarification', modeUsed: 'baseline', confidence: 0.52, requiresConfirmation: true, clarification: `Did you mean ${ACTION_CATALOG.find((action) => action.id === best.actionId)?.label.toLowerCase()} or ${ACTION_CATALOG.find((action) => action.id === matches[1].actionId)?.label.toLowerCase()}?`, actions: [], safetyFlags: [], diagnostics: { reason: 'ambiguous_action', candidates: matches.slice(0, 2).map((match) => match.actionId) } };
  }
  const targetMatches = request.candidates
    .map((candidate) => ({ candidate, score: [candidate.name.toLowerCase(), ...(candidate.aliases ?? []).map((alias) => alias.toLowerCase())].reduce((score, alias) => Math.max(score, normalized.includes(alias) ? alias.length : 0), 0) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const target = targetMatches[0]?.candidate;
  const definition = ACTION_CATALOG.find((action) => action.id === best.actionId);
  const amountCents = parseAmountCents(normalized);
  const percentBps = parsePercentBps(normalized);
  const parameters: Record<string, number | string | boolean | null> = {};
  if (amountCents !== undefined) parameters.amountCents = amountCents;
  if (percentBps !== undefined) {
    if (best.actionId === 'business.advertise') parameters.marketingBps = percentBps;
    else parameters.equityBps = percentBps;
  }
  const needsTarget = !['business.create', 'property.buy', 'markets.allocate', 'politics.run_for_office', 'career.apply', 'education.apply', 'education.study', 'misconduct.tax_evasion_attempt', 'misconduct.faction_power_seizure_attempt'].includes(best.actionId);
  if (needsTarget && !target) {
    return { requestId: request.requestId, status: 'clarification', modeUsed: 'baseline', confidence: 0.62, requiresConfirmation: true, clarification: 'Which person, business, property, security, case, or organization do you mean?', actions: [], safetyFlags: [], diagnostics: { reason: 'missing_target', proposedVerb: best.actionId } };
  }
  return {
    requestId: request.requestId,
    status: 'proposal',
    modeUsed: 'baseline',
    confidence: 0.9,
    requiresConfirmation: Boolean(definition?.destructive || definition?.confirmationMandatory),
    actions: [{ verb: best.actionId, targetIds: best.actionId === 'estate.gift_asset' ? targetMatches.slice(0, 3).map((match) => match.candidate.id) : target ? [target.id] : [], parameters, destructive: definition?.destructive }],
    safetyFlags: best.actionId.startsWith('misconduct.') ? ['abstract_sensitive_action'] : [],
    diagnostics: { parser: 'deterministic_alias_match', matchedAliasLength: best.score },
  };
}

export async function interpretPlayerIntent(world: WorldState, text: string, domains: Domain[]): Promise<IntentResponse> {
  const request: IntentRequest = {
    requestId: `intent-${Date.now()}`,
    text,
    actorId: world.playerCharacterId,
    domain: domains[0] ?? 'life',
    allowedActions: actionsForDomains(domains).map((action) => action.id),
    candidates: candidatesFromWorld(world),
    activeContext: {
      legacyAIEnhancedEnabled: world.settings.enhancedAIEnabled,
      currentWeek: world.calendar.week,
    },
  };
  if (Platform.OS === 'ios') {
    try {
      const module = await import('@project-legacy/legacy-ai');
      return await module.interpretIntent(request);
    } catch {
      return fallbackInterpret(request);
    }
  }
  return fallbackInterpret(request);
}

export async function getLegacyAICapabilities(): Promise<LegacyAICapabilities> {
  if (Platform.OS === 'ios') {
    try {
      const module = await import('@project-legacy/legacy-ai');
      return await module.getCapabilities();
    } catch {}
  }
  return { moduleVersion: 'typescript-fallback', baselineAvailable: true, enhancedAvailable: false, enhancedReason: 'Native enhanced mode is available only in an iOS development or release build.', supportedLanguages: ['en'] };
}
