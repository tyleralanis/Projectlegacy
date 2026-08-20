export type EntityId = string;
export type MoneyCents = number;

export type Domain =
  | 'life'
  | 'family'
  | 'education'
  | 'career'
  | 'business'
  | 'property'
  | 'markets'
  | 'relationship'
  | 'health'
  | 'legal'
  | 'reputation'
  | 'organization'
  | 'politics'
  | 'geopolitics'
  | 'dynasty';

export type Severity = 'S0' | 'S1' | 'S2' | 'S3' | 'S4';
export type FocusArea =
  | 'Academics'
  | 'Sport'
  | 'Family'
  | 'Partner'
  | 'Job'
  | 'Startup'
  | 'Health'
  | 'Networking'
  | 'Campaign'
  | 'Creative Work';

export type ReputationAudience =
  | 'public'
  | 'business'
  | 'employee'
  | 'political'
  | 'professional'
  | 'family'
  | 'faction';

export interface WorldMetadata {
  saveId: string;
  displayName: string;
  schemaVersion: number;
  engineVersion: string;
  contentVersion: string;
  worldSeed: string;
  createdAt: string;
  updatedAt: string;
  lastCheckpoint: string;
  generation: number;
  nextSequence: number;
}

export interface CalendarState {
  week: number;
  dateISO: string;
}

export interface EconomyState {
  regime: 'recession' | 'slow' | 'steady' | 'growth' | 'boom';
  growth: number;
  inflation: number;
  policyRate: number;
  housingIndex: number;
  marketIndex: number;
  unemployment: number;
}

export interface Character {
  id: EntityId;
  firstName: string;
  lastName: string;
  birthWeek: number;
  deathWeek?: number;
  isAlive: boolean;
  cityId: EntityId;
  householdId: EntityId;
  parentIds: EntityId[];
  childIds: EntityId[];
  partnerId?: EntityId;
  cashCents: MoneyCents;
  health: number;
  mood: number;
  stress: number;
  discipline: number;
  ambition: number;
  empathy: number;
  riskTolerance: number;
  ethics: number;
  knowledge: number;
  charisma: number;
  fitness: number;
  focuses: FocusArea[];
  reputation: Record<ReputationAudience, number>;
  detailTier: 'full' | 'standard' | 'statistical';
  lastMeaningfulWeek: number;
  professionId?: string;
}

export interface Relationship {
  id: EntityId;
  characterIds: [EntityId, EntityId];
  kind: 'parent' | 'child' | 'sibling' | 'relative' | 'partner' | 'spouse' | 'friend' | 'professional' | 'rival';
  trust: number;
  affection: number;
  respect: number;
  resentment: number;
  lastInteractionWeek: number;
}

export interface MemoryRecord {
  id: EntityId;
  participantIds: EntityId[];
  category: string;
  week: number;
  valence: number;
  importance: number;
  permanent: boolean;
  unresolved: boolean;
  visibility: 'private' | 'shared' | 'public';
  narrative: string;
}

export interface EducationState {
  id: EntityId;
  characterId: EntityId;
  institutionId: EntityId;
  status: 'preschool' | 'school' | 'accepted' | 'higher' | 'trade' | 'completed' | 'withdrawn';
  startedWeek?: number;
  level: string;
  recordedGrade: number;
  knowledgeGain: number;
  prestige: number;
  network: number;
  tuitionCentsPerYear: MoneyCents;
  manipulatedCredential: boolean;
}

export interface CareerState {
  id: EntityId;
  characterId: EntityId;
  employerId: EntityId;
  title: string;
  sector: string;
  weeklySalaryCents: MoneyCents;
  performance: number;
  satisfaction: number;
  weeksInRole: number;
  active: boolean;
}

export interface Organization {
  id: EntityId;
  kind:
    | 'business'
    | 'government'
    | 'agency'
    | 'party'
    | 'charity'
    | 'school'
    | 'club'
    | 'professional'
    | 'union'
    | 'faction'
    | 'security'
    | 'criminal'
    | 'other';
  name: string;
  jurisdictionId?: EntityId;
  resourcesCents: MoneyCents;
  influence: number;
  stability: number;
  memberIds: EntityId[];
  leaderId?: EntityId;
  history: string[];
}

