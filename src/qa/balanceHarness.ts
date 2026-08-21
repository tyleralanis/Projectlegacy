import { allocateId, createWorld } from '../engine/createWorld';
import { netWorthCents } from '../engine/money';
import { resolveEvent } from '../engine/simulationEventBridge';
import { advanceWorld } from '../engine/simulation';
import { applySupplementalAdvance, normalizeSupplementalState } from '../engine/supplementalDepthBridge';
import type { Business, Character, GameEvent, PropertyAsset, WorldState } from '../engine/types';

export type BalanceArchetypeId =
  | 'balanced'
  | 'corporate'
  | 'scholar'
  | 'entrepreneur'
  | 'investor'
  | 'real-estate'
  | 'athlete'
  | 'politician'
  | 'family-first'
  | 'inherited-wealth'
  | 'reckless';

export interface BalanceQaOptions {
  lives?: number;
  endAge?: number;
  longLives?: number;
  longLifeEndAge?: number;
}

export interface BalanceLifeResult {
  seed: string;
  archetype: BalanceArchetypeId;
  startAge: number;
  endAge: number;
  originalCharacterAlive: boolean;
  finalNetWorthCents: number;
  peakNetWorthCents: number;
  minimumCashCents: number;
  finalCashCents: number;
  finalHealth: number;
  finalMood: number;
  finalStress: number;
  activeBusinesses: number;
  failedBusinesses: number;
  propertiesOwned: number;
  holdingsOwned: number;
  relationshipsTracked: number;
  strongRelationships: number;
  strainedRelationships: number;
  careerSalaryAnnualCents: number;
  eventCount: number;
  uniqueEventTemplates: number;
  feedEntries: number;
  uniqueFeedTitles: number;
  quietYears: number;
  callbackCount: number;
  ordinaryMomentCount: number;
  narrativeArcCount: number;
  maxBusinessMargin: number;
  maxPropertyGrossYield: number;
  warnings: string[];
  hardFailures: string[];
}

export interface ArchetypeBalanceSummary {
  archetype: BalanceArchetypeId;
  lives: number;
  medianFinalNetWorthCents: number;
  p90FinalNetWorthCents: number;
  medianPeakNetWorthCents: number;
  medianHealth: number;
  medianStress: number;
  survivalRate: number;
  negativeLiquidityRate: number;
  extremeWealthRate: number;
  medianUniqueFeedTitles: number;
  quietYearRate: number;
  medianCallbacks: number;
  medianOrdinaryMoments: number;
  medianNarrativeArcs: number;
  warnings: number;
  hardFailures: number;
}

export interface BalanceQaReport {
  generatedAt: string;
  lives: number;
  longLives: number;
  archetypes: BalanceArchetypeId[];
  summaries: ArchetypeBalanceSummary[];
  globalWarnings: string[];
  hardFailures: string[];
  worstWarningExamples: Array<{ archetype: BalanceArchetypeId; seed: string; warnings: string[] }>;
}

export const BALANCE_ARCHETYPES: BalanceArchetypeId[] = [
  'balanced',
  'corporate',
  'scholar',
  'entrepreneur',
  'investor',
  'real-estate',
  'athlete',
  'politician',
  'family-first',
  'inherited-wealth',
  'reckless',
];

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const position = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * fraction)));
  return sorted[position];
}

function median(values: number[]): number {
  return percentile(values, 0.5);
}

function startAgeFor(archetype: BalanceArchetypeId): number {
  if (archetype === 'politician') return 30;
  if (archetype === 'family-first') return 28;
  if (archetype === 'inherited-wealth') return 25;
  return 18;
}

function player(world: WorldState): Character {
  return world.characters[world.playerCharacterId];
}

function deactivatePlayerCareer(world: WorldState): void {
  const actor = player(world);
  for (const career of Object.values(world.careers)) {
    if (career.characterId === actor.id) career.active = false;
  }
}

function ensureCareer(
  world: WorldState,
  options: {
    title: string;
    sector: string;
    weeklySalaryCents: number;
    performance?: number;
    satisfaction?: number;
    hoursPerWeek?: number;
    level?: number;
  },
): void {
  const actor = player(world);
  deactivatePlayerCareer(world);
  const id = allocateId(world, 'career');
  world.careers[id] = {
    id,
    characterId: actor.id,
    employerId: 'organization-northstar-logistics',
    title: options.title,
    sector: options.sector,
    weeklySalaryCents: options.weeklySalaryCents,
    performance: options.performance ?? 62,
    satisfaction: options.satisfaction ?? 64,
    weeksInRole: 10,
    active: true,
    hoursPerWeek: options.hoursPerWeek ?? 40,
    level: options.level ?? 2,
    department: options.sector,
    promotionProgress: 10,
    organizationStanding: 54,
  };
}

