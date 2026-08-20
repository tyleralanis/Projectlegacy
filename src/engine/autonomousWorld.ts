import { allocateId, playerAgeYears } from './createWorld';
import { recordHistory } from './history';
import { getTimeBudget } from './livingWorld';
import type { Character, MemoryRecord, Relationship, WorldState } from './types';

import { WORLD_CONTENT } from '@/content/worldContent';

const THREAD_PREFIX = 'Thread · ';
const THREAD_RELATIONSHIP = `${THREAD_PREFIX}Relationship`;
const THREAD_TIME = `${THREAD_PREFIX}Time pressure`;
const THREAD_CAREER = `${THREAD_PREFIX}Career`;
const THREAD_BUSINESS = `${THREAD_PREFIX}Business`;
const THREAD_FAMILY_MONEY = `${THREAD_PREFIX}Family money`;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function unit(world: WorldState, key: string): number {
  return (hash(`${world.metadata.worldSeed}:${world.calendar.week}:${key}`) % 1_000_003) / 1_000_003;
}

function ageAtWeek(character: Character, week: number): number {
  return Math.max(0, Math.floor((week - character.birthWeek) / 52));
}

function crossedBoundary(beforeWeek: number, afterWeek: number, interval: number): boolean {
  return Math.floor(beforeWeek / interval) < Math.floor(afterWeek / interval);
}

function relationshipWith(world: WorldState, leftId: string, rightId: string): Relationship | undefined {
  return Object.values(world.relationships).find((relationship) => relationship.characterIds.includes(leftId) && relationship.characterIds.includes(rightId));
}

function playerRelationship(world: WorldState, npcId: string): Relationship | undefined {
  return relationshipWith(world, world.playerCharacterId, npcId);
}

function importantNpcIds(world: WorldState): string[] {
  const actor = world.characters[world.playerCharacterId];
  const ids = new Set<string>([...actor.parentIds, ...actor.childIds]);
  if (actor.partnerId) ids.add(actor.partnerId);
  for (const relationship of Object.values(world.relationships)) {
    if (!relationship.characterIds.includes(actor.id)) continue;
    if (!['sibling', 'friend', 'rival', 'professional', 'relative', 'parent', 'child', 'partner', 'spouse'].includes(relationship.kind)) continue;
    const otherId = relationship.characterIds.find((id) => id !== actor.id);
    if (otherId) ids.add(otherId);
  }
  return [...ids].filter((id) => world.characters[id]?.isAlive);
}

function activeCareer(world: WorldState, characterId: string) {
  return Object.values(world.careers).find((career) => career.characterId === characterId && career.active);
}

function chooseNpcProfession(world: WorldState, npc: Character) {
  const age = ageAtWeek(npc, world.calendar.week);
  const eligible = WORLD_CONTENT.professions.filter((profession) => profession.minimumAge <= age && !profession.requiredDegree && profession.minKnowledge <= npc.knowledge + 18 && profession.minSkill <= Math.max(npc.charisma, npc.discipline, npc.knowledge));
  const pool = eligible.length > 0 ? eligible : WORLD_CONTENT.professions.filter((profession) => profession.minimumAge <= age && !profession.requiredDegree);
  if (pool.length === 0) return undefined;
  const scored = pool.map((profession) => {
    const ambitionFit = npc.ambition * 0.35;
    const knowledgeFit = npc.knowledge * 0.3;
    const socialFit = profession.skillKey === 'social' || profession.skillKey === 'publicSpeaking' ? npc.charisma * 0.35 : npc.discipline * 0.25;
    const salaryPull = Math.log10(Math.max(100, profession.weeklySalaryCents)) * 4;
    const noise = unit(world, `npc-profession:${npc.id}:${profession.id}`) * 18;
    return { profession, score: ambitionFit + knowledgeFit + socialFit + salaryPull + noise - profession.minExperienceWeeks / 80 };
  }).sort((left, right) => right.score - left.score);
  return scored[0]?.profession;
}

function careerEmployerId(world: WorldState): string {
  return world.organizations['organization-northstar-logistics']?.id
    ?? Object.values(world.organizations).find((organization) => organization.kind === 'business')?.id
    ?? Object.keys(world.organizations)[0];
}

