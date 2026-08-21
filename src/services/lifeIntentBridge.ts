import type { IntentResponse } from '@project-legacy/legacy-ai';

import { LIFE_SYSTEM_ACTION_CATALOG } from '@/content/lifeSystemsActionCatalog';
import type { Domain, WorldState } from '@/engine/types';
import { interpretPlayerIntent as interpretBaseIntent } from '@/services/intentService';

const ALIASES: Record<string, string[]> = {
  'career.negotiate_hours': ['cut my hours', 'reduce my hours', 'work fewer hours', 'work less', 'go part time', 'part-time', 'part time', '32 hours', '20 hours', 'increase my hours', 'work more hours', '50 hours', 'change my schedule'],
  'education.ask_family_help': ['ask family for tuition', 'ask family for help', 'ask my family for help', 'ask parents for tuition', 'ask my parents for tuition', 'ask parents for help with college', 'family help with college', 'family help with tuition'],
  'health.sleep': ['protect my sleep', 'sleep more', 'get more sleep', 'prioritize sleep', 'catch up on sleep'],
  'health.nutrition': ['eat better', 'improve my diet', 'improve nutrition', 'meal prep', 'eat healthier', 'nutrition plan'],
  'health.checkup': ['get a checkup', 'doctor checkup', 'routine checkup', 'physical exam', 'preventive care'],
  'health.rehab': ['do rehab', 'rehab my injury', 'physical therapy', 'recover with rehab', 'treat my injury'],
  'health.rest_week': ['take a recovery week', 'rest for a week', 'take it easy this week', 'take a week off', 'recovery week'],
  'health.cancel_gym_membership': ['cancel my gym membership', 'cancel gym membership', 'cancel the gym', 'stop gym membership', 'stop gym renewal'],
  'property.screen_tenant': ['screen a tenant', 'find a tenant', 'screen tenants', 'rent to someone', 'tenant application'],
  'property.repair': ['repair the property', 'fix the property', 'make repairs', 'fix my rental', 'repair my rental'],
  'property.pay_principal': ['pay off house', 'pay off my house', 'payoff house', 'pay off mortgage', 'pay off my mortgage', 'payoff mortgage', 'clear the mortgage', 'pay down mortgage', 'pay down my mortgage', 'make an extra mortgage payment', 'extra mortgage payment', 'pay mortgage principal', 'pay principal on house'],
  'property.develop': ['develop the land', 'develop my land', 'build apartments', 'build multifamily', 'build commercial', 'develop into apartments', 'develop into commercial'],
  'property.manage_portfolio': ['hire a property manager', 'hire property manager', 'manage all my properties', 'manage my portfolio', 'portfolio manager'],
  'property.end_management': ['fire property manager', 'end property management', 'self manage my properties', 'self-manage my properties', 'cancel property management'],
  'business.withdraw_funds': ['withdraw business cash', 'withdraw company cash', 'take money out of the company', 'pay myself from the business', 'pay myself from the company', 'owner distribution', 'take a distribution'],
  'sports.sign_endorsement': ['sign an endorsement', 'get an endorsement', 'brand deal', 'sponsorship deal', 'sign a sponsorship'],
  'sports.recover': ['recover from injury', 'recover from my injury', 'rest my injury', 'sports recovery'],
  'sports.retire': ['retire from sports', 'retire from professional sports', 'retire from playing', 'end my playing career'],
  'sports.coach': ['become a coach', 'start coaching', 'coach professionally', 'be a professional coach'],
  'wealth.set_lifestyle': ['set my lifestyle', 'live frugally', 'live comfortable', 'live comfortably', 'live luxuriously', 'luxury lifestyle', 'opulent lifestyle', 'spend less on lifestyle'],
  'wealth.create_family_office': ['create a family office', 'start a family office', 'set up a family office', 'build a family office'],
};

function normalizedText(text: string): string {
  return text.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
}