function addBusiness(
  world: WorldState,
  options: {
    name: string;
    sector: string;
    cashCents: number;
    revenueWeeklyCents: number;
    costWeeklyCents: number;
    employees: number;
    capacity: number;
    demand: number;
    delegated?: boolean;
    managerQuality?: number;
  },
): Business {
  const actor = player(world);
  const organizationId = allocateId(world, 'organization');
  world.organizations[organizationId] = {
    id: organizationId,
    kind: 'business',
    name: options.name,
    resourcesCents: options.cashCents,
    influence: 38,
    stability: 55,
    memberIds: [actor.id],
    leaderId: actor.id,
    history: ['Created for internal balance QA.'],
  };
  const id = allocateId(world, 'business');
  const business: Business = {
    id,
    organizationId,
    name: options.name,
    sector: options.sector,
    cityId: actor.cityId,
    founderId: actor.id,
    ownerId: actor.id,
    cashCents: options.cashCents,
    debtCents: 0,
    revenueWeeklyCents: options.revenueWeeklyCents,
    costWeeklyCents: options.costWeeklyCents,
    valuationCents: Math.max(options.cashCents * 2, options.revenueWeeklyCents * 104),
    playerOwnershipBps: 10_000,
    votingControlBps: 10_000,
    employees: options.employees,
    capacity: options.capacity,
    demand: options.demand,
    quality: 62,
    reputation: 56,
    marketingBps: 500,
    pricePosition: 'market',
    growthPosture: 'balanced',
    delegated: options.delegated ?? false,
    active: true,
    managerName: options.delegated ? 'QA Executive' : undefined,
    managerQuality: options.managerQuality,
    managerSalaryWeeklyCents: options.delegated ? 380_000 : undefined,
    personalTimeHours: options.delegated ? 5 : 22,
    marketShare: 2,
    customerLoyalty: 54,
    culture: 60,
    complexity: Math.max(10, options.employees * 1.4),
    locations: 1,
  };
  world.businesses[id] = business;
  return business;
}

function addProperty(
  world: WorldState,
  options: {
    name: string;
    kind: PropertyAsset['kind'];
    valueCents: number;
    debtCents: number;
    weeklyRentCents: number;
    weeklyCostsCents: number;
    managed?: boolean;
  },
): PropertyAsset {
  const actor = player(world);
  const id = allocateId(world, 'property');
  const property: PropertyAsset = {
    id,
    name: options.name,
    kind: options.kind,
    cityId: actor.cityId,
    ownerId: actor.id,
    valueCents: options.valueCents,
    debtCents: options.debtCents,
    condition: 78,
    occupancy: 'tenant',
    weeklyRentCents: options.weeklyRentCents,
    weeklyCostsCents: options.weeklyCostsCents,
    managed: options.managed ?? true,
  };
  world.properties[id] = property;
  return property;
}

function addDiversifiedHoldings(world: WorldState, totalCents: number): void {
  const actor = player(world);
  const securities = Object.values(world.securities).slice(0, 4);
  if (securities.length === 0) return;
  const each = Math.floor(totalCents / securities.length);
  for (const security of securities) {
    const unitsMilli = Math.max(1, Math.floor((each * 1000) / Math.max(1, security.priceCents)));
    const id = allocateId(world, 'holding');
    world.holdings[id] = {
      id,
      ownerId: actor.id,
      securityId: security.id,
      unitsMilli,
      costBasisCents: Math.round((unitsMilli * security.priceCents) / 1000),
    };
  }
}