function startNpcCareer(world: WorldState, npc: Character): void {
  const profession = chooseNpcProfession(world, npc);
  if (!profession) return;
  const id = allocateId(world, 'career');
  world.careers[id] = {
    id,
    characterId: npc.id,
    employerId: careerEmployerId(world),
    title: profession.title,
    sector: profession.sector,
    weeklySalaryCents: profession.weeklySalaryCents,
    performance: clamp(42 + npc.discipline * 0.27 + npc.knowledge * 0.16 + unit(world, `career-start:${npc.id}`) * 14),
    satisfaction: clamp(45 + npc.ambition * 0.16 + npc.empathy * 0.08 + unit(world, `career-satisfaction:${npc.id}`) * 18),
    weeksInRole: 0,
    active: true,
  };
  npc.professionId = profession.id;
  npc.lastMeaningfulWeek = world.calendar.week;
  const relation = playerRelationship(world, npc.id);
  if (relation && ['parent', 'child', 'sibling', 'friend', 'partner', 'spouse'].includes(relation.kind)) {
    recordHistory(world, 'career', `${npc.firstName} started a new job`, `${npc.firstName} is now working as a ${profession.title}. Their career can keep moving even when you are busy with your own life.`, { subjectIds: [npc.id], importance: relation.kind === 'friend' ? 2 : 3 });
  }
}

function simulateNpcCareer(world: WorldState, npc: Character, weeks: number, yearlyBoundary: boolean): void {
  const age = ageAtWeek(npc, world.calendar.week);
  if (age < 16) {
    npc.knowledge = clamp(npc.knowledge + Math.min(3, weeks * (0.012 + npc.discipline / 12_000)));
    return;
  }
  let career = activeCareer(world, npc.id);
  if (!career) {
    startNpcCareer(world, npc);
    career = activeCareer(world, npc.id);
    if (!career) return;
  }

  career.weeksInRole += weeks;
  const economyLift = world.economy.regime === 'boom' ? 0.8 : world.economy.regime === 'growth' ? 0.35 : world.economy.regime === 'recession' ? -0.9 : 0;
  const traitLift = (npc.discipline - 50) / 180 + (npc.ambition - 50) / 260;
  career.performance = clamp(career.performance + Math.min(6, weeks * 0.02) * (traitLift + economyLift * 0.15) + (unit(world, `career-performance:${npc.id}`) - 0.5) * 4);
  career.satisfaction = clamp(career.satisfaction + (npc.ambition > 70 && career.performance < 60 ? -1.5 : 0.4) + (unit(world, `career-mood:${npc.id}`) - 0.5) * 3);

  const actor = world.characters[world.playerCharacterId];
  const isParentOfMinorPlayer = playerAgeYears(world) < 18 && actor.parentIds.includes(npc.id);
  if (!isParentOfMinorPlayer) {
    const afterTaxIncome = Math.round(career.weeklySalaryCents * weeks * 0.72);
    const livingCosts = Math.round((58_000 + npc.childIds.length * 9_000) * weeks);
    npc.cashCents += afterTaxIncome - livingCosts;
  }

  if (!yearlyBoundary) return;
  const layoffRisk = world.economy.regime === 'recession' ? 0.11 : world.economy.regime === 'slow' ? 0.045 : 0.015;
  const performanceRisk = career.performance < 42 ? 0.18 : career.performance < 52 ? 0.06 : 0;
  if (unit(world, `npc-layoff:${npc.id}`) < layoffRisk + performanceRisk) {
    career.active = false;
    npc.stress = clamp(npc.stress + 10);
    npc.mood = clamp(npc.mood - 7);
    npc.lastMeaningfulWeek = world.calendar.week;
    const relation = playerRelationship(world, npc.id);
    if (relation && ['parent', 'child', 'sibling', 'friend', 'partner', 'spouse'].includes(relation.kind)) {
      recordHistory(world, 'career', `${npc.firstName} lost their job`, `${npc.firstName}'s job ended in a ${world.economy.regime} economy. Their next move will depend on money, ambition, skills, and who they know.`, { important: ['parent', 'child', 'partner', 'spouse'].includes(relation.kind), subjectIds: [npc.id] });
    }
    return;
  }

  if (career.performance >= 72 && career.weeksInRole >= 78 && unit(world, `npc-promotion:${npc.id}`) < 0.38) {
    if (!career.title.startsWith('Senior ') && !career.title.startsWith('Lead ')) career.title = `Senior ${career.title}`;
    career.weeklySalaryCents = Math.round(career.weeklySalaryCents * (1.08 + unit(world, `npc-raise:${npc.id}`) * 0.1));
    career.satisfaction = clamp(career.satisfaction + 6);
    npc.reputation.professional = clamp(npc.reputation.professional + 5);
    npc.lastMeaningfulWeek = world.calendar.week;
    const relation = playerRelationship(world, npc.id);
    if (relation && ['parent', 'child', 'sibling', 'friend', 'partner', 'spouse'].includes(relation.kind)) {
      recordHistory(world, 'career', `${npc.firstName} moved up`, `${npc.firstName}'s work turned into more responsibility, better pay, and a slightly more impressive title.`, { subjectIds: [npc.id], importance: 3 });
    }
  }
}