function factionExitIntent(text: string, domains: Domain[]): IntentResponse | undefined {
  if (!domains.includes('organization')) return undefined;
  const normalized = normalizedText(text);
  let verb: 'faction.cash_out' | 'faction.dissolve' | 'faction.leave' | undefined;
  if (/\b(cash out|take (?:the|all|my)? ?(?:cult|movement|group)? ?money and leave|raid (?:the|my)? ?(?:cult|movement) funds)\b/.test(normalized)) verb = 'faction.cash_out';
  else if (/\b(end|dissolve|shut down|close|disband) (?:my |the )?(?:cult|movement|inner circle)\b/.test(normalized)) verb = 'faction.dissolve';
  else if (/\b(leave|quit|step down from|walk away from) (?:my |the )?(?:cult|movement|inner circle)\b/.test(normalized)) verb = 'faction.leave';
  if (!verb) return undefined;
  return {
    requestId: `faction-exit-${Date.now()}`,
    status: 'proposal',
    modeUsed: 'baseline',
    confidence: 0.99,
    requiresConfirmation: true,
    actions: [{ verb, targetIds: [], parameters: {}, destructive: true }],
    safetyFlags: [],
    diagnostics: { parser: 'faction_exit_alias', proposedVerb: verb },
  };
}

function amountCents(text: string): number | undefined {
  const match = text.replace(/,/g, '').match(/\$\s*(\d+(?:\.\d+)?)\s*(k|m|million|thousand)?/i);
  if (!match) return undefined;
  const suffix = match[2]?.toLowerCase();
  const multiplier = suffix === 'k' || suffix === 'thousand' ? 1_000 : suffix === 'm' || suffix === 'million' ? 1_000_000 : 1;
  return Math.round(Number.parseFloat(match[1]) * multiplier * 100);
}

function propertyTarget(world: WorldState, text: string, verb: string): { id?: string; clarification?: string } {
  const actor = world.characters[world.playerCharacterId];
  let properties = Object.values(world.properties).filter((property) => property.ownerId === actor.id);
  if (verb === 'property.develop') properties = properties.filter((property) => property.kind === 'land' && property.occupancy !== 'construction');
  if (verb === 'property.pay_principal') properties = properties.filter((property) => property.debtCents > 0);
  if (properties.length === 0) return { clarification: verb === 'property.develop' ? 'You need an undeveloped land parcel you own first.' : verb === 'property.pay_principal' ? 'You do not currently own a property with a mortgage balance.' : 'You do not currently own a property that fits that action.' };
  const normalized = normalizedText(text);
  const named = properties.filter((property) => normalized.includes(property.name.toLowerCase()));
  if (named.length === 1) return { id: named[0].id };
  if (properties.length === 1) return { id: properties[0].id };
  return { clarification: `Which property do you mean: ${properties.slice(0, 5).map((property) => property.name).join(', ')}?` };
}

function educationFundingTarget(world: WorldState): { id?: string; clarification?: string } {
  const actor = world.characters[world.playerCharacterId];
  const records = Object.values(world.education).filter((record) => record.characterId === actor.id && ['accepted', 'higher', 'trade'].includes(record.status));
  if (records.length === 0) return { clarification: 'You need an accepted or active college path before asking family to help finance it.' };
  if (records.length === 1) return { id: records[0].id };
  const active = records.find((record) => ['higher', 'trade'].includes(record.status));
  return active ? { id: active.id } : { clarification: 'Which accepted school do you want family help with?' };
}

function businessTarget(world: WorldState, text: string): { id?: string; clarification?: string } {
  const actor = world.characters[world.playerCharacterId];
  const businesses = Object.values(world.businesses).filter((business) => business.active && (business.ownerId ?? business.founderId) === actor.id && business.playerOwnershipBps > 0);
  if (businesses.length === 0) return { clarification: 'You do not currently own an active company to take a distribution from.' };
  const normalized = normalizedText(text);
  const named = businesses.filter((business) => normalized.includes(business.name.toLowerCase()));
  if (named.length === 1) return { id: named[0].id };
  if (businesses.length === 1) return { id: businesses[0].id };
  return { clarification: `Which company do you mean: ${businesses.slice(0, 5).map((business) => business.name).join(', ')}?` };
}