function addPartnerAndChildren(world: WorldState, children = 2): void {
  const actor = player(world);
  const partnerId = allocateId(world, 'character');
  const partnerAge = Math.max(22, Math.floor((world.calendar.week - actor.birthWeek) / 52) - 1);
  world.characters[partnerId] = {
    ...actor,
    id: partnerId,
    firstName: 'Jamie',
    lastName: actor.lastName,
    birthWeek: world.calendar.week - partnerAge * 52,
    partnerId: actor.id,
    parentIds: [],
    childIds: [],
    cashCents: 1_500_000,
    focuses: ['Family', 'Job', 'Health'],
    detailTier: 'standard',
  };
  actor.partnerId = partnerId;
  const relationshipId = allocateId(world, 'relationship');
  world.relationships[relationshipId] = {
    id: relationshipId,
    characterIds: [actor.id, partnerId],
    kind: 'spouse',
    trust: 76,
    affection: 80,
    respect: 72,
    resentment: 4,
    lastInteractionWeek: world.calendar.week,
  };

  for (let index = 0; index < children; index += 1) {
    const childId = allocateId(world, 'character');
    const age = Math.max(0, 5 - index * 3);
    world.characters[childId] = {
      ...actor,
      id: childId,
      firstName: index === 0 ? 'Avery' : 'Rowan',
      birthWeek: world.calendar.week - age * 52,
      partnerId: undefined,
      parentIds: [actor.id, partnerId],
      childIds: [],
      cashCents: 0,
      health: 88,
      mood: 74,
      stress: 8,
      knowledge: age * 4,
      focuses: ['Family', 'Health', 'Creative Work'],
      professionId: undefined,
      competencies: {},
      detailTier: 'standard',
    };
    actor.childIds.push(childId);
    world.characters[partnerId].childIds.push(childId);
    const childRelationshipId = allocateId(world, 'relationship');
    world.relationships[childRelationshipId] = {
      id: childRelationshipId,
      characterIds: [actor.id, childId],
      kind: 'child',
      trust: 82,
      affection: 90,
      respect: 60,
      resentment: 0,
      lastInteractionWeek: world.calendar.week,
    };
  }
}