function createNpcPartner(world: WorldState, npc: Character): Character {
  const firstNames = ['Avery', 'Maya', 'Noah', 'Nia', 'Theo', 'Sofia', 'Miles', 'Priya', 'Jordan', 'Camila', 'Darius', 'Quinn'];
  const lastNames = ['Brooks', 'Shah', 'Ortega', 'Kim', 'Wallace', 'Nguyen', 'Patel', 'Bennett', 'Alvarez', 'Okafor', 'Rivera', 'Morgan'];
  const firstName = firstNames[Math.floor(unit(world, `partner-first:${npc.id}`) * firstNames.length) % firstNames.length];
  const lastName = lastNames[Math.floor(unit(world, `partner-last:${npc.id}`) * lastNames.length) % lastNames.length];
  const npcAge = ageAtWeek(npc, world.calendar.week);
  const partnerAge = Math.max(18, Math.min(75, npcAge + Math.floor(unit(world, `partner-age:${npc.id}`) * 7) - 3));
  const id = allocateId(world, 'character');
  const partner: Character = {
    id,
    firstName,
    lastName,
    birthWeek: world.calendar.week - partnerAge * 52,
    isAlive: true,
    cityId: npc.cityId,
    householdId: `household-${npc.id}-${id}`,
    parentIds: [],
    childIds: [],
    cashCents: Math.round(250_000 + unit(world, `partner-cash:${npc.id}`) * 8_000_000),
    health: 62 + unit(world, `partner-health:${npc.id}`) * 31,
    mood: 54 + unit(world, `partner-mood:${npc.id}`) * 34,
    stress: 12 + unit(world, `partner-stress:${npc.id}`) * 36,
    discipline: 32 + unit(world, `partner-discipline:${npc.id}`) * 61,
    ambition: 30 + unit(world, `partner-ambition:${npc.id}`) * 64,
    empathy: 34 + unit(world, `partner-empathy:${npc.id}`) * 61,
    riskTolerance: 22 + unit(world, `partner-risk:${npc.id}`) * 70,
    ethics: 36 + unit(world, `partner-ethics:${npc.id}`) * 58,
    knowledge: 30 + unit(world, `partner-knowledge:${npc.id}`) * 62,
    charisma: 30 + unit(world, `partner-charisma:${npc.id}`) * 64,
    fitness: 35 + unit(world, `partner-fitness:${npc.id}`) * 58,
    focuses: ['Family', 'Job', 'Health'],
    reputation: { public: 48, business: 45, employee: 52, political: 35, professional: 48, family: 58, faction: 12 },
    detailTier: 'standard',
    lastMeaningfulWeek: world.calendar.week,
  };
  world.characters[id] = partner;
  const householdId = partner.householdId;
  npc.householdId = householdId;
  npc.partnerId = id;
  partner.partnerId = npc.id;
  const relationshipId = allocateId(world, 'relationship');
  world.relationships[relationshipId] = {
    id: relationshipId,
    characterIds: [npc.id, id],
    kind: 'partner',
    trust: 52 + unit(world, `partner-trust:${npc.id}`) * 24,
    affection: 58 + unit(world, `partner-affection:${npc.id}`) * 28,
    respect: 48 + unit(world, `partner-respect:${npc.id}`) * 28,
    resentment: unit(world, `partner-resentment:${npc.id}`) * 8,
    lastInteractionWeek: world.calendar.week,
  };

  const actor = world.characters[world.playerCharacterId];
  const relation = playerRelationship(world, npc.id);
  if (relation && ['child', 'sibling', 'parent', 'relative'].includes(relation.kind)) {
    const inLawRelationshipId = allocateId(world, 'relationship');
    world.relationships[inLawRelationshipId] = { id: inLawRelationshipId, characterIds: [actor.id, id], kind: 'relative', trust: 34, affection: 32, respect: 40, resentment: 0, lastInteractionWeek: world.calendar.week };
  }
  return partner;
}

function maybeNpcPartnership(world: WorldState, npc: Character, yearlyBoundary: boolean): void {
  if (!yearlyBoundary || npc.partnerId || npc.id === world.characters[world.playerCharacterId].partnerId) return;
  const age = ageAtWeek(npc, world.calendar.week);
  if (age < 20 || age > 70) return;
  const relationshipChance = 0.11 + npc.charisma / 900 + npc.empathy / 1500 - Math.max(0, npc.stress - 65) / 500;
  if (unit(world, `npc-partner:${npc.id}`) >= relationshipChance) return;
  const partner = createNpcPartner(world, npc);
  npc.lastMeaningfulWeek = world.calendar.week;
  const relation = playerRelationship(world, npc.id);
  if (relation && ['parent', 'child', 'sibling', 'friend'].includes(relation.kind)) {
    recordHistory(world, 'relationship', `${npc.firstName} is seeing someone`, `${npc.firstName} and ${partner.firstName} ${partner.lastName} have built a relationship of their own. The people around you do not wait in place.`, { subjectIds: [npc.id, partner.id], importance: relation.kind === 'friend' ? 2 : 3 });
  }
}

function maybeNpcBreakup(world: WorldState, npc: Character, yearlyBoundary: boolean): void {
  if (!yearlyBoundary || !npc.partnerId || npc.id === world.characters[world.playerCharacterId].partnerId) return;
  const partner = world.characters[npc.partnerId];
  if (!partner?.isAlive) return;
  const relationship = relationshipWith(world, npc.id, partner.id);
  if (!relationship) return;
  const pressure = relationship.resentment * 0.8 + Math.max(0, 50 - relationship.trust) + Math.max(0, 50 - relationship.affection);
  if (pressure < 75 || unit(world, `npc-breakup:${npc.id}`) > Math.min(0.75, pressure / 180)) return;
  delete npc.partnerId;
  if (partner.partnerId === npc.id) delete partner.partnerId;
  relationship.kind = 'acquaintance';
  relationship.affection = clamp(relationship.affection - 15);
  relationship.trust = clamp(relationship.trust - 8);
  relationship.resentment = clamp(relationship.resentment + 12);
  npc.lastMeaningfulWeek = world.calendar.week;
  const relation = playerRelationship(world, npc.id);
  if (relation && ['parent', 'child', 'sibling', 'friend'].includes(relation.kind)) {
    recordHistory(world, 'relationship', `${npc.firstName}'s relationship ended`, `${npc.firstName} and ${partner.firstName} split up. Whatever caused it belongs to their life, but the fallout can still touch yours.`, { subjectIds: [npc.id, partner.id], importance: relation.kind === 'friend' ? 2 : 3 });
  }
}

function maybeNpcChild(world: WorldState, npc: Character, yearlyBoundary: boolean): void {
  if (!yearlyBoundary || !npc.partnerId || npc.childIds.length >= 4) return;
  const partner = world.characters[npc.partnerId];
  if (!partner?.isAlive) return;
  const age = ageAtWeek(npc, world.calendar.week);
  const partnerAge = ageAtWeek(partner, world.calendar.week);
  if (age < 22 || age > 48 || partnerAge < 22 || partnerAge > 48) return;
  const chance = Math.max(0.025, 0.14 - npc.childIds.length * 0.025);
  if (unit(world, `npc-child:${npc.id}`) >= chance) return;

  const names = ['Avery', 'Rowan', 'Maya', 'Jordan', 'Sage', 'Noah', 'Quinn', 'Casey', 'Eli', 'Nora'];
  const firstName = names[Math.floor(unit(world, `npc-child-name:${npc.id}`) * names.length) % names.length];
  const id = allocateId(world, 'character');
  const inherited = (left: number, right: number, key: string) => clamp((left + right) / 2 + (unit(world, `${key}:${npc.id}`) - 0.5) * 16);
  world.characters[id] = {
    id,
    firstName,
    lastName: npc.lastName,
    birthWeek: world.calendar.week,
    isAlive: true,
    cityId: npc.cityId,
    householdId: npc.householdId,
    parentIds: [npc.id, partner.id],
    childIds: [],
    cashCents: 0,
    health: inherited(npc.health, partner.health, 'child-health'),
    mood: 72,
    stress: 7,
    discipline: inherited(npc.discipline, partner.discipline, 'child-discipline'),
    ambition: inherited(npc.ambition, partner.ambition, 'child-ambition'),
    empathy: inherited(npc.empathy, partner.empathy, 'child-empathy'),
    riskTolerance: inherited(npc.riskTolerance, partner.riskTolerance, 'child-risk'),
    ethics: inherited(npc.ethics, partner.ethics, 'child-ethics'),
    knowledge: 2,
    charisma: inherited(npc.charisma, partner.charisma, 'child-charisma'),
    fitness: inherited(npc.fitness, partner.fitness, 'child-fitness'),
    focuses: ['Family', 'Health', 'Creative Work'],
    reputation: { public: 50, business: 50, employee: 50, political: 50, professional: 50, family: 60, faction: 10 },
    detailTier: 'standard',
    lastMeaningfulWeek: world.calendar.week,
  };
  npc.childIds.push(id);
  partner.childIds.push(id);
  for (const parent of [npc, partner]) {
    const relationshipId = allocateId(world, 'relationship');
    world.relationships[relationshipId] = { id: relationshipId, characterIds: [parent.id, id], kind: 'child', trust: 78, affection: 90, respect: 55, resentment: 0, lastInteractionWeek: world.calendar.week };
  }

  const actor = world.characters[world.playerCharacterId];
  const relation = playerRelationship(world, npc.id);
  if (relation && ['child', 'sibling'].includes(relation.kind)) {
    const relativeRelationshipId = allocateId(world, 'relationship');
    world.relationships[relativeRelationshipId] = { id: relativeRelationshipId, characterIds: [actor.id, id], kind: 'relative', trust: 42, affection: 58, respect: 45, resentment: 0, lastInteractionWeek: world.calendar.week };
    recordHistory(world, 'family', `${firstName} joined the family`, `${npc.firstName} and ${partner.firstName} had a child. Your family tree just got one branch harder to keep straight.`, { important: true, subjectIds: [npc.id, partner.id, id] });
  } else if (relation?.kind === 'friend') {
    recordHistory(world, 'relationship', `${npc.firstName} became a parent`, `${npc.firstName}'s life now includes a very small person with very large scheduling opinions.`, { subjectIds: [npc.id, id], importance: 2 });
  }
}

function maybeNpcMove(world: WorldState, npc: Character, yearlyBoundary: boolean): void {
  if (!yearlyBoundary || npc.id === world.characters[world.playerCharacterId].partnerId) return;
  const actor = world.characters[world.playerCharacterId];
  const relation = playerRelationship(world, npc.id);
  if (!relation) return;
  if (playerAgeYears(world) < 18 && actor.parentIds.includes(npc.id)) return;
  const age = ageAtWeek(npc, world.calendar.week);
  if (age < 18) return;
  const moveChance = 0.02 + npc.ambition / 2200 + npc.riskTolerance / 3000;
  if (unit(world, `npc-move:${npc.id}`) >= moveChance) return;
  const cities = WORLD_CONTENT.cities.filter((city) => city.id !== npc.cityId);
  if (cities.length === 0) return;
  const city = cities[Math.floor(unit(world, `npc-move-city:${npc.id}`) * cities.length) % cities.length];
  npc.cityId = city.id;
  if (npc.partnerId && world.characters[npc.partnerId]?.isAlive) world.characters[npc.partnerId].cityId = city.id;
  for (const childId of npc.childIds) {
    const child = world.characters[childId];
    if (child?.isAlive && ageAtWeek(child, world.calendar.week) < 18) child.cityId = city.id;
  }
  npc.lastMeaningfulWeek = world.calendar.week;
  if (['parent', 'child', 'sibling', 'friend'].includes(relation.kind)) {
    recordHistory(world, 'relationship', `${npc.firstName} moved to ${city.name}`, `${npc.firstName} followed their own life to ${city.name}. Distance can create opportunity, inconvenience, or both at once.`, { subjectIds: [npc.id], importance: relation.kind === 'friend' ? 2 : 3 });
  }
}

function simulateImportantNpcs(world: WorldState, weeks: number, yearlyBoundary: boolean): void {
  for (const npcId of importantNpcIds(world)) {
    const npc = world.characters[npcId];
    if (!npc?.isAlive || npc.id === world.playerCharacterId) continue;
    simulateNpcCareer(world, npc, weeks, yearlyBoundary);
    if (yearlyBoundary) {
      maybeNpcBreakup(world, npc, true);
      maybeNpcPartnership(world, npc, true);
      maybeNpcChild(world, npc, true);
      maybeNpcMove(world, npc, true);
    }
  }
}

function sameParticipants(memory: MemoryRecord, participantIds: string[]): boolean {
  return participantIds.every((id) => memory.participantIds.includes(id)) && memory.participantIds.length === participantIds.length;
}

function thread(world: WorldState, category: string, participantIds: string[]): MemoryRecord | undefined {
  return Object.values(world.memories).find((memory) => memory.unresolved && memory.category === category && sameParticipants(memory, participantIds));
}

function openThread(world: WorldState, category: string, participantIds: string[], narrative: string, importance: number, visibility: MemoryRecord['visibility'] = 'shared'): MemoryRecord | undefined {
  const existing = thread(world, category, participantIds);
  if (existing) {
    existing.narrative = narrative;
    existing.importance = Math.max(existing.importance, importance);
    existing.valence = Math.min(existing.valence, -0.2);
    return existing;
  }
  const unresolvedThreads = Object.values(world.memories).filter((memory) => memory.unresolved && memory.category.startsWith(THREAD_PREFIX));
  if (unresolvedThreads.length >= 6) return undefined;
  const id = allocateId(world, 'memory');
  const created: MemoryRecord = {
    id,
    participantIds,
    category,
    week: world.calendar.week,
    valence: -0.5,
    importance: clamp(importance),
    permanent: false,
    unresolved: true,
    visibility,
    narrative,
  };
  world.memories[id] = created;
  return created;
}

function closeThread(memory: MemoryRecord | undefined, narrative: string): void {
  if (!memory) return;
  memory.unresolved = false;
  memory.narrative = narrative;
  memory.valence = Math.max(-0.2, memory.valence + 0.5);
  if (memory.importance >= 75) memory.permanent = true;
}

function recentReconnectHandled(world: WorldState, memory: MemoryRecord): boolean {
  return world.events.some((event) => event.templateId === 'relationship.reconnect' && event.resolved && event.week >= memory.week && event.selectedChoiceId === 'make-time' && memory.participantIds.every((id) => event.participantIds.includes(id)));
}

function maintainRelationshipThreads(world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  for (const relationship of Object.values(world.relationships)) {
    if (!relationship.characterIds.includes(actor.id) || !['parent', 'child', 'sibling', 'friend', 'partner', 'spouse'].includes(relationship.kind)) continue;
    const otherId = relationship.characterIds.find((id) => id !== actor.id)!;
    const other = world.characters[otherId];
    if (!other?.isAlive) continue;
    const participants = [actor.id, otherId];
    const existing = thread(world, THREAD_RELATIONSHIP, participants);
    const staleWeeks = world.calendar.week - relationship.lastInteractionWeek;
    if (recentReconnectHandled(world, existing ?? { id: '', participantIds: participants, category: THREAD_RELATIONSHIP, week: world.calendar.week + 1, valence: 0, importance: 0, permanent: false, unresolved: false, visibility: 'shared', narrative: '' })) {
      relationship.lastInteractionWeek = world.calendar.week;
      relationship.resentment = clamp(relationship.resentment - 4);
      closeThread(existing, `You and ${other.firstName} made room for each other before the distance became the whole relationship.`);
      continue;
    }
    if (staleWeeks < 10) {
      closeThread(existing, `You and ${other.firstName} are back in each other's actual lives, not just each other's contact lists.`);
      continue;
    }
    if (staleWeeks < 26 || (relationship.affection < 35 && relationship.trust < 35)) continue;
    const role = relationship.kind === 'partner' || relationship.kind === 'spouse' ? 'your relationship' : relationship.kind === 'friend' ? 'the friendship' : 'the family relationship';
    const importance = Math.min(94, 44 + staleWeeks / 2 + relationship.resentment / 2 + (relationship.kind === 'partner' || relationship.kind === 'spouse' ? 18 : 0));
    openThread(world, THREAD_RELATIONSHIP, participants, `${other.firstName} has noticed the distance. ${role} has gone ${staleWeeks} weeks without a real interaction, and silence is starting to become its own answer.`, importance);
    if (relationship.kind === 'friend' && staleWeeks > 90 && relationship.affection < 30 && relationship.trust < 30) {
      relationship.kind = 'acquaintance';
      recordHistory(world, 'relationship', `${other.firstName} drifted out of the inner circle`, `Nothing dramatic happened. You just stopped being part of each other's ordinary life for long enough that the friendship became history.`, { subjectIds: [actor.id, other.id], importance: 3 });
      closeThread(thread(world, THREAD_RELATIONSHIP, participants), `The friendship with ${other.firstName} faded into acquaintance after a long stretch of distance.`);
    }
  }
}

