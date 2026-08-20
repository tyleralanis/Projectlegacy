import { seedToUint32 } from './random';
import type { Character, ReputationAudience, WorldState } from './types';

import { WORLD_CONTENT } from '@/content/worldContent';

export interface NewWorldOptions { seed: string; firstName?: string; lastName?: string; startAgeYears?: number; nowISO?: string; }

const reputation = (): Record<ReputationAudience, number> => ({ public: 50, business: 50, employee: 50, political: 50, professional: 50, family: 55, faction: 20 });

function character(id: string, firstName: string, lastName: string, birthWeek: number, householdId: string, cashCents: number, overrides: Partial<Character> = {}): Character {
  return { id, firstName, lastName, birthWeek, isAlive: true, cityId: 'city-harborview', householdId, parentIds: [], childIds: [], cashCents, health: 86, mood: 68, stress: 25, discipline: 58, ambition: 64, empathy: 62, riskTolerance: 47, ethics: 72, knowledge: 52, charisma: 55, fitness: 60, focuses: ['Academics', 'Family', 'Health'], reputation: reputation(), detailTier: 'standard', lastMeaningfulWeek: 0, ...overrides };
}

export function createWorld(options: NewWorldOptions): WorldState {
  const now = options.nowISO ?? new Date().toISOString();
  const startAgeYears = Math.max(0, Math.min(120, options.startAgeYears ?? 0));
  const currentWeek = startAgeYears * 52;
  const firstName = options.firstName?.trim() || 'Alex';
  const lastName = options.lastName?.trim() || 'Mercer';
  const playerId = 'character-player';
  const householdId = 'household-mercer';
  const fatherId = 'character-jonah';
  const motherId = 'character-elena';
  const siblingId = 'character-mara';
  const friendId = 'character-riley';
  const starterProfession = WORLD_CONTENT.professions.find((profession) => profession.id === 'profession-operations')!;
  const bankerProfession = WORLD_CONTENT.professions.find((profession) => profession.id === 'profession-banker')!;
  const player = character(playerId, firstName, lastName, 0, householdId, startAgeYears >= 18 ? 1_200_000 : 0, { parentIds: [fatherId, motherId], childIds: [], focuses: startAgeYears < 6 ? ['Family', 'Health', 'Creative Work'] : ['Academics', 'Family', 'Health'], knowledge: startAgeYears >= 18 ? 54 : 5, detailTier: 'full', lastMeaningfulWeek: currentWeek, professionId: startAgeYears >= 18 ? 'profession-operations' : undefined });
  const father = character(fatherId, 'Jonah', lastName, -36 * 52, householdId, 2_800_000, { childIds: [playerId, siblingId], partnerId: motherId, discipline: 68, ambition: 57 });
  const mother = character(motherId, 'Elena', lastName, -34 * 52, householdId, 3_600_000, { childIds: [playerId, siblingId], partnerId: fatherId, empathy: 78, knowledge: 66 });
  const sibling = character(siblingId, 'Mara', lastName, -3 * 52, householdId, 320_000, { parentIds: [fatherId, motherId], ambition: 72, riskTolerance: 64 });
  const friend = character(friendId, 'Riley', 'Chen', -4 * 52, 'household-chen', 840_000, { ambition: 61, empathy: 70, knowledge: 57, charisma: 64, focuses: ['Creative Work', 'Networking', 'Health'], professionId: startAgeYears >= 17 ? 'profession-banker' : undefined });

  const world: WorldState = {
    metadata: { saveId: `save-${seedToUint32(options.seed).toString(16)}`, displayName: `${firstName} ${lastName} · Generation 1`, schemaVersion: 3, engineVersion: '0.1.0', contentVersion: '1.1.0', worldSeed: options.seed, createdAt: now, updatedAt: now, lastCheckpoint: now, generation: 1, nextSequence: 100 },
    calendar: { week: currentWeek, dateISO: addWeeksISO('2008-01-07', currentWeek) },
    rngState: seedToUint32(options.seed), playerCharacterId: playerId,
    economy: { regime: 'steady', growth: 0.022, inflation: 0.024, policyRate: 0.038, housingIndex: 100, marketIndex: 100, unemployment: 0.049 },
    characters: { [playerId]: player, [fatherId]: father, [motherId]: mother, [siblingId]: sibling, [friendId]: friend },
    relationships: {
      'relationship-player-father': { id: 'relationship-player-father', characterIds: [playerId, fatherId], kind: 'parent', trust: 72, affection: 74, respect: 68, resentment: 8, lastInteractionWeek: currentWeek },
      'relationship-player-mother': { id: 'relationship-player-mother', characterIds: [playerId, motherId], kind: 'parent', trust: 78, affection: 82, respect: 74, resentment: 5, lastInteractionWeek: currentWeek },
      'relationship-player-sibling': { id: 'relationship-player-sibling', characterIds: [playerId, siblingId], kind: 'sibling', trust: 63, affection: 67, respect: 59, resentment: 14, lastInteractionWeek: currentWeek },
      'relationship-player-riley': { id: 'relationship-player-riley', characterIds: [playerId, friendId], kind: 'friend', trust: 58, affection: 60, respect: 62, resentment: 4, lastInteractionWeek: currentWeek },
    },
    memories: {},
    education: startAgeYears >= 18 ? { 'education-high-school': { id: 'education-high-school', characterId: playerId, institutionId: 'organization-harborview-academy', status: 'completed', level: 'Secondary diploma', recordedGrade: 78, knowledgeGain: 54, prestige: 52, network: 44, tuitionCentsPerYear: 0, manipulatedCredential: false } } : {},
    careers: startAgeYears >= 18 ? {
      'career-player': { id: 'career-player', characterId: playerId, employerId: 'organization-northstar-logistics', title: starterProfession.title, sector: starterProfession.sector, weeklySalaryCents: starterProfession.weeklySalaryCents, performance: 56, satisfaction: 61, weeksInRole: 6, active: true },
      'career-riley': { id: 'career-riley', characterId: friendId, employerId: 'organization-northstar-logistics', title: bankerProfession.title, sector: bankerProfession.sector, weeklySalaryCents: bankerProfession.weeklySalaryCents, performance: 64, satisfaction: 67, weeksInRole: 18, active: true },
    } : {},
    organizations: {
      'organization-harborview-academy': { id: 'organization-harborview-academy', kind: 'school', name: 'Harborview Academy', resourcesCents: 62_000_000_00, influence: 51, stability: 78, memberIds: [], history: ['Founded to serve Harborview families.'] },
      'organization-northstar-logistics': { id: 'organization-northstar-logistics', kind: 'business', name: 'Northstar Logistics', resourcesCents: 420_000_000_00, influence: 58, stability: 69, memberIds: startAgeYears >= 18 ? [playerId] : [], history: ['Expanded from the port into regional distribution.'] },
      'organization-civic-alliance': { id: 'organization-civic-alliance', kind: 'party', name: 'Civic Alliance', resourcesCents: 19_000_000_00, influence: 49, stability: 61, memberIds: [], history: ['Built a pragmatic coalition around local institutions.'] },
      ...Object.fromEntries(WORLD_CONTENT.universities.map((university) => [university.id, { id: university.id, kind: 'school' as const, name: university.name, resourcesCents: university.tuitionCentsPerYear * 2_000, influence: university.prestige, stability: 74, memberIds: [], history: [`Prestige ${university.prestige}; network strength ${university.network}.`] }])),
    },
    businesses: {}, properties: {}, securities: Object.fromEntries(WORLD_CONTENT.assets.map((security) => [security.id, { ...security }])), holdings: {}, liabilities: {},
    politics: { [playerId]: { characterId: playerId, authority: 0, approval: 50 } }, exposures: {}, legalCases: {}, transactions: [], events: [],
    feed: [{ id: 'feed-beginning', week: currentWeek, domain: 'life', title: startAgeYears === 0 ? 'A new life begins' : 'The next chapter is yours', detail: startAgeYears === 0 ? `${firstName} ${lastName} was born in Harborview to Jonah and Elena.` : `${firstName} ${lastName} is finding a place in Harborview. The world will keep moving with every week.`, important: true }],
    timeline: [{ id: 'timeline-beginning', week: currentWeek, generation: 1, category: startAgeYears === 0 ? 'birth' : 'dynasty', title: startAgeYears === 0 ? 'A new life begins' : 'A legacy begins', detail: `${firstName} ${lastName}'s world begins in Harborview.`, subjectIds: [playerId], importance: 5 }],
    favorites: [], intentHistory: [], countries: Object.fromEntries(WORLD_CONTENT.countries.map((country) => [country.id, { ...country }])), activeCountryId: WORLD_CONTENT.countries[0].id,
    background: { population: WORLD_CONTENT.countries[0].population, households: Math.round(WORLD_CONTENT.countries[0].population / 2.42), businesses: Math.round(WORLD_CONTENT.countries[0].population / 31), industries: Object.fromEntries(WORLD_CONTENT.businessSectors.map((sector) => [sector.id, { outputIndex: 100, employment: Math.round(WORLD_CONTENT.countries[0].population * sector.laborIntensity * 0.04), confidence: 50 }])), lastAggregateWeek: currentWeek },
    performance: { fullNpcLimit: WORLD_CONTENT.performance.fullNpcLimit, standardNpcLimit: WORLD_CONTENT.performance.standardNpcLimit, memoryLimit: WORLD_CONTENT.performance.memoryLimit, timelineLimit: WORLD_CONTENT.performance.timelineLimit, intentLogLimit: WORLD_CONTENT.performance.intentLogLimit },
    dynasty: { founderId: playerId, generation: 1, familyName: lastName, notableHistory: [], successionPreference: 'player-choice' },
    settings: { hapticsEnabled: true, reducedMotion: false, enhancedAIEnabled: true, qualitativeRiskOnly: true, highContrast: false, autoDownloadUpdates: true, developerUnlocked: false },
    advisors: {},
  };
  return world;
}

export function addWeeksISO(dateISO: string, weeks: number): string { const date = new Date(`${dateISO.slice(0, 10)}T12:00:00.000Z`); date.setUTCDate(date.getUTCDate() + weeks * 7); return date.toISOString().slice(0, 10); }
export function allocateId(world: WorldState, prefix: string): string { const sequence = world.metadata.nextSequence; world.metadata.nextSequence += 1; return `${prefix}-${sequence.toString(36)}`; }
export function playerAgeYears(world: WorldState): number { const player = world.characters[world.playerCharacterId]; return Math.max(0, Math.floor((world.calendar.week - player.birthWeek) / 52)); }