export interface Business {
  id: EntityId;
  organizationId: EntityId;
  name: string;
  sector: string;
  cityId: EntityId;
  founderId: EntityId;
  ownerId?: EntityId;
  cashCents: MoneyCents;
  debtCents: MoneyCents;
  revenueWeeklyCents: MoneyCents;
  costWeeklyCents: MoneyCents;
  valuationCents: MoneyCents;
  playerOwnershipBps: number;
  votingControlBps: number;
  employees: number;
  capacity: number;
  demand: number;
  quality: number;
  reputation: number;
  marketingBps: number;
  pricePosition: 'value' | 'market' | 'premium';
  growthPosture: 'conservative' | 'balanced' | 'aggressive';
  delegated: boolean;
  active: boolean;
}

export interface PropertyAsset {
  id: EntityId;
  name: string;
  kind: 'residence' | 'condo' | 'single-family' | 'multifamily' | 'commercial' | 'land' | 'development' | 'estate';
  cityId: EntityId;
  ownerId: EntityId;
  valueCents: MoneyCents;
  debtCents: MoneyCents;
  condition: number;
  occupancy: 'owner' | 'tenant' | 'vacant' | 'construction';
  weeklyRentCents: MoneyCents;
  weeklyCostsCents: MoneyCents;
  managed: boolean;
}

export interface Security {
  id: EntityId;
  symbol: string;
  name: string;
  sector: string;
  priceCents: MoneyCents;
  quality: number;
  volatility: number;
  dividendYieldBps: number;
}

export interface Holding {
  id: EntityId;
  ownerId: EntityId;
  securityId: EntityId;
  unitsMilli: number;
  costBasisCents: MoneyCents;
}

export interface Liability {
  id: EntityId;
  debtorId: EntityId;
  kind: 'mortgage' | 'business' | 'student' | 'credit' | 'legal';
  principalCents: MoneyCents;
  annualRateBps: number;
  weeklyPaymentCents: MoneyCents;
  securedById?: EntityId;
}

export interface PoliticalState {
  characterId: EntityId;
  partyId?: EntityId;
  office?: string;
  officeLevel?: 'local' | 'regional' | 'national';
  authority: number;
  approval: number;
  campaign?: {
    office: string;
    weeksRemaining: number;
    fundsCents: MoneyCents;
    support: number;
    opposition: number;
  };
}

export interface LegalExposure {
  id: EntityId;
  characterId: EntityId;
  category: string;
  severity: number;
  evidence: number;
  discoverability: number;
  createdWeek: number;
  discovered: boolean;
  resolved: boolean;
}

export interface LegalCase {
  id: EntityId;
  characterId: EntityId;
  exposureId: EntityId;
  stage: 'investigation' | 'charged' | 'trial' | 'appeal' | 'resolved';
  counselQuality: number;
  risk: number;
  outcome?: 'dismissed' | 'settled' | 'acquitted' | 'convicted';
}

export interface TransactionRecord {
  id: EntityId;
  week: number;
  kind: string;
  amountCents: MoneyCents;
  fromId?: EntityId;
  toId?: EntityId;
  memo: string;
}

export interface EventChoice {
  id: string;
  label: string;
  detail: string;
  tone?: 'default' | 'positive' | 'danger';
}

export interface GameEvent {
  id: EntityId;
  templateId: string;
  domain: Domain;
  severity: Severity;
  week: number;
  title: string;
  narrative: string;
  participantIds: EntityId[];
  choices: EventChoice[];
  otherActionFamilies: string[];
  resolved: boolean;
  selectedChoiceId?: string;
  explanation?: OutcomeExplanation;
}

export interface FeedEntry {
  id: EntityId;
  week: number;
  domain: Domain;
  title: string;
  detail: string;
  important: boolean;
}

export type TimelineCategory =
  | 'birth'
  | 'relationship'
  | 'education'
  | 'career'
  | 'business'
  | 'property'
  | 'wealth'
  | 'politics'
  | 'legal'
  | 'world'
  | 'death'
  | 'dynasty';

export interface OutcomeFactor {
  label: string;
  impact: 'positive' | 'negative' | 'neutral';
  detail: string;
}

export interface OutcomeExplanation {
  summary: string;
  factors: OutcomeFactor[];
}