function configureArchetype(world: WorldState, archetype: BalanceArchetypeId): WorldState {
  const actor = player(world);
  actor.competencies = { ...(actor.competencies ?? {}) };

  if (archetype === 'balanced') {
    actor.focuses = ['Job', 'Family', 'Health'];
    actor.competencies = { management: 55, communication: 58, finance: 50, negotiation: 52 };
    return world;
  }

  if (archetype === 'corporate') {
    actor.focuses = ['Job', 'Networking', 'Health'];
    actor.discipline = 78;
    actor.ambition = 84;
    actor.competencies = { management: 68, leadership: 64, communication: 72, negotiation: 67, finance: 58 };
    ensureCareer(world, { title: 'Business analyst', sector: 'Business', weeklySalaryCents: 155_000, performance: 72, satisfaction: 65, hoursPerWeek: 45, level: 2 });
    return world;
  }

  if (archetype === 'scholar') {
    actor.focuses = ['Academics', 'Networking', 'Health'];
    actor.discipline = 80;
    actor.knowledge = 68;
    actor.competencies = { academics: 78, communication: 64, technology: 60 };
    deactivatePlayerCareer(world);
    const educationId = allocateId(world, 'education');
    world.education[educationId] = {
      id: educationId,
      characterId: actor.id,
      institutionId: 'university-harborview-state',
      status: 'higher',
      startedWeek: world.calendar.week,
      level: 'Undergraduate program',
      recordedGrade: 84,
      knowledgeGain: actor.knowledge,
      prestige: 68,
      network: 62,
      tuitionCentsPerYear: 2_100_000,
      manipulatedCredential: false,
      major: 'Economics',
      clubs: [],
    };
    return world;
  }

  if (archetype === 'entrepreneur') {
    actor.focuses = ['Startup', 'Networking', 'Health'];
    actor.cashCents = Math.max(actor.cashCents, 8_000_000);
    actor.discipline = 74;
    actor.ambition = 90;
    actor.riskTolerance = 78;
    actor.competencies = { management: 66, leadership: 68, sales: 72, finance: 58, negotiation: 64 };
    deactivatePlayerCareer(world);
    const business = addBusiness(world, { name: 'QA Foundry', sector: 'Technology', cashCents: 5_000_000, revenueWeeklyCents: 650_000, costWeeklyCents: 590_000, employees: 5, capacity: 48, demand: 42 });
    actor.cashCents -= 5_000_000;
    business.growthPosture = 'aggressive';
    return world;
  }

  if (archetype === 'investor') {
    actor.focuses = ['Job', 'Networking', 'Health'];
    actor.cashCents = 20_000_000;
    actor.riskTolerance = 62;
    actor.competencies = { finance: 78, investing: 82, negotiation: 62, communication: 56 };
    ensureCareer(world, { title: 'Financial analyst', sector: 'Finance', weeklySalaryCents: 190_000, performance: 70, satisfaction: 62, hoursPerWeek: 38, level: 2 });
    addDiversifiedHoldings(world, 14_000_000);
    actor.cashCents -= 14_000_000;
    return world;
  }

  if (archetype === 'real-estate') {
    actor.focuses = ['Job', 'Networking', 'Health'];
    actor.cashCents = 12_000_000;
    actor.competencies = { finance: 66, investing: 64, management: 58, negotiation: 68 };
    ensureCareer(world, { title: 'Project coordinator', sector: 'Real Estate', weeklySalaryCents: 145_000, performance: 64, satisfaction: 62, hoursPerWeek: 40, level: 2 });
    addProperty(world, { name: 'QA Duplex', kind: 'multifamily', valueCents: 32_000_000, debtCents: 24_000_000, weeklyRentCents: 105_000, weeklyCostsCents: 24_000, managed: true });
    addProperty(world, { name: 'QA Retail', kind: 'commercial', valueCents: 48_000_000, debtCents: 34_000_000, weeklyRentCents: 150_000, weeklyCostsCents: 36_000, managed: true });
    actor.cashCents -= 10_000_000;
    return world;
  }

  if (archetype === 'athlete') {
    actor.focuses = ['Sport', 'Health', 'Networking'];
    actor.fitness = 90;
    actor.health = 92;
    actor.discipline = 78;
    actor.competencies = { athletics: 88, communication: 58, media: 55 };
    ensureCareer(world, { title: 'Professional athlete', sector: 'Sports', weeklySalaryCents: 380_000, performance: 76, satisfaction: 78, hoursPerWeek: 46, level: 3 });
    return world;
  }

  if (archetype === 'politician') {
    actor.focuses = ['Campaign', 'Networking', 'Family'];
    actor.charisma = 78;
    actor.ambition = 86;
    actor.competencies = { politics: 76, communication: 79, negotiation: 70, leadership: 72 };
    world.politics[actor.id] = {
      characterId: actor.id,
      partyId: 'organization-civic-alliance',
      authority: 18,
      approval: 54,
      office: 'Harborview Council',
      officeLevel: 'local',
    };
    ensureCareer(world, { title: 'Policy director', sector: 'Government', weeklySalaryCents: 140_000, performance: 67, satisfaction: 66, hoursPerWeek: 42, level: 3 });
    return world;
  }

  if (archetype === 'family-first') {
    actor.focuses = ['Family', 'Partner', 'Health'];
    actor.empathy = 82;
    actor.discipline = 68;
    actor.competencies = { parenting: 76, communication: 72, management: 50 };
    ensureCareer(world, { title: 'Operations specialist', sector: 'Operations', weeklySalaryCents: 135_000, performance: 62, satisfaction: 72, hoursPerWeek: 32, level: 2 });
    addPartnerAndChildren(world, 2);
    return world;
  }

  if (archetype === 'inherited-wealth') {
    actor.focuses = ['Family', 'Networking', 'Health'];
    actor.cashCents = 500_000_000;
    actor.competencies = { finance: 64, investing: 58, management: 52, negotiation: 55 };
    deactivatePlayerCareer(world);
    addDiversifiedHoldings(world, 260_000_000);
    actor.cashCents -= 260_000_000;
    addProperty(world, { name: 'Inherited Apartments', kind: 'multifamily', valueCents: 180_000_000, debtCents: 30_000_000, weeklyRentCents: 610_000, weeklyCostsCents: 145_000, managed: true });
    addProperty(world, { name: 'Inherited Office', kind: 'commercial', valueCents: 140_000_000, debtCents: 20_000_000, weeklyRentCents: 440_000, weeklyCostsCents: 120_000, managed: true });
    return world;
  }

  actor.focuses = ['Startup', 'Networking', 'Creative Work'];
  actor.cashCents = 1_000_000;
  actor.riskTolerance = 96;
  actor.discipline = 34;
  actor.ethics = 44;
  actor.stress = 55;
  actor.competencies = { sales: 56, management: 36, finance: 32, investing: 40 };
  ensureCareer(world, { title: 'Commission sales rep', sector: 'Sales', weeklySalaryCents: 105_000, performance: 52, satisfaction: 45, hoursPerWeek: 50, level: 1 });
  const liabilityId = allocateId(world, 'liability');
  world.liabilities[liabilityId] = {
    id: liabilityId,
    debtorId: actor.id,
    kind: 'credit',
    principalCents: 2_500_000,
    annualRateBps: 2_200,
    weeklyPaymentCents: 48_000,
  };
  const business = addBusiness(world, { name: 'Moonshot LLC', sector: 'Consumer', cashCents: 800_000, revenueWeeklyCents: 180_000, costWeeklyCents: 240_000, employees: 2, capacity: 16, demand: 21 });
  business.growthPosture = 'aggressive';
  business.marketingBps = 1_800;
  actor.cashCents -= 800_000;
  return world;
}

function preferredChoice(archetype: BalanceArchetypeId, event: GameEvent): string {
  const preferences: Partial<Record<BalanceArchetypeId, string[]>> = {
    corporate: ['take-it', 'negotiate-scope', 'accept', 'take-introduction', 'hire'],
    scholar: ['take-introduction', 'ask-advice', 'university', 'study', 'make-time'],
    entrepreneur: ['back-growth', 'trust-ceo', 'hire', 'delegate', 'business', 'hear-them-out'],
    investor: ['family-office', 'protect-cash', 'take-introduction', 'hear-them-out'],
    'real-estate': ['repair', 'hire', 'protect-cash', 'hear-them-out'],
    athlete: ['protect-time', 'accept', 'make-time', 'hear-them-out'],
    politician: ['accept-result', 'take-introduction', 'hear-them-out', 'make-time'],
    'family-first': ['protect-time', 'show-up', 'mentor', 'call', 'make-time', 'welcome-child'],
    'inherited-wealth': ['family-office', 'protect-cash', 'mentor', 'help-network', 'make-time'],
    reckless: ['back-growth', 'take-it', 'contest', 'raise-price', 'dismiss'],
  };
  for (const id of preferences[archetype] ?? []) {
    if (event.choices.some((choice) => choice.id === id)) return id;
  }
  return event.choices.find((choice) => choice.tone === 'positive')?.id
    ?? event.choices.find((choice) => choice.tone !== 'danger')?.id
    ?? event.choices[0]?.id
    ?? '';
}

function resolvePendingEvents(world: WorldState, archetype: BalanceArchetypeId): WorldState {
  let next = world;
  for (let guard = 0; guard < 12; guard += 1) {
    const event = next.events.find((item) => !item.resolved);
    if (!event) return next;
    if (event.templateId === 'dynasty.succession') return next;
    const choiceId = preferredChoice(archetype, event);
    if (!choiceId) return next;
    next = resolveEvent(next, event.id, choiceId);
  }
  return next;
}

function valueIsFinite(world: WorldState): boolean {
  const numbers: number[] = [
    world.calendar.week,
    world.economy.growth,
    world.economy.inflation,
    world.economy.policyRate,
    world.economy.housingIndex,
    world.economy.marketIndex,
    world.economy.unemployment,
  ];
  for (const character of Object.values(world.characters)) numbers.push(character.cashCents, character.health, character.mood, character.stress, character.discipline, character.ambition);
  for (const business of Object.values(world.businesses)) numbers.push(business.cashCents, business.debtCents, business.revenueWeeklyCents, business.costWeeklyCents, business.valuationCents, business.employees, business.capacity, business.demand);
  for (const property of Object.values(world.properties)) numbers.push(property.valueCents, property.debtCents, property.condition, property.weeklyRentCents, property.weeklyCostsCents);
  for (const holding of Object.values(world.holdings)) numbers.push(holding.unitsMilli, holding.costBasisCents);
  for (const liability of Object.values(world.liabilities)) numbers.push(liability.principalCents, liability.annualRateBps, liability.weeklyPaymentCents);
  return numbers.every(Number.isFinite);
}

function inspectHardFailures(world: WorldState, originalActorId: string): string[] {
  const failures: string[] = [];
  if (!valueIsFinite(world)) failures.push('Non-finite simulation value detected.');
  const actor = world.characters[originalActorId];
  if (!actor) failures.push('Original player character disappeared from character registry.');
  for (const business of Object.values(world.businesses)) {
    if (business.employees < 0 || business.capacity < 0 || business.playerOwnershipBps < 0 || business.playerOwnershipBps > 10_000 || business.votingControlBps < 0 || business.votingControlBps > 10_000) failures.push(`Impossible business state on ${business.id}.`);
  }
  for (const property of Object.values(world.properties)) {
    if (property.valueCents < 0 || property.debtCents < 0 || property.condition < 0 || property.condition > 100) failures.push(`Impossible property state on ${property.id}.`);
  }
  return failures;
}

function collectWarnings(world: WorldState, originalActorId: string, startAge: number, endAge: number, quietYears: number, peakNetWorthCents: number): string[] {
  const warnings: string[] = [];
  const actor = world.characters[originalActorId];
  if (!actor) return ['Player character missing while collecting warnings.'];
  const yearsObserved = Math.max(1, endAge - startAge);
  if (quietYears / yearsObserved > 0.35) warnings.push(`More than 35% of observed years had no new feed/history entry (${quietYears}/${yearsObserved}).`);
  if (peakNetWorthCents > 1_000_000_000_000 && endAge <= 45) warnings.push('Net worth exceeded $10B before age 45.');
  if (actor.cashCents < -500_000_000) warnings.push('Liquid cash fell below -$5M.');
  const career = Object.values(world.careers).find((item) => item.characterId === originalActorId && item.active);
  if (career && career.weeklySalaryCents * 52 > 1_000_000_000) warnings.push('Career compensation exceeded $10M/year.');
  for (const business of Object.values(world.businesses).filter((item) => (item.ownerId ?? item.founderId) === originalActorId && item.revenueWeeklyCents > 0)) {
    const margin = (business.revenueWeeklyCents - business.costWeeklyCents) / business.revenueWeeklyCents;
    if (margin > 0.8) warnings.push(`${business.name} sustained a modeled margin above 80%.`);
  }
  for (const property of Object.values(world.properties).filter((item) => item.ownerId === originalActorId && item.valueCents > 0)) {
    const grossYield = property.weeklyRentCents * 52 / property.valueCents;
    if (grossYield > 0.5) warnings.push(`${property.name} reached a gross annual rent yield above 50%.`);
  }
  return [...new Set(warnings)];
}

function simulateOne(seed: string, archetype: BalanceArchetypeId, requestedEndAge: number): BalanceLifeResult {
  const startAge = startAgeFor(archetype);
  let world = normalizeSupplementalState(configureArchetype(createWorld({ seed, startAgeYears: startAge, nowISO: '2026-08-20T00:00:00.000Z' }), archetype));
  const originalActorId = world.playerCharacterId;
  let peakNetWorthCents = netWorthCents(world, originalActorId);
  let minimumCashCents = world.characters[originalActorId].cashCents;
  let quietYears = 0;
  let previousFeedCount = world.feed.length;
  const hardFailures = new Set<string>();
  const targetAge = Math.max(startAge + 1, requestedEndAge);

  for (let year = startAge; year < targetAge; year += 1) {
    world = resolvePendingEvents(world, archetype);
    const original = world.characters[originalActorId];
    if (!original?.isAlive) break;
    const before = world;
    const result = advanceWorld(before, 52, { interrupt: false, autoResolveEvents: true });
    world = applySupplementalAdvance(before, result.world);
    const afterOriginal = world.characters[originalActorId];
    if (afterOriginal) {
      peakNetWorthCents = Math.max(peakNetWorthCents, netWorthCents(world, originalActorId));
      minimumCashCents = Math.min(minimumCashCents, afterOriginal.cashCents);
    }
    if (world.feed.length <= previousFeedCount) quietYears += 1;
    previousFeedCount = world.feed.length;
    for (const failure of inspectHardFailures(world, originalActorId)) hardFailures.add(failure);
    if (!afterOriginal?.isAlive) break;
  }

  const actor = world.characters[originalActorId];
  const finalAge = actor ? Math.max(startAge, Math.floor((world.calendar.week - actor.birthWeek) / 52)) : targetAge;
  const ownedBusinesses = Object.values(world.businesses).filter((item) => (item.ownerId ?? item.founderId) === originalActorId);
  const ownedProperties = Object.values(world.properties).filter((item) => item.ownerId === originalActorId);
  const ownedHoldings = Object.values(world.holdings).filter((item) => item.ownerId === originalActorId);
  const relationships = Object.values(world.relationships).filter((item) => item.characterIds.includes(originalActorId));
  const career = Object.values(world.careers).find((item) => item.characterId === originalActorId && item.active);
  const templates = world.events.map((event) => event.templateId);
  const titles = world.feed.map((entry) => entry.title);
  const maxBusinessMargin = ownedBusinesses.reduce((maximum, business) => {
    if (business.revenueWeeklyCents <= 0) return maximum;
    return Math.max(maximum, (business.revenueWeeklyCents - business.costWeeklyCents) / business.revenueWeeklyCents);
  }, -1);
  const maxPropertyGrossYield = ownedProperties.reduce((maximum, property) => property.valueCents > 0 ? Math.max(maximum, property.weeklyRentCents * 52 / property.valueCents) : maximum, 0);
  const finalWorth = actor ? netWorthCents(world, originalActorId) : 0;
  const warnings = actor ? collectWarnings(world, originalActorId, startAge, finalAge, quietYears, peakNetWorthCents) : ['Player character disappeared before report generation.'];

  return {
    seed,
    archetype,
    startAge,
    endAge: finalAge,
    originalCharacterAlive: Boolean(actor?.isAlive),
    finalNetWorthCents: finalWorth,
    peakNetWorthCents,
    minimumCashCents,
    finalCashCents: actor?.cashCents ?? 0,
    finalHealth: actor?.health ?? 0,
    finalMood: actor?.mood ?? 0,
    finalStress: actor?.stress ?? 0,
    activeBusinesses: ownedBusinesses.filter((item) => item.active).length,
    failedBusinesses: ownedBusinesses.filter((item) => !item.active).length,
    propertiesOwned: ownedProperties.length,
    holdingsOwned: ownedHoldings.length,
    relationshipsTracked: relationships.length,
    strongRelationships: relationships.filter((item) => item.trust >= 65 && item.affection >= 60 && item.resentment < 25).length,
    strainedRelationships: relationships.filter((item) => item.resentment >= 45 || item.trust < 30).length,
    careerSalaryAnnualCents: career?.weeklySalaryCents ? career.weeklySalaryCents * 52 : 0,
    eventCount: templates.length,
    uniqueEventTemplates: new Set(templates).size,
    feedEntries: world.feed.length,
    uniqueFeedTitles: new Set(titles).size,
    quietYears,
    callbackCount: Object.values(world.memories).filter((memory) => memory.category.startsWith('Callback ·')).length,
    ordinaryMomentCount: Object.values(world.memories).filter((memory) => memory.category.startsWith('Moment ·')).length,
    narrativeArcCount: Object.values(world.memories).filter((memory) => memory.category.startsWith('Arc · Narrative ·')).length,
    maxBusinessMargin,
    maxPropertyGrossYield,
    warnings,
    hardFailures: [...hardFailures],
  };
}