function maintainTimeThread(world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  const participants = [actor.id];
  const budget = getTimeBudget(world);
  const existing = thread(world, THREAD_TIME, participants);
  if (budget.status !== 'overloaded' && budget.status !== 'unsustainable') {
    closeThread(existing, 'Your week has enough breathing room again. Something was delegated, dropped, or finally stopped demanding quite so much of you.');
    return;
  }
  const top = budget.commitments.slice(0, 4).map((item) => `${item.label} (${item.hours}h)`).join(', ');
  openThread(world, THREAD_TIME, participants, `The calendar is carrying about ${budget.committedHours} committed hours against roughly ${budget.capacityHours} sustainable hours. ${top || 'Life'} is doing most of the squeezing. This is no longer a busy week; it is a pattern.`, budget.status === 'unsustainable' ? 90 : 72, 'private');
}

function maintainCareerThread(world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  const participants = [actor.id];
  const existing = thread(world, THREAD_CAREER, participants);
  const career = activeCareer(world, actor.id);
  if (!career) {
    closeThread(existing, 'The career strain ended because that job is no longer your job. Whatever comes next starts from here.');
    return;
  }
  const strained = career.satisfaction < 42 || career.performance < 45 || (actor.stress > 82 && actor.focuses.includes('Job'));
  if (!strained) {
    if (career.satisfaction > 57 && career.performance > 54 && actor.stress < 76) closeThread(existing, `${career.title} stopped feeling like an active problem. The job may not be perfect, but it is no longer consuming the whole story.`);
    return;
  }
  const problem = career.performance < 45 ? 'performance is slipping' : career.satisfaction < 42 ? 'you are increasingly done with the job' : 'the work is colliding with everything else';
  openThread(world, THREAD_CAREER, participants, `${career.title} is becoming a story instead of background income: ${problem}. Performance is ${Math.round(career.performance)}, satisfaction is ${Math.round(career.satisfaction)}, and stress is ${Math.round(actor.stress)}.`, 64 + (actor.stress > 85 ? 18 : 0), 'private');
}

function businessStrainScore(world: WorldState) {
  const actor = world.characters[world.playerCharacterId];
  return Object.values(world.businesses)
    .filter((business) => business.active && (business.ownerId ?? business.founderId) === actor.id && business.playerOwnershipBps > 0)
    .map((business) => {
      const overload = business.demand / Math.max(1, business.capacity);
      const runwayPenalty = business.cashCents < 0 ? Math.min(80, Math.abs(business.cashCents) / Math.max(100_000, business.costWeeklyCents) * 8) : 0;
      const score = Math.max(0, overload - 1) * 55 + Math.max(0, 48 - business.quality) * 1.2 + runwayPenalty;
      return { business, overload, score };
    })
    .sort((left, right) => right.score - left.score)[0];
}

function maintainBusinessThread(world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  const worst = businessStrainScore(world);
  const openBusinessThreads = Object.values(world.memories).filter((memory) => memory.unresolved && memory.category === THREAD_BUSINESS && memory.participantIds.includes(actor.id));
  if (!worst || worst.score < 28) {
    for (const memory of openBusinessThreads) closeThread(memory, 'The company got back inside a manageable operating range. That does not erase the rough stretch, but it is no longer an active fire.');
    return;
  }
  for (const memory of openBusinessThreads) {
    if (!memory.participantIds.includes(worst.business.id)) closeThread(memory, 'That business problem stopped being the one demanding your attention.');
  }
  openThread(world, THREAD_BUSINESS, [actor.id, worst.business.id], `${worst.business.name} is carrying an operating problem that is not disappearing on its own. Demand is ${Math.round(worst.business.demand)} against ${Math.round(worst.business.capacity)} capacity, quality is ${Math.round(worst.business.quality)}, and company cash is ${(worst.business.cashCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}.`, Math.min(92, 55 + worst.score / 2));
}