function hourTarget(text: string): number {
  const normalized = normalizedText(text);
  const exact = normalized.match(/\b(20|32|40|50)\s*(?:hours?|hrs?)\b/);
  if (exact) return Number(exact[1]);
  if (/part[- ]?time|half time/.test(normalized)) return 20;
  if (/work more|increase my hours|longer hours/.test(normalized)) return 50;
  if (/cut my hours|reduce my hours|work fewer|work less/.test(normalized)) return 32;
  return 32;
}

function lifestyle(text: string): 'frugal' | 'comfortable' | 'luxury' | 'opulent' {
  const normalized = normalizedText(text);
  if (/opulent|lavish|ultra luxury/.test(normalized)) return 'opulent';
  if (/luxur|high end|high-end/.test(normalized)) return 'luxury';
  if (/frugal|spend less|minimal|cheap/.test(normalized)) return 'frugal';
  return 'comfortable';
}

function matchedLifeAction(text: string, domains: Domain[]) {
  const normalized = normalizedText(text);
  return LIFE_SYSTEM_ACTION_CATALOG
    .filter((definition) => domains.includes(definition.domain))
    .map((definition) => ({
      definition,
      score: Math.max(0, ...(ALIASES[definition.id] ?? []).map((alias) => normalized.includes(alias) ? alias.length : 0)),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)[0];
}

function clarification(requestId: string, verb: string, detail: string): IntentResponse {
  return {
    requestId,
    status: 'clarification',
    modeUsed: 'baseline',
    confidence: 0.78,
    requiresConfirmation: false,
    clarification: detail,
    actions: [],
    safetyFlags: [],
    diagnostics: { parser: 'systemic_life_alias', proposedVerb: verb },
  };
}

export async function interpretPlayerIntent(world: WorldState, text: string, domains: Domain[]): Promise<IntentResponse> {
  const factionExit = factionExitIntent(text, domains);
  if (factionExit) return factionExit;
  const match = matchedLifeAction(text, domains);
  if (!match) return interpretBaseIntent(world, text, domains);

  const verb = match.definition.id;
  const requestId = `life-intent-${Date.now()}`;
  const parameters: Record<string, string | number | boolean | null> = {};
  const parsedAmount = amountCents(text);
  if (parsedAmount !== undefined) parameters.amountCents = parsedAmount;
  let targetIds: string[] = [];

  const portfolioVerb = verb === 'property.manage_portfolio' || verb === 'property.end_management';
  if (verb.startsWith('property.') && !portfolioVerb) {
    const target = propertyTarget(world, text, verb);
    if (!target.id) return clarification(requestId, verb, target.clarification ?? 'Which property do you mean?');
    targetIds = [target.id];
    if (verb === 'property.develop') parameters.targetKind = /commercial|retail|office/.test(normalizedText(text)) ? 'commercial' : 'multifamily';
    if (verb === 'property.pay_principal') {
      const payoffRequested = /pay\s*off|payoff|clear the mortgage/.test(normalizedText(text));
      if (payoffRequested) parameters.payoff = true;
      else if (parsedAmount === undefined) return clarification(requestId, verb, 'How much do you want to pay toward mortgage principal? Include an amount, or say “pay off the mortgage.”');
    }
  }

  if (verb === 'education.ask_family_help') {
    const target = educationFundingTarget(world);
    if (!target.id) return clarification(requestId, verb, target.clarification ?? 'Which college path do you mean?');
    targetIds = [target.id];
  }

  if (verb === 'business.withdraw_funds') {
    const target = businessTarget(world, text);
    if (!target.id) return clarification(requestId, verb, target.clarification ?? 'Which company do you mean?');
    targetIds = [target.id];
  }

  if (verb === 'career.negotiate_hours') parameters.hours = hourTarget(text);
  if (verb === 'wealth.set_lifestyle') parameters.posture = lifestyle(text);

  const requiresConfirmation = verb === 'sports.retire' || (verb === 'property.pay_principal' && parameters.payoff === true);
  return {
    requestId,
    status: 'proposal',
    modeUsed: 'baseline',
    confidence: 0.96,
    requiresConfirmation,
    actions: [{ verb, targetIds, parameters, destructive: requiresConfirmation }],
    safetyFlags: [],
    diagnostics: { parser: 'systemic_life_alias', matchedAliasLength: match.score },
  };
}