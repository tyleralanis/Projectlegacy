import type {
  CandidateEntity,
  IntentRequest,
  IntentResponse,
  LegacyAICapabilities,
} from '@project-legacy/legacy-ai';
import { Platform } from 'react-native';

import { ACTION_CATALOG } from '@/content/actionCatalog';
import { DEPTH_ACTION_CATALOG } from '@/content/depthActionCatalog';
import type { Domain, WorldState } from '@/engine/types';

const ALL_ACTIONS = [...ACTION_CATALOG, ...DEPTH_ACTION_CATALOG];

const ALIASES: Record<string, string[]> = {
  'relationship.contact': ['call', 'contact', 'message', 'reach out', 'text'],
  'relationship.spend_time': ['spend time', 'visit', 'hang out', 'see my'],
  'relationship.date': ['ask out', 'go on a date', 'start dating', 'date'],
  'relationship.support': ['support', 'help out', 'be there for'],
  'relationship.transfer_cash': ['give', 'send', 'transfer', 'gift cash'],
  'relationship.propose': ['propose', 'ask to marry', 'get married'],
  'relationship.separate': ['separate', 'break up', 'end the relationship', 'divorce'],
  'relationship.prioritize': ['make them a priority', 'prioritize', 'focus on my relationship', 'focus on our relationship', 'make time every week'],
  'relationship.deep_talk': ['deep talk', 'real conversation', 'heart to heart', 'talk things through', 'have an honest conversation'],
  'relationship.check_in': ['check in', 'ask how they are', 'ask about their life', 'see how they are doing'],
  'relationship.apologize': ['apologize', 'say sorry', 'own what i did', 'make an apology'],
  'relationship.forgive': ['forgive', 'let it go', 'stop holding it against'],
  'relationship.celebrate': ['celebrate', 'celebrate them', 'celebrate with'],
  'relationship.gift': ['thoughtful gift', 'buy a gift', 'give a gift', 'get them a gift'],
  'relationship.date_night': ['date night', 'take my wife out', 'take my husband out', 'take my partner out'],
  'relationship.weekend_away': ['weekend away', 'romantic weekend', 'take a trip together', 'get away together'],
  'relationship.support_goal': ['support their goal', 'help with their goal', 'back their goal', 'support their career', 'support their dream'],
  'relationship.ask_favor': ['ask a favor', 'ask for help', 'call in a favor'],
  'relationship.lend_money': ['lend money', 'loan money', 'give them a loan'],
  'relationship.collect_loan': ['ask for repayment', 'collect the loan', 'pay me back', 'ask them to repay'],
  'relationship.set_boundary': ['set a boundary', 'set boundaries', 'draw a line'],
  'relationship.one_on_one': ['one on one', 'one-on-one', 'quality time alone', 'spend time alone together'],
  'relationship.reminisce': ['reminisce', 'talk about old times', 'remember when', 'talk about our past'],
  'relationship.plan_future': ['plan our future', 'talk about the future', 'future together', 'make plans together'],
  'relationship.introduce_network': ['make an introduction', 'introduce them to', 'connect them with', 'use my network for'],

  'family.family_dinner': ['family dinner', 'have everyone over', 'get the family together', 'dinner with the family'],
  'family.help_school': ['help with school', 'help with homework', 'tutor my child', 'help them study'],
  'family.teach_money': ['teach about money', 'teach finances', 'teach them about money', 'financial lesson'],
  'family.attend_event': ['attend their event', 'show up for', 'go to their game', 'go to their recital', 'go to their graduation'],
  'family.caregiving': ['care for', 'take care of', 'help my aging parent', 'caregiving', 'help with their health'],
  'family.set_expectations': ['set expectations', 'set rules', 'parenting rules', 'give them rules'],
  'family.invite_business': ['bring into the business', 'hire my child', 'hire my brother', 'hire my sister', 'family business job'],
  'family.discuss_inheritance': ['discuss inheritance', 'talk about inheritance', 'talk about my will', 'talk about succession'],

  'education.study': ['study', 'focus on school', 'academics'],
  'education.apply': ['apply to school', 'apply to college', 'university application'],
  'education.enroll': ['enroll', 'accept the school offer', 'start the program'],
  'education.choose_major': ['choose a major', 'declare a major', 'major in', 'study finance', 'study business', 'study computer science', 'study engineering'],
  'education.office_hours': ['office hours', 'meet my professor', 'talk to my professor', 'get help from professor'],
  'education.join_club': ['join a college club', 'join a campus club', 'campus organization', 'student club'],
  'education.internship': ['get an internship', 'take an internship', 'find an internship', 'internship'],
  'education.sports_train': ['train for sports', 'train harder', 'athletic training', 'practice harder'],
  'education.sports_compete': ['compete', 'play the game', 'enter competition', 'compete in sports'],
  'education.sports_seek_scholarship': ['athletic scholarship', 'sports scholarship', 'seek a scholarship'],

  'career.apply': ['apply for', 'find a job', 'get a job', 'look for work'],
  'career.request_raise': ['ask for a raise', 'request a raise', 'more pay'],
  'career.quit': ['quit', 'resign', 'leave my job'],
  'career.work_hard': ['work harder', 'push at work', 'grind at work', 'focus on performance'],
  'career.network': ['network at work', 'build my network', 'career networking', 'professional networking'],
  'career.train': ['learn job skills', 'train for my job', 'take job training', 'improve my skills'],
  'career.seek_promotion': ['ask for promotion', 'go for a promotion', 'seek promotion', 'get promoted'],
  'career.office_politics': ['office politics', 'build internal support', 'play office politics', 'win over leadership'],

  'business.create': [
    'start a business', 'found a company', 'open a company', 'start a company', 'start a startup',
    'launch a startup', 'start an app', 'build an app', 'make an app', 'launch an app',
    'software company', 'software startup', 'tech startup',
  ],
  'business.contribute_capital': ['put money into', 'add capital', 'invest in my company', 'fund my business'],
  'business.borrow': ['business loan', 'borrow for the company', 'borrow for my business'],
  'business.advertise': ['advertise', 'marketing budget', 'increase marketing', 'spend on marketing'],
  'business.hire': ['hire', 'add employees', 'recruit staff', 'hire someone'],
  'business.delegate': ['delegate', 'hire a manager', 'hire an operator', 'operator'],
  'business.raise_capital': ['raise capital', 'sell equity', 'bring in investors', 'find investors'],
  'business.sell': ['sell my business', 'sell the company', 'sell my company', 'sell business', 'exit my business', 'exit the company'],
  'business.set_growth_posture': ['set growth posture', 'grow aggressively', 'slow growth', 'conservative growth', 'aggressive growth'],
  'business.invest_quality': ['invest in quality', 'improve quality', 'quality improvements', 'make the product better'],
  'business.invest_rd': ['invest in r&d', 'research and development', 'develop new products', 'product development'],
  'business.reward_staff': ['reward employees', 'employee bonuses', 'staff bonus', 'pay bonuses'],
  'business.expand_location': ['open another location', 'expand locations', 'second location', 'new branch'],

  'property.buy': ['buy a property', 'buy a home', 'buy the duplex', 'purchase property', 'buy a house'],
  'property.sell': ['sell the property', 'sell my house', 'sell the duplex'],
  'property.rent_out': ['rent it out', 'find a tenant', 'lease the property', 'rent my house'],
  'property.set_rent': ['set rent', 'raise rent', 'lower rent'],
  'property.refinance': ['refinance', 'borrow against equity'],

  'markets.buy': ['buy shares', 'buy stock', 'invest in'],
  'markets.sell': ['sell shares', 'sell stock'],
  'markets.allocate': ['invest my savings', 'diversified fund', 'allocate'],
  'markets.research': ['research the stock', 'research stock', 'research company', 'build a thesis', 'analyze the stock'],
  'markets.set_strategy': ['set investment strategy', 'investing strategy', 'be an index investor', 'value investing', 'growth investing', 'income investing', 'speculative investing'],
  'markets.rebalance': ['rebalance', 'rebalance portfolio', 'balance my portfolio'],

  'organization.create': ['start an organization', 'create an organization', 'form a group', 'start a group', 'start a club', 'start a charity', 'start a movement'],
  'organization.found_inner_circle': ['start a cult', 'form a cult', 'create a cult', 'start my own cult', 'found a cult', 'build a secret movement'],
  'organization.join': ['join the', 'become a member'],
  'organization.fund': ['fund the', 'donate to'],
  'organization.take_control_attempt': ['take control of', 'lead the organization', 'challenge the leader'],
  'faction.set_archetype': ['make it religious', 'make it military', 'make it political', 'make it communal', 'make it commercial', 'choose cult type'],
  'faction.recruit': ['recruit followers', 'gain followers', 'grow followers', 'recruit members'],
  'faction.hold_gathering': ['hold a gathering', 'hold a meeting', 'gather followers'],
  'faction.collect_contributions': ['collect contributions', 'collect tithes', 'take their money', 'collect follower money'],
  'faction.buy_land': ['buy land for the group', 'buy cult land', 'buy a compound', 'purchase land for followers'],
  'faction.spread_doctrine': ['spread religion', 'spread doctrine', 'spread the faith', 'convert people'],
  'faction.elevate_leader': ['make them worship me', 'worship me', 'center the cult on me', 'deify me'],
  'faction.adopt_plural_household': ['allow multiple spouses', 'plural marriage', 'multiple wives', 'multiple husbands', 'plural household'],
  'faction.invite_plural_spouse': ['take another spouse', 'invite another spouse', 'add another spouse'],
  'faction.build_security': ['arm the followers', 'build security force', 'build security wing', 'increase firepower', 'military wing'],
  'faction.expand_public_influence': ['grow public influence', 'gain legitimacy', 'public campaign for the movement'],
  'faction.member_welfare': ['support members', 'help followers', 'member welfare'],
  'faction.attempt_power_seizure': ['use my followers to seize power', 'launch the coup', 'attempt the coup', 'seize national power with my movement'],

  'politics.run_for_office': ['run for', 'campaign for office', 'run for mayor', 'run for council'],
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

function relationshipAliases(world: WorldState, characterId: string): string[] {
  const actor = world.characters[world.playerCharacterId];
  const relationship = Object.values(world.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(characterId));
  if (!relationship) return ['known person'];
  const aliases: string[] = [];
  if (actor.parentIds.includes(characterId)) aliases.push('my parent', 'parent');
  if (actor.childIds.includes(characterId)) aliases.push('my child', 'my kid', 'child');
  if (actor.partnerId === characterId) aliases.push('my partner', 'my spouse', 'my wife', 'my husband');
  if (relationship.kind === 'sibling') aliases.push('my sibling', 'my brother', 'my sister');
  if (relationship.kind === 'friend') aliases.push('my friend');
  if (relationship.kind === 'rival') aliases.push('my rival');
  if (relationship.kind === 'professional') aliases.push('my coworker', 'my colleague', 'professional contact');
  if (relationship.kind === 'relative') aliases.push('my relative', 'family');
  return aliases.length > 0 ? aliases : [relationship.kind];
}

function candidatesFromWorld(world: WorldState): CandidateEntity[] {
  const actor = world.characters[world.playerCharacterId];
  const people = Object.values(world.characters)
    .filter((character) => character.id !== actor.id && character.isAlive)
    .slice(0, 30)
    .map((character) => ({
      id: character.id,
      type: 'character',
      name: `${character.firstName} ${character.lastName}`,
      aliases: [character.firstName.toLowerCase(), character.lastName.toLowerCase(), ...relationshipAliases(world, character.id)],
      facts: {
        relationshipRole: relationshipAliases(world, character.id)[0] ?? 'known person',
        isLiving: character.isAlive,
        cityId: character.cityId,
      },
    }));
  const assets: CandidateEntity[] = [
    ...Object.values(world.businesses).filter((business) => business.active).map((business) => ({ id: business.id, type: 'business', name: business.name, aliases: ['my business', 'my company', business.sector.toLowerCase()], facts: { ownershipBps: business.playerOwnershipBps } })),
    ...Object.values(world.properties).map((property) => ({ id: property.id, type: 'property', name: property.name, aliases: ['my property', property.kind], facts: { ownerId: property.ownerId } })),
    ...Object.values(world.securities).map((security) => ({ id: security.id, type: 'security', name: security.name, aliases: [security.symbol.toLowerCase(), `${security.name.toLowerCase()} stock`] })),
    ...Object.values(world.organizations).map((organization) => ({ id: organization.id, type: 'organization', name: organization.name, aliases: [organization.kind] })),
    ...Object.values(world.education).filter((record) => record.characterId === actor.id && record.status === 'accepted').map((record) => ({ id: record.id, type: 'education', name: record.level, aliases: ['my offer', 'school offer', 'the program'] })),
  ];
  return [...people, ...assets].slice(0, 70);
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

function definitionsForDomains(domains: Domain[]) {
  return ALL_ACTIONS.filter((action) => domains.includes(action.domain));
}

function inferParameters(actionId: string, normalized: string, amountCents: number | undefined, percentBps: number | undefined): Record<string, number | string | boolean | null> {
  const parameters: Record<string, number | string | boolean | null> = {};
  if (amountCents !== undefined) parameters.amountCents = amountCents;
  if (percentBps !== undefined) {
    if (actionId === 'business.advertise') parameters.marketingBps = percentBps;
    else parameters.equityBps = percentBps;
  }

  if (actionId === 'business.create' && /\b(app|software|tech|technology)\b/.test(normalized)) parameters.sector = 'Technology';
  if (actionId === 'business.create' && /\b(real estate|property company)\b/.test(normalized)) parameters.sector = 'Real Estate';
  if (actionId === 'business.create' && /\b(logistics|trucking|delivery|transport)\b/.test(normalized)) parameters.sector = 'Logistics';
  if (actionId === 'business.set_growth_posture') parameters.posture = normalized.includes('aggressive') ? 'aggressive' : normalized.includes('conservative') || normalized.includes('slow') ? 'conservative' : 'balanced';

  if (actionId === 'markets.set_strategy') {
    parameters.strategy = normalized.includes('index') ? 'index'
      : normalized.includes('value') ? 'value'
        : normalized.includes('growth') ? 'growth'
          : normalized.includes('income') || normalized.includes('dividend') ? 'income'
            : normalized.includes('concentrated') ? 'concentrated'
              : normalized.includes('speculative') || normalized.includes('risky') ? 'speculative'
                : 'index';
  }

  if (actionId === 'education.choose_major') {
    parameters.major = /\b(finance|accounting|economics)\b/.test(normalized) ? 'Finance'
      : /\b(computer|software|technology|coding)\b/.test(normalized) ? 'Computer Science'
        : /\b(engineer|engineering)\b/.test(normalized) ? 'Engineering'
          : /\b(law|politic|government)\b/.test(normalized) ? 'Law & Policy'
            : /\b(business|management|entrepreneur)\b/.test(normalized) ? 'Business'
              : 'General studies';
  }

  if (actionId === 'education.join_club') parameters.club = normalized.includes('business') ? 'Entrepreneurship Society' : normalized.includes('debate') ? 'Debate Society' : 'Campus Society';

  if (actionId === 'organization.create') {
    parameters.kind = normalized.includes('charity') ? 'charity' : normalized.includes('club') ? 'club' : normalized.includes('movement') ? 'other' : 'other';
    parameters.name = normalized.includes('charity') ? 'New charity' : normalized.includes('club') ? 'New club' : normalized.includes('movement') ? 'New movement' : 'New organization';
  }

  if (actionId === 'organization.found_inner_circle') {
    parameters.name = 'The Inner Circle';
    parameters.archetype = /\b(military|army|militia|security)\b/.test(normalized) ? 'military'
      : /\b(religious|religion|faith|church|spiritual)\b/.test(normalized) ? 'religious'
        : /\b(political|party|government)\b/.test(normalized) ? 'political'
          : /\b(commune|communal|community)\b/.test(normalized) ? 'communal'
            : /\b(commercial|business|money)\b/.test(normalized) ? 'commercial'
              : 'undecided';
  }

  if (actionId === 'faction.set_archetype') {
    parameters.archetype = /\b(military|army|militia|security)\b/.test(normalized) ? 'military'
      : /\b(religious|religion|faith|church|spiritual)\b/.test(normalized) ? 'religious'
        : /\b(political|party|government)\b/.test(normalized) ? 'political'
          : /\b(commune|communal|community)\b/.test(normalized) ? 'communal'
            : /\b(commercial|business|money)\b/.test(normalized) ? 'commercial'
              : 'religious';
  }
  if (actionId === 'faction.collect_contributions') parameters.pressure = /\b(take their money|all their money|aggressive|force|hard)\b/.test(normalized) ? 'aggressive' : 'normal';

  return parameters;
}

const NO_TARGET_ACTIONS = new Set([
  'business.create',
  'organization.create',
  'organization.found_inner_circle',
  'property.buy',
  'markets.allocate',
  'markets.set_strategy',
  'markets.rebalance',
  'politics.run_for_office',
  'career.apply',
  'career.work_hard',
  'career.network',
  'career.train',
  'career.seek_promotion',
  'career.office_politics',
  'education.apply',
  'education.study',
  'education.choose_major',
  'education.office_hours',
  'education.join_club',
  'education.internship',
  'education.sports_train',
  'education.sports_compete',
  'education.sports_seek_scholarship',
  'faction.set_archetype',
  'faction.recruit',
  'faction.hold_gathering',
  'faction.collect_contributions',
  'faction.buy_land',
  'faction.spread_doctrine',
  'faction.elevate_leader',
  'faction.adopt_plural_household',
  'faction.invite_plural_spouse',
  'faction.build_security',
  'faction.expand_public_influence',
  'faction.member_welfare',
  'faction.attempt_power_seizure',
  'misconduct.tax_evasion_attempt',
  'misconduct.faction_power_seizure_attempt',
]);

function fallbackInterpret(request: IntentRequest): IntentResponse {
  const normalized = request.text.toLowerCase().replace(/[’']/g, "'").trim();
  const matches = request.allowedActions
    .map((actionId) => ({ actionId, score: Math.max(0, ...(ALIASES[actionId] ?? []).map((alias) => (normalized.includes(alias) ? alias.length : 0))) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);
  if (matches.length === 0) {
    return { requestId: request.requestId, status: 'unsupported', modeUsed: 'baseline', confidence: 0.2, requiresConfirmation: false, clarification: 'I could not map that to a supported action yet. Try naming what you want to do and the person, business, property, school, investment, career move, or amount involved.', actions: [], safetyFlags: [], diagnostics: { reason: 'no_supported_action_match' } };
  }

  const best = matches[0];
  const ambiguousAction = matches[1] && matches[1].score === best.score;
  if (ambiguousAction) {
    const first = ALL_ACTIONS.find((action) => action.id === best.actionId)?.label.toLowerCase() ?? best.actionId;
    const second = ALL_ACTIONS.find((action) => action.id === matches[1].actionId)?.label.toLowerCase() ?? matches[1].actionId;
    return { requestId: request.requestId, status: 'clarification', modeUsed: 'baseline', confidence: 0.52, requiresConfirmation: false, clarification: `Did you mean ${first} or ${second}?`, actions: [], safetyFlags: [], diagnostics: { reason: 'ambiguous_action', candidates: matches.slice(0, 2).map((match) => match.actionId) } };
  }

  const targetMatches = request.candidates
    .map((candidate) => ({ candidate, score: [candidate.name.toLowerCase(), ...(candidate.aliases ?? []).map((alias) => alias.toLowerCase())].reduce((score, alias) => Math.max(score, normalized.includes(alias) ? alias.length : 0), 0) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const definition = ALL_ACTIONS.find((action) => action.id === best.actionId);
  const parameters = inferParameters(best.actionId, normalized, parseAmountCents(normalized), parsePercentBps(normalized));
  const needsTarget = !NO_TARGET_ACTIONS.has(best.actionId);
  const target = targetMatches[0]?.candidate;
  if (needsTarget && !target) {
    return { requestId: request.requestId, status: 'clarification', modeUsed: 'baseline', confidence: 0.62, requiresConfirmation: false, clarification: 'Which person, business, property, security, case, school, or organization do you mean?', actions: [], safetyFlags: [], diagnostics: { reason: 'missing_target', proposedVerb: best.actionId } };
  }

  if (needsTarget && targetMatches.length > 1 && targetMatches[0].score === targetMatches[1].score) {
    const options = targetMatches.slice(0, 3).map((item) => item.candidate.name).join(', ');
    return { requestId: request.requestId, status: 'clarification', modeUsed: 'baseline', confidence: 0.7, requiresConfirmation: false, clarification: `Which one do you mean: ${options}?`, actions: [], safetyFlags: [], diagnostics: { reason: 'ambiguous_target', proposedVerb: best.actionId, candidates: targetMatches.slice(0, 3).map((item) => item.candidate.id) } };
  }

  const targetIds = best.actionId === 'estate.gift_asset' ? targetMatches.slice(0, 3).map((match) => match.candidate.id) : target ? [target.id] : [];
  const sensitive = best.actionId.startsWith('misconduct.') || best.actionId === 'faction.attempt_power_seizure' || best.actionId === 'faction.build_security';
  return {
    requestId: request.requestId,
    status: 'proposal',
    modeUsed: 'baseline',
    confidence: 0.94,
    requiresConfirmation: Boolean(definition?.destructive || definition?.confirmationMandatory),
    actions: [{ verb: best.actionId, targetIds, parameters, destructive: definition?.destructive }],
    safetyFlags: sensitive ? ['abstract_sensitive_action'] : [],
    diagnostics: { parser: 'deterministic_alias_match', matchedAliasLength: best.score },
  };
}

export async function interpretPlayerIntent(world: WorldState, text: string, domains: Domain[]): Promise<IntentResponse> {
  const request: IntentRequest = {
    requestId: `intent-${Date.now()}`,
    text,
    actorId: world.playerCharacterId,
    domain: domains[0] ?? 'life',
    allowedActions: definitionsForDomains(domains).map((action) => action.id),
    candidates: candidatesFromWorld(world),
    activeContext: {
      legacyAIEnhancedEnabled: world.settings.enhancedAIEnabled,
      currentWeek: world.calendar.week,
    },
  };

  const deterministic = fallbackInterpret(request);
  if (deterministic.status === 'proposal' && deterministic.confidence >= 0.82) return deterministic;

  if (Platform.OS === 'ios' && world.settings.enhancedAIEnabled) {
    try {
      const module = await import('@project-legacy/legacy-ai');
      const enhanced = await module.interpretIntent(request);
      if (enhanced.status === 'proposal' || enhanced.confidence > deterministic.confidence) return enhanced;
    } catch {}
  }
  return deterministic;
}

export async function getLegacyAICapabilities(): Promise<LegacyAICapabilities> {
  if (Platform.OS === 'ios') {
    try {
      const module = await import('@project-legacy/legacy-ai');
      return await module.getCapabilities();
    } catch {}
  }
  return { moduleVersion: 'typescript-fallback', baselineAvailable: true, enhancedAvailable: false, enhancedReason: 'The built-in interpreter remains available offline.', supportedLanguages: ['en'] };
}