function maintainFamilyMoneyThread(world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  if (playerAgeYears(world) < 18) return;
  const family = [...actor.parentIds, ...actor.childIds];
  for (const relationship of Object.values(world.relationships)) {
    if (relationship.characterIds.includes(actor.id) && relationship.kind === 'sibling') {
      const siblingId = relationship.characterIds.find((id) => id !== actor.id);
      if (siblingId) family.push(siblingId);
    }
  }
  const uniqueFamily = [...new Set(family)];
  for (const familyId of uniqueFamily) {
    const person = world.characters[familyId];
    if (!person?.isAlive) continue;
    const participants = [actor.id, person.id];
    const existing = thread(world, THREAD_FAMILY_MONEY, participants);
    const recentHelp = world.transactions.some((transaction) => transaction.week >= (existing?.week ?? world.calendar.week + 1) && transaction.fromId === actor.id && transaction.toId === person.id && transaction.amountCents < 0);
    if (person.cashCents >= 100_000 || recentHelp) {
      closeThread(existing, recentHelp ? `You stepped into ${person.firstName}'s money problem. Whether that fixed the underlying pattern is a different question.` : `${person.firstName}'s immediate money pressure eased without becoming your crisis.`);
      continue;
    }
    if (person.cashCents >= -100_000) continue;
    const relation = playerRelationship(world, person.id);
    const closeness = relation ? (relation.trust + relation.affection - relation.resentment) / 2 : 40;
    openThread(world, THREAD_FAMILY_MONEY, participants, `${person.firstName} is under real financial pressure. They are sitting at ${(person.cashCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} in cash, and your relationship is close enough that the problem may eventually become a conversation.`, Math.min(88, 50 + Math.max(0, closeness) / 3));
  }
}

function maybeCreateRelationshipEvent(world: WorldState): void {
  if (world.events.some((event) => !event.resolved)) return;
  const actor = world.characters[world.playerCharacterId];
  const candidates = Object.values(world.memories)
    .filter((memory) => memory.unresolved && memory.category === THREAD_RELATIONSHIP && world.calendar.week - memory.week >= 4)
    .sort((left, right) => right.importance - left.importance || left.week - right.week);
  for (const memory of candidates) {
    const otherId = memory.participantIds.find((id) => id !== actor.id);
    const other = otherId ? world.characters[otherId] : undefined;
    if (!other?.isAlive) continue;
    const recent = world.events.some((event) => event.templateId === 'relationship.reconnect' && event.week >= world.calendar.week - 13 && event.participantIds.includes(other.id));
    if (recent) continue;
    world.events.push({
      id: allocateId(world, 'event'),
      templateId: 'relationship.reconnect',
      domain: 'relationship',
      severity: memory.importance >= 82 ? 'S3' : 'S2',
      week: world.calendar.week,
      title: `${other.firstName} has noticed the disappearing act`,
      narrative: memory.narrative,
      participantIds: [actor.id, other.id],
      choices: [
        { id: 'make-time', label: 'Actually make time', detail: 'Put something else down and show up for the relationship.' },
        { id: 'keep-distance', label: 'Keep the distance', detail: 'Protect your time. The relationship will remember the choice.' },
      ],
      otherActionFamilies: ['relationship'],
      resolved: false,
    });
    return;
  }
}

function maintainStoryThreads(world: WorldState): void {
  maintainRelationshipThreads(world);
  maintainTimeThread(world);
  maintainCareerThread(world);
  maintainBusinessThread(world);
  maintainFamilyMoneyThread(world);
  maybeCreateRelationshipEvent(world);
}

export function getOpenStoryThreads(world: WorldState): MemoryRecord[] {
  return Object.values(world.memories)
    .filter((memory) => memory.unresolved && memory.category.startsWith(THREAD_PREFIX))
    .sort((left, right) => right.importance - left.importance || left.week - right.week);
}

export function applyAutonomousWorld(before: WorldState, source: WorldState): WorldState {
  const weeks = Math.max(0, source.calendar.week - before.calendar.week);
  if (weeks <= 0 || source.playerCharacterId !== before.playerCharacterId) return source;
  const world = clone(source);
  const yearlyBoundary = crossedBoundary(before.calendar.week, world.calendar.week, 52);
  simulateImportantNpcs(world, weeks, yearlyBoundary);
  maintainStoryThreads(world);
  return world;
}