function summarize(archetype: BalanceArchetypeId, results: BalanceLifeResult[]): ArchetypeBalanceSummary {
  const lives = results.filter((result) => result.archetype === archetype);
  const observedYears = lives.reduce((sum, result) => sum + Math.max(1, result.endAge - result.startAge), 0);
  return {
    archetype,
    lives: lives.length,
    medianFinalNetWorthCents: median(lives.map((item) => item.finalNetWorthCents)),
    p90FinalNetWorthCents: percentile(lives.map((item) => item.finalNetWorthCents), 0.9),
    medianPeakNetWorthCents: median(lives.map((item) => item.peakNetWorthCents)),
    medianHealth: median(lives.map((item) => item.finalHealth)),
    medianStress: median(lives.map((item) => item.finalStress)),
    survivalRate: lives.filter((item) => item.originalCharacterAlive).length / Math.max(1, lives.length),
    negativeLiquidityRate: lives.filter((item) => item.finalCashCents < 0).length / Math.max(1, lives.length),
    extremeWealthRate: lives.filter((item) => item.peakNetWorthCents > 10_000_000_000_00).length / Math.max(1, lives.length),
    medianUniqueFeedTitles: median(lives.map((item) => item.uniqueFeedTitles)),
    quietYearRate: lives.reduce((sum, item) => sum + item.quietYears, 0) / Math.max(1, observedYears),
    medianCallbacks: median(lives.map((item) => item.callbackCount)),
    medianOrdinaryMoments: median(lives.map((item) => item.ordinaryMomentCount)),
    medianNarrativeArcs: median(lives.map((item) => item.narrativeArcCount)),
    warnings: lives.reduce((sum, item) => sum + item.warnings.length, 0),
    hardFailures: lives.reduce((sum, item) => sum + item.hardFailures.length, 0),
  };
}

function buildGlobalWarnings(summaries: ArchetypeBalanceSummary[]): string[] {
  const warnings: string[] = [];
  const ordered = summaries.filter((item) => item.lives > 0).sort((a, b) => b.medianFinalNetWorthCents - a.medianFinalNetWorthCents);
  if (ordered.length >= 2 && ordered[1].medianFinalNetWorthCents > 0 && ordered[0].medianFinalNetWorthCents / ordered[1].medianFinalNetWorthCents > 10) {
    warnings.push(`${ordered[0].archetype} median wealth is more than 10x the next-highest archetype; check for a dominant economic path.`);
  }
  for (const summary of summaries) {
    if (summary.negativeLiquidityRate > 0.65 && summary.archetype !== 'reckless') warnings.push(`${summary.archetype} ends with negative liquidity in more than 65% of lives.`);
    if (summary.quietYearRate > 0.35) warnings.push(`${summary.archetype} has meaningful-history gaps in more than 35% of observed years.`);
    if (summary.medianHealth < 28 && summary.archetype !== 'reckless') warnings.push(`${summary.archetype} median health falls into critical range.`);
    if (summary.extremeWealthRate > 0.5 && summary.archetype !== 'inherited-wealth') warnings.push(`${summary.archetype} exceeds $10B in more than half of runs.`);
  }
  return warnings;
}