export interface TimelineEntry {
  id: EntityId;
  week: number;
  generation: number;
  category: TimelineCategory;
  title: string;
  detail: string;
  subjectIds: EntityId[];
  importance: 1 | 2 | 3 | 4 | 5;
  explanation?: OutcomeExplanation;
}

export type FavoriteEntityType = 'character' | 'business' | 'property' | 'organization' | 'country' | 'event';

export interface FavoriteRef {
  id: EntityId;
  entityType: FavoriteEntityType;
  entityId: EntityId;
  label: string;
  pinnedAtWeek: number;
}

export interface IntentAuditEntry {
  id: EntityId;
  week: number;
  input: string;
  mode: 'baseline' | 'foundation_models' | 'unavailable';
  confidence: number;
  status: 'executed' | 'confirmed' | 'clarified' | 'fallback' | 'rejected' | 'error';
  proposedVerb?: string;
  targetIds: EntityId[];
  diagnostics: string[];
}

export interface CountryState {
  id: EntityId;
  name: string;
  population: number;
  stability: number;
  ruleOfLaw: number;
  educationIndex: number;
  marketAccess: number;
}

export interface BackgroundSimulationState {
  population: number;
  households: number;
  businesses: number;
  industries: Record<string, { outputIndex: number; employment: number; confidence: number }>;
  lastAggregateWeek: number;
}

export interface PerformanceBudgetState {
  fullNpcLimit: number;
  standardNpcLimit: number;
  memoryLimit: number;
  timelineLimit: number;
  intentLogLimit: number;
}

export interface DynastyState {
  founderId: EntityId;
  activeHeirId?: EntityId;
  generation: number;
  familyName: string;
  notableHistory: string[];
  successionPreference: 'oldest-child' | 'most-capable' | 'player-choice';
}

export interface GameSettings {
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  enhancedAIEnabled: boolean;
  qualitativeRiskOnly: boolean;
  highContrast: boolean;
  autoDownloadUpdates: boolean;
  developerUnlocked: boolean;
}

export interface WorldState {
  metadata: WorldMetadata;
  calendar: CalendarState;
  rngState: number;
  playerCharacterId: EntityId;
  economy: EconomyState;
  characters: Record<EntityId, Character>;
  relationships: Record<EntityId, Relationship>;
  memories: Record<EntityId, MemoryRecord>;
  education: Record<EntityId, EducationState>;
  careers: Record<EntityId, CareerState>;
  organizations: Record<EntityId, Organization>;
  businesses: Record<EntityId, Business>;
  properties: Record<EntityId, PropertyAsset>;
  securities: Record<EntityId, Security>;
  holdings: Record<EntityId, Holding>;
  liabilities: Record<EntityId, Liability>;
  politics: Record<EntityId, PoliticalState>;
  exposures: Record<EntityId, LegalExposure>;
  legalCases: Record<EntityId, LegalCase>;
  transactions: TransactionRecord[];
  events: GameEvent[];
  feed: FeedEntry[];
  timeline: TimelineEntry[];
  favorites: FavoriteRef[];
  intentHistory: IntentAuditEntry[];
  countries: Record<EntityId, CountryState>;
  activeCountryId: EntityId;
  background: BackgroundSimulationState;
  performance: PerformanceBudgetState;
  dynasty: DynastyState;
  settings: GameSettings;
}

export interface AdvanceSummary {
  requestedWeeks: number;
  advancedWeeks: number;
  startWeek: number;
  endWeek: number;
  cashDeltaCents: MoneyCents;
  netWorthDeltaCents: MoneyCents;
  highlights: string[];
  delegatedDecisions: string[];
  missedOpportunities: string[];
  consequences: string[];
  explanation?: OutcomeExplanation;
  interruptedByEventId?: EntityId;
}

export interface AdvanceResult {
  world: WorldState;
  summary: AdvanceSummary;
}

export interface IntentAction {
  verb: string;
  targetIds: EntityId[];
  parameters: Record<string, string | number | boolean | null>;
  destructive?: boolean;
}

export interface ActionValidation {
  valid: boolean;
  reason?: string;
  prerequisites?: string[];
  requiresConfirmation: boolean;
}

export interface ActionResult {
  world: WorldState;
  validation: ActionValidation;
  message: string;
  explanation?: OutcomeExplanation;
}