export function runBalanceQa(options: BalanceQaOptions = {}): BalanceQaReport {
  const requestedLives = Math.max(BALANCE_ARCHETYPES.length, Math.round(options.lives ?? 220));
  const endAge = Math.max(35, Math.round(options.endAge ?? 60));
  const longLives = Math.max(0, Math.round(options.longLives ?? 20));
  const longLifeEndAge = Math.max(endAge, Math.round(options.longLifeEndAge ?? 95));
  const results: BalanceLifeResult[] = [];

  for (let index = 0; index < requestedLives; index += 1) {
    const archetype = BALANCE_ARCHETYPES[index % BALANCE_ARCHETYPES.length];
    results.push(simulateOne(`balance-${archetype}-${index}`, archetype, endAge));
  }
  for (let index = 0; index < longLives; index += 1) {
    const archetype = BALANCE_ARCHETYPES[index % BALANCE_ARCHETYPES.length];
    results.push(simulateOne(`balance-long-${archetype}-${index}`, archetype, longLifeEndAge));
  }

  const summaries = BALANCE_ARCHETYPES.map((archetype) => summarize(archetype, results));
  const hardFailures = results.flatMap((result) => result.hardFailures.map((failure) => `${result.archetype}/${result.seed}: ${failure}`));
  const worstWarningExamples = results
    .filter((result) => result.warnings.length > 0)
    .sort((left, right) => right.warnings.length - left.warnings.length)
    .slice(0, 20)
    .map((result) => ({ archetype: result.archetype, seed: result.seed, warnings: result.warnings }));

  return {
    generatedAt: new Date().toISOString(),
    lives: requestedLives,
    longLives,
    archetypes: [...BALANCE_ARCHETYPES],
    summaries,
    globalWarnings: buildGlobalWarnings(summaries),
    hardFailures,
    worstWarningExamples,
  };
}

function compactMoney(cents: number): string {
  const dollars = cents / 100;
  const absolute = Math.abs(dollars);
  const sign = dollars < 0 ? '-' : '';
  if (absolute >= 1_000_000_000) return `${sign}$${(absolute / 1_000_000_000).toFixed(1)}B`;
  if (absolute >= 1_000_000) return `${sign}$${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${sign}$${(absolute / 1_000).toFixed(1)}K`;
  return `${sign}$${absolute.toFixed(0)}`;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatBalanceQaMarkdown(report: BalanceQaReport): string {
  const lines = [
    '# Project Legacy Balance QA',
    '',
    `Generated: ${report.generatedAt}`,
    `Archetype lives: ${report.lives}`,
    `Long-life probes: ${report.longLives}`,
    '',
    '| Archetype | Median wealth | P90 wealth | Health | Stress | Negative cash | Quiet years | Callbacks | Warnings |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const summary of report.summaries) {
    lines.push(`| ${summary.archetype} | ${compactMoney(summary.medianFinalNetWorthCents)} | ${compactMoney(summary.p90FinalNetWorthCents)} | ${summary.medianHealth.toFixed(0)} | ${summary.medianStress.toFixed(0)} | ${percent(summary.negativeLiquidityRate)} | ${percent(summary.quietYearRate)} | ${summary.medianCallbacks.toFixed(0)} | ${summary.warnings} |`);
  }
  lines.push('', '## Global warnings');
  if (report.globalWarnings.length === 0) lines.push('- None.');
  else for (const warning of report.globalWarnings) lines.push(`- ${warning}`);
  lines.push('', '## Hard failures');
  if (report.hardFailures.length === 0) lines.push('- None.');
  else for (const failure of report.hardFailures.slice(0, 30)) lines.push(`- ${failure}`);
  lines.push('', '## Worst warning examples');
  if (report.worstWarningExamples.length === 0) lines.push('- None.');
  else for (const example of report.worstWarningExamples.slice(0, 10)) lines.push(`- **${example.archetype} / ${example.seed}:** ${example.warnings.join(' ')}`);
  lines.push('');
  return lines.join('\n');
}
