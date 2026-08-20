import { allocateId, playerAgeYears } from './createWorld';
import {
  annualSkillDecay,
  careerCompetencies,
  competency,
  effectiveBusinessCompetence,
  effectiveCareerCompetence,
  ensureCompetencies,
  gainCompetency,
  normalizeCompetencies,
  practiceFromCareer,
  practiceFromEducation,
} from './competencies';
import { recordHistory } from './history';
import { getTimeBudget } from './livingWorld';
import type { Business, CareerState, Character, CompetencyKey, EducationState, MemoryRecord, WorldState } from './types';

import { WORLD_CONTENT } from '@/content/worldContent';

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

function crossed(before: WorldState, after: WorldState, interval: number): boolean {
  return Math.floor(before.calendar.week / interval) < Math.floor(after.calendar.week / interval);
}

function activeCareer(world: WorldState, characterId: string): CareerState | undefined {
  return Object.values(world.careers).find((career) => career.characterId === characterId && career.active);
}

function activeEducation(world: WorldState, characterId: string): EducationState | undefined {
  return Object.values(world.education).find((record) => record.characterId === characterId && ['school', 'higher', 'trade'].includes(record.status));
}

function relationshipWithPlayer(world: WorldState, characterId: string) {
  return Object.values(world.relationships).find((relationship) => relationship.characterIds.includes(world.playerCharacterId) && relationship.characterIds.includes(characterId));
}

function hasCompletedHigherEducation(world: WorldState, characterId: string): boolean {
  return Object.values(world.education).some((record) => record.characterId === characterId && record.status === 'completed' && record.level !== 'Secondary diploma');
}

function upsertPrivateMemory(world: WorldState, category: string, participantIds: string[], narrative: string, importance: number, unresolved = false): MemoryRecord {
  const existing = Object.values(world.memories).find((memory) => memory.category === category && participantIds.every((id) => memory.participantIds.includes(id)));
  if (existing) {
    existing.narrative = narrative;
    existing.importance = Math.max(existing.importance, importance);
    existing.week = world.calendar.week;
    existing.unresolved = unresolved;
    return existing;
  }
  const id = allocateId(world, 'memory');
  const memory: MemoryRecord = { id, participantIds, category, week: world.calendar.week, valence: 0, importance, permanent: false, unresolved, visibility: 'private', narrative };
  world.memories[id] = memory;
  return memory;
}

function inferCareerLevel(title: string): number {
  const text = title.toLowerCase();
  if (/chief|president|executive|partner/.test(text)) return 6;
  if (/vice president|vp|director/.test(text)) return 5;
  if (/manager|principal|lead|supervisor/.test(text)) return 4;
  if (/senior/.test(text)) return 3;
  if (/intern|trainee|assistant/.test(text)) return 1;
  return 2;
}

function inferCareerHours(career: CareerState): number {
  const text = `${career.title} ${career.sector}`.toLowerCase();
  if (/intern/.test(text)) return 22;
  if (/part.?time/.test(text)) return 20;
  if (/chief|president|executive|partner/.test(text)) return 50;
  if (/director|manager|lead|supervisor/.test(text)) return 44;
  if (/athlete|sport/.test(text)) return 46;
  return 40;
}

function normalizeCareer(career: CareerState): void {
  career.level = career.level ?? inferCareerLevel(career.title);
  career.hoursPerWeek = career.hoursPerWeek ?? inferCareerHours(career);
  career.department = career.department ?? career.sector;
  career.promotionProgress = clamp(career.promotionProgress ?? Math.max(0, career.performance - 48));
  career.organizationStanding = clamp(career.organizationStanding ?? 48);
}

function inferEducationMajor(record: EducationState): string | undefined {
  const match = record.level.match(/(?:Undergraduate|Graduate|Degree|Bachelor|Master)\s*[·:-]?\s*(.+)$/i);
  return match?.[1]?.trim();
}

function normalizeEducation(record: EducationState): void {
  record.major = record.major ?? inferEducationMajor(record);
  record.clubs = record.clubs ?? [];
  record.athleticLevel = clamp(record.athleticLevel ?? 0);
  record.athleticRecognition = clamp(record.athleticRecognition ?? 0);
  record.scholarshipCents = Math.max(0, record.scholarshipCents ?? 0);
}

function defaultProductName(business: Business): string {
  const sector = business.sector.toLowerCase();
  if (sector.includes('food')) return 'Flagship menu';
  if (sector.includes('technology')) return 'Core product';
  if (sector.includes('media')) return 'Primary channel';
  if (sector.includes('real estate')) return 'Core portfolio';
  if (sector.includes('manufacturing')) return 'Primary line';
  if (sector.includes('services')) return 'Core service';
  return 'Core offering';
}

function normalizeBusiness(business: Business): void {
  business.locations = Math.max(1, business.locations ?? 1);
  business.marketShare = clamp(business.marketShare ?? Math.min(12, Math.log10(Math.max(10, business.revenueWeeklyCents / 100)) * 1.4), 0, 100);
  business.customerLoyalty = clamp(business.customerLoyalty ?? business.reputation * 0.75 + business.quality * 0.25);
  business.culture = clamp(business.culture ?? 55);
  business.complexity = clamp(business.complexity ?? Math.min(100, 8 + Math.log10(Math.max(1, business.employees)) * 14 + (business.locations - 1) * 5));
  if (!business.productLines || business.productLines.length === 0) {
    const price = business.pricePosition === 'premium' ? 15_000 : business.pricePosition === 'value' ? 7_500 : 10_000;
    business.productLines = [{
      id: `${business.id}-product-core`,
      name: defaultProductName(business),
      priceCents: price,
      unitCostCents: Math.round(price * 0.42),
      quality: business.quality,
      demand: business.demand,
      reputation: business.reputation,
      maturity: business.revenueWeeklyCents > 2_000_000 ? 'mature' : 'growing',
      active: true,
    }];
  }
}

export function normalizeDeepSimulationState(source: WorldState): WorldState {
  const world = clone(source);
  normalizeCompetencies(world);
  for (const career of Object.values(world.careers)) normalizeCareer(career);
  for (const education of Object.values(world.education)) normalizeEducation(education);
  for (const business of Object.values(world.businesses)) normalizeBusiness(business);
  return world;
}

function practicedSkillsForPlayer(world: WorldState, weeks: number): Set<CompetencyKey> {
  const actor = world.characters[world.playerCharacterId];
  const practiced = new Set<CompetencyKey>();
  const career = activeCareer(world, actor.id);
  if (career) {
    practiceFromCareer(world, career, weeks);
    careerCompetencies(career).forEach((skill) => practiced.add(skill));
  }
  const education = activeEducation(world, actor.id);
  if (education) {
    practiceFromEducation(world, education, weeks);
    practiced.add('academics');
    if (education.sport || actor.focuses.includes('Sport')) practiced.add('athletics');
  }
  const ownedBusinesses = Object.values(world.businesses).filter((business) => business.active && (business.ownerId ?? business.founderId) === actor.id && business.playerOwnershipBps > 0);
  if (ownedBusinesses.length > 0) {
    const intensity = Math.min(2.2, weeks / 18);
    for (const skill of ['management', 'finance', 'sales', 'leadership', 'negotiation'] as CompetencyKey[]) {
      gainCompetency(actor, skill, intensity * (actor.focuses.includes('Startup') ? 1.15 : 0.72));
      practiced.add(skill);
    }
  }
  const holdings = Object.values(world.holdings).filter((holding) => holding.ownerId === actor.id);
  if (holdings.length > 0) {
    gainCompetency(actor, 'investing', Math.min(1.4, weeks / 28));
    gainCompetency(actor, 'finance', Math.min(0.7, weeks / 42));
    practiced.add('investing');
    practiced.add('finance');
  }
  const political = world.politics[actor.id];
  if (political?.campaign || political?.office) {
    gainCompetency(actor, 'politics', Math.min(1.8, weeks / 20));
    gainCompetency(actor, 'communication', Math.min(1, weeks / 30));
    gainCompetency(actor, 'leadership', Math.min(0.8, weeks / 32));
    practiced.add('politics');
    practiced.add('communication');
    practiced.add('leadership');
  }
  if (actor.childIds.some((id) => world.characters[id]?.isAlive)) {
    gainCompetency(actor, 'parenting', Math.min(1.1, weeks / 30) * (actor.focuses.includes('Family') ? 1.2 : 0.65));
    practiced.add('parenting');
  }
  if (actor.focuses.includes('Sport')) {
    gainCompetency(actor, 'athletics', Math.min(1.6, weeks / 22));
    practiced.add('athletics');
  }
  if (actor.focuses.includes('Networking')) {
    gainCompetency(actor, 'communication', Math.min(0.8, weeks / 36));
    gainCompetency(actor, 'negotiation', Math.min(0.55, weeks / 44));
    practiced.add('communication');
    practiced.add('negotiation');
  }
  return practiced;
}

function applyOpportunityCost(world: WorldState, weeks: number): void {
  const actor = world.characters[world.playerCharacterId];
  const budget = getTimeBudget(world);
  if (budget.overloadHours <= 0) {
    if (budget.freeHours >= 16) {
      actor.stress = clamp(actor.stress - Math.min(3.5, weeks * 0.035));
      actor.mood = clamp(actor.mood + Math.min(2.5, weeks * 0.025));
    }
    return;
  }

  const overload = budget.overloadHours / Math.max(1, budget.capacityHours);
  const pressure = Math.min(14, overload * weeks * 0.34);
  actor.stress = clamp(actor.stress + pressure);
  const protectedFocus = new Set(actor.focuses);
  const career = activeCareer(world, actor.id);
  const education = activeEducation(world, actor.id);
  const businesses = Object.values(world.businesses).filter((business) => business.active && (business.ownerId ?? business.founderId) === actor.id && business.playerOwnershipBps > 0);

  if (career && !protectedFocus.has('Job')) {
    career.performance = clamp(career.performance - pressure * 0.45);
    career.satisfaction = clamp(career.satisfaction - pressure * 0.22);
    career.promotionProgress = clamp((career.promotionProgress ?? 0) - pressure * 0.5);
  }
  if (education && !protectedFocus.has('Academics')) education.recordedGrade = clamp(education.recordedGrade - pressure * 0.52);
  if (!protectedFocus.has('Startup')) {
    for (const business of businesses.filter((item) => !item.delegated)) {
      business.quality = clamp(business.quality - pressure * 0.2);
      business.culture = clamp((business.culture ?? 50) - pressure * 0.24);
    }
  }
  if (!protectedFocus.has('Health')) actor.health = clamp(actor.health - pressure * (budget.status === 'unsustainable' ? 0.22 : 0.08));
  if (!protectedFocus.has('Family') && !protectedFocus.has('Partner')) {
    for (const relationship of Object.values(world.relationships)) {
      if (!relationship.characterIds.includes(actor.id) || !['parent', 'child', 'sibling', 'partner', 'spouse', 'friend'].includes(relationship.kind)) continue;
      relationship.affection = clamp(relationship.affection - pressure * 0.14);
      relationship.resentment = clamp(relationship.resentment + pressure * 0.11);
    }
  }

  const story = `${budget.committedHours} committed hours are competing for roughly ${budget.capacityHours} sustainable hours. Your three standing priorities protect some parts of life, which means the unprotected parts are where the schedule leaks first.`;
  upsertPrivateMemory(world, 'System · Opportunity cost', [actor.id], story, budget.status === 'unsustainable' ? 84 : 68, true);
}

function applyCareerOrganization(world: WorldState, weeks: number): void {
  const actor = world.characters[world.playerCharacterId];
  const career = activeCareer(world, actor.id);
  if (!career) return;
  normalizeCareer(career);
  const competence = effectiveCareerCompetence(world, career);
  const managerRelationship = career.managerId ? Object.values(world.relationships).find((relationship) => relationship.characterIds.includes(actor.id) && relationship.characterIds.includes(career.managerId!)) : undefined;
  const managerFactor = managerRelationship ? managerRelationship.respect * 0.12 + managerRelationship.trust * 0.08 - managerRelationship.resentment * 0.14 : 4;
  const networkFactor = actor.reputation.professional * 0.11;
  const progress = (career.performance * 0.25 + competence * 0.27 + (career.organizationStanding ?? 48) * 0.18 + networkFactor + managerFactor - 36) * Math.min(1.4, weeks / 13);
  career.promotionProgress = clamp((career.promotionProgress ?? 0) + Math.max(-4, progress * 0.16));
  career.organizationStanding = clamp((career.organizationStanding ?? 48) + (career.performance - 55) * 0.006 * weeks + (actor.focuses.includes('Networking') ? 0.025 * weeks : 0));

  if ((career.promotionProgress ?? 0) >= 88 && career.weeksInRole >= 52) {
    upsertPrivateMemory(world, 'Career · Promotion window', [actor.id, career.id], `${career.title} is no longer just a job you are doing. Your performance, relevant skills, internal standing, and relationships are strong enough that a promotion push has real leverage now.`, 72, true);
  }

  if (competence < 48 && career.level! >= 4) {
    career.performance = clamp(career.performance - Math.min(4, weeks * 0.035));
    actor.stress = clamp(actor.stress + Math.min(3, weeks * 0.025));
    upsertPrivateMemory(world, 'Career · Competence gap', [actor.id, career.id], `The title is currently ahead of the underlying skill base. Senior responsibility is exposing weak spots that tenure and reputation cannot permanently hide.`, 66, true);
  }
}

function applyEducationDepth(world: WorldState, weeks: number): void {
  const actor = world.characters[world.playerCharacterId];
  const education = activeEducation(world, actor.id);
  if (!education) return;
  normalizeEducation(education);
  const academics = competency(world, actor.id, 'academics');
  const communication = competency(world, actor.id, 'communication');
  const budget = getTimeBudget(world);
  const overloadPenalty = budget.overloadHours > 0 ? Math.min(5, budget.overloadHours / 10) : 0;
  education.recordedGrade = clamp(education.recordedGrade + ((academics - 50) / 500 + (actor.discipline - 50) / 700 + communication / 2200 - overloadPenalty / 30) * weeks);
  education.network = clamp(education.network + (actor.focuses.includes('Networking') ? 0.035 : 0.008) * weeks);

  if (education.sport || actor.focuses.includes('Sport')) {
    education.sport = education.sport ?? 'School athletics';
    const growth = Math.max(0, (competency(world, actor.id, 'athletics') * 0.45 + actor.fitness * 0.35 + actor.discipline * 0.2 - 42) / 900) * weeks;
    education.athleticLevel = clamp((education.athleticLevel ?? 20) + growth);
    education.athleticRecognition = clamp((education.athleticRecognition ?? 4) + Math.max(0, (education.athleticLevel! - 45) / 1000) * weeks);
    if (education.athleticLevel! >= 78 && education.athleticRecognition! >= 52 && ageAtWeek(actor, world.calendar.week) >= 16) {
      upsertPrivateMemory(world, 'Athletics · Recruiting attention', [actor.id, education.id], `Your athletic profile is now strong enough that coaches and programs can plausibly care about results, not just participation. Competition, academics, health, and visibility will determine whether that becomes a real next step.`, 70, true);
    }
  }
}

function applyBusinessDepth(world: WorldState, weeks: number): void {
  for (const business of Object.values(world.businesses)) {
    if (!business.active) continue;
    normalizeBusiness(business);
    const products = business.productLines!.filter((product) => product.active);
    if (products.length === 0) continue;
    const owner = world.characters[business.ownerId ?? business.founderId];
    const ownerSkill = owner ? effectiveBusinessCompetence(world, owner.id) : 45;
    const managementQuality = business.delegated ? business.managerQuality ?? 55 : ownerSkill;
    const complexityPressure = Math.max(0, (business.complexity ?? 20) - managementQuality) / 100;
    const economyDemand = world.economy.regime === 'boom' ? 1.03 : world.economy.regime === 'growth' ? 1.015 : world.economy.regime === 'recession' ? 0.965 : 1;

    for (const product of products) {
      const priceValue = product.priceCents <= 0 ? 1 : product.unitCostCents / product.priceCents;
      const qualityPull = (product.quality - 50) / 700;
      const reputationPull = (product.reputation - 50) / 1000;
      const maturityDrag = product.maturity === 'declining' ? -0.012 : product.maturity === 'new' ? 0.009 : 0;
      const demandGrowth = qualityPull + reputationPull + maturityDrag + (economyDemand - 1) - Math.max(0, priceValue - 0.7) * 0.01 - complexityPressure * 0.02;
      product.demand = Math.max(1, product.demand * (1 + demandGrowth * Math.min(8, weeks)));
      product.quality = clamp(product.quality - complexityPressure * weeks * 0.08 + (managementQuality - 52) * weeks * 0.002);
      product.reputation = clamp(product.reputation + (product.quality - product.reputation) * 0.008 * weeks);
      if (product.maturity === 'new' && product.demand > Math.max(20, business.capacity * 0.3)) product.maturity = 'growing';
      if (product.maturity === 'growing' && world.calendar.week % 104 < weeks) product.maturity = 'mature';
      if (product.maturity === 'mature' && product.quality < 42 && world.calendar.week % 156 < weeks) product.maturity = 'declining';
    }

    business.demand = products.reduce((sum, product) => sum + product.demand, 0);
    business.quality = products.reduce((sum, product) => sum + product.quality, 0) / products.length;
    business.reputation = clamp(products.reduce((sum, product) => sum + product.reputation, 0) / products.length * 0.72 + (business.customerLoyalty ?? 50) * 0.28);
    business.customerLoyalty = clamp((business.customerLoyalty ?? 50) + (business.quality - 55) * 0.006 * weeks - complexityPressure * 0.07 * weeks);
    business.culture = clamp((business.culture ?? 55) + (managementQuality - 55) * 0.004 * weeks - complexityPressure * 0.1 * weeks);
    business.complexity = clamp(8 + Math.log10(Math.max(1, business.employees)) * 14 + Math.max(0, (business.locations ?? 1) - 1) * 5 + Math.max(0, products.length - 1) * 7);
    business.marketShare = clamp((business.marketShare ?? 1) + Math.max(-0.3, Math.min(0.4, (business.reputation - 55) / 900 + world.economy.growth / 20)) * weeks);

    const playerOwned = (business.ownerId ?? business.founderId) === world.playerCharacterId && business.playerOwnershipBps > 0;
    if (playerOwned && complexityPressure > 0.28) {
      upsertPrivateMemory(world, `Business · ${business.id} management ceiling`, [world.playerCharacterId, business.id], `${business.name} has become more complex than its current management capacity. Products, locations, people, and customer expectations are outrunning the systems used to run them. Hiring stronger management or simplifying the company would attack the cause rather than the symptoms.`, 74, true);
    }
  }
}

function maybeNpcEducation(world: WorldState, npc: Character): void {
  const age = ageAtWeek(npc, world.calendar.week);
  if (age < 18 || age > 31 || activeEducation(world, npc.id) || hasCompletedHigherEducation(world, npc.id)) return;
  const academic = competency(world, npc.id, 'academics');
  const desire = academic * 0.38 + npc.ambition * 0.3 + npc.knowledge * 0.18 + npc.discipline * 0.14;
  const affordability = npc.cashCents > 2_000_000 ? 10 : npc.cashCents < 0 ? -14 : 0;
  if (unit(world, `npc-education:${npc.id}`) * 100 + 18 > desire + affordability) return;
  const school = WORLD_CONTENT.universities[Math.floor(unit(world, `npc-school:${npc.id}`) * WORLD_CONTENT.universities.length) % WORLD_CONTENT.universities.length];
  const majors = ['Business', 'Finance', 'Computer Science', 'Engineering', 'Communications', 'Political Science', 'Biology'];
  const major = majors[Math.floor(unit(world, `npc-major:${npc.id}`) * majors.length) % majors.length];
  const id = allocateId(world, 'education');
  world.education[id] = { id, characterId: npc.id, institutionId: school.id, status: 'higher', startedWeek: world.calendar.week, level: `Undergraduate · ${major}`, major, recordedGrade: clamp(55 + academic * 0.32 + unit(world, `npc-grade:${npc.id}`) * 14), knowledgeGain: npc.knowledge, prestige: school.prestige, network: school.network * 0.6, tuitionCentsPerYear: school.tuitionCentsPerYear, manipulatedCredential: false, clubs: [], athleticLevel: 0, athleticRecognition: 0, scholarshipCents: 0 };
  npc.lastMeaningfulWeek = world.calendar.week;
  const relation = relationshipWithPlayer(world, npc.id);
  if (relation && ['child', 'sibling', 'friend', 'partner', 'spouse'].includes(relation.kind)) recordHistory(world, 'education', `${npc.firstName} went back to school`, `${npc.firstName} enrolled in ${major} at ${school.name}. Their education now competes with the rest of their own life.`, { subjectIds: [npc.id, id], importance: relation.kind === 'child' ? 3 : 2 });
}

function chooseBetterProfession(world: WorldState, npc: Character, career: CareerState) {
  const age = ageAtWeek(npc, world.calendar.week);
  const degree = hasCompletedHigherEducation(world, npc.id);
  const totalExperience = Object.values(world.careers).filter((item) => item.characterId === npc.id).reduce((sum, item) => sum + item.weeksInRole, 0);
  return WORLD_CONTENT.professions
    .filter((profession) => profession.minimumAge <= age && (!profession.requiredDegree || degree) && totalExperience >= profession.minExperienceWeeks && npc.knowledge >= profession.minKnowledge)
    .map((profession) => {
      const mock: CareerState = { ...career, title: profession.title, sector: profession.sector, weeklySalaryCents: profession.weeklySalaryCents };
      const fit = effectiveCareerCompetence(world, mock);
      const payGain = Math.max(-20, Math.log(Math.max(1, profession.weeklySalaryCents / Math.max(1, career.weeklySalaryCents))) * 35);
      return { profession, score: fit * 0.58 + npc.ambition * 0.22 + payGain + unit(world, `npc-job-option:${npc.id}:${profession.id}`) * 12 };
    })
    .sort((left, right) => right.score - left.score)[0]?.profession;
}

function maybeNpcCareerMove(world: WorldState, npc: Character): void {
  const career = activeCareer(world, npc.id);
  if (!career || career.weeksInRole < 39) return;
  normalizeCareer(career);
  const restless = career.satisfaction < 44 || (npc.ambition > 72 && career.weeksInRole > 104);
  if (!restless || unit(world, `npc-career-move:${npc.id}`) > 0.34) return;
  const next = chooseBetterProfession(world, npc, career);
  if (!next || next.title === career.title || next.weeklySalaryCents < career.weeklySalaryCents * 0.94) return;
  career.active = false;
  const id = allocateId(world, 'career');
  world.careers[id] = { id, characterId: npc.id, employerId: career.employerId, title: next.title, sector: next.sector, weeklySalaryCents: next.weeklySalaryCents, performance: clamp(48 + effectiveCareerCompetence(world, { ...career, title: next.title, sector: next.sector }) * 0.18), satisfaction: 64, weeksInRole: 0, active: true, hoursPerWeek: inferCareerHours({ ...career, title: next.title, sector: next.sector }), level: inferCareerLevel(next.title), department: next.sector, promotionProgress: 8, organizationStanding: 42 };
  npc.professionId = next.id;
  npc.lastMeaningfulWeek = world.calendar.week;
  const relation = relationshipWithPlayer(world, npc.id);
  if (relation && ['parent', 'child', 'sibling', 'friend', 'partner', 'spouse'].includes(relation.kind)) recordHistory(world, 'career', `${npc.firstName} made a career move`, `${npc.firstName} left ${career.title} for ${next.title}. Their own ambition, skill fit, pay, and satisfaction drove the move.`, { subjectIds: [npc.id], importance: relation.kind === 'child' ? 3 : 2 });
}

function maybeNpcInvest(world: WorldState, npc: Character): void {
  const age = ageAtWeek(npc, world.calendar.week);
  if (age < 20 || npc.cashCents < 2_000_000) return;
  const skill = competency(world, npc.id, 'investing');
  const reserve = Math.max(1_200_000, activeCareer(world, npc.id)?.weeklySalaryCents ? activeCareer(world, npc.id)!.weeklySalaryCents * 14 : 1_200_000);
  const available = Math.max(0, npc.cashCents - reserve);
  if (available < 500_000 || unit(world, `npc-invest:${npc.id}`) > 0.18 + skill / 500) return;
  const securities = Object.values(world.securities).sort((left, right) => {
    const leftScore = left.quality * (skill / 100) - left.volatility * ((100 - npc.riskTolerance) / 100) + unit(world, `npc-sec:${npc.id}:${left.id}`) * 25;
    const rightScore = right.quality * (skill / 100) - right.volatility * ((100 - npc.riskTolerance) / 100) + unit(world, `npc-sec:${npc.id}:${right.id}`) * 25;
    return rightScore - leftScore;
  });
  const security = securities[0];
  if (!security) return;
  const spend = Math.min(available, Math.round(available * (0.18 + npc.riskTolerance / 400)));
  if (spend <= 0) return;
  npc.cashCents -= spend;
  const existing = Object.values(world.holdings).find((holding) => holding.ownerId === npc.id && holding.securityId === security.id);
  const units = Math.floor(spend * 1000 / Math.max(1, security.priceCents));
  if (existing) { existing.unitsMilli += units; existing.costBasisCents += spend; }
  else {
    const id = allocateId(world, 'holding');
    world.holdings[id] = { id, ownerId: npc.id, securityId: security.id, unitsMilli: units, costBasisCents: spend };
  }
  gainCompetency(npc, 'investing', 0.35);
}

function maybeNpcBusiness(world: WorldState, npc: Character): void {
  const age = ageAtWeek(npc, world.calendar.week);
  if (age < 21 || npc.cashCents < 5_000_000 || npc.ambition < 68 || effectiveBusinessCompetence(world, npc.id) < 58) return;
  if (Object.values(world.businesses).some((business) => business.active && (business.ownerId ?? business.founderId) === npc.id)) return;
  if (unit(world, `npc-business:${npc.id}`) > 0.09 + npc.riskTolerance / 900) return;
  const sectors = WORLD_CONTENT.businessSectors;
  const sector = sectors[Math.floor(unit(world, `npc-business-sector:${npc.id}`) * sectors.length) % sectors.length];
  const capital = Math.min(Math.round(npc.cashCents * 0.45), 20_000_000);
  npc.cashCents -= capital;
  const orgId = allocateId(world, 'organization');
  const businessId = allocateId(world, 'business');
  const name = `${npc.lastName} ${sector.name.split('&')[0].trim()}`;
  world.organizations[orgId] = { id: orgId, kind: 'business', name, resourcesCents: capital, influence: 8, stability: 55, memberIds: [npc.id], leaderId: npc.id, history: [`Founded by ${npc.firstName} ${npc.lastName} in week ${world.calendar.week}.`] };
  world.businesses[businessId] = { id: businessId, organizationId: orgId, name, sector: sector.name, cityId: npc.cityId, founderId: npc.id, ownerId: npc.id, cashCents: capital, debtCents: 0, revenueWeeklyCents: 0, costWeeklyCents: 0, valuationCents: capital, playerOwnershipBps: 0, votingControlBps: 0, employees: 1, capacity: 15, demand: 8, quality: 58, reputation: 45, marketingBps: 400, pricePosition: 'market', growthPosture: npc.riskTolerance >= 65 ? 'aggressive' : 'balanced', delegated: false, active: true, personalTimeHours: 28, productLines: [], marketShare: 0.4, customerLoyalty: 42, culture: 58, complexity: 12, locations: 1 };
  normalizeBusiness(world.businesses[businessId]);
  npc.lastMeaningfulWeek = world.calendar.week;
  const relation = relationshipWithPlayer(world, npc.id);
  if (relation && ['child', 'sibling', 'friend', 'partner', 'spouse'].includes(relation.kind)) recordHistory(world, 'business', `${npc.firstName} started a company`, `${npc.firstName} put real money and time into ${name}. It can grow, fail, hire people, compete, and change their life without waiting for you.`, { subjectIds: [npc.id, businessId], importance: relation.kind === 'child' ? 4 : 3 });
}

function applyNpcAutonomy(world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  const candidates = Object.values(world.characters)
    .filter((character) => character.isAlive && character.id !== actor.id && character.detailTier !== 'statistical')
    .sort((left, right) => {
      const leftRelation = relationshipWithPlayer(world, left.id);
      const rightRelation = relationshipWithPlayer(world, right.id);
      return Number(Boolean(rightRelation)) - Number(Boolean(leftRelation));
    })
    .slice(0, 60);
  for (const npc of candidates) {
    ensureCompetencies(npc);
    maybeNpcEducation(world, npc);
    maybeNpcCareerMove(world, npc);
    maybeNpcInvest(world, npc);
    maybeNpcBusiness(world, npc);
  }
}

function applyCrossSystemOpportunities(world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  const trusted = Object.values(world.relationships)
    .filter((relationship) => relationship.characterIds.includes(actor.id) && ['friend', 'professional', 'sibling', 'relative'].includes(relationship.kind) && relationship.trust >= 62 && relationship.respect >= 58)
    .map((relationship) => ({ relationship, person: world.characters[relationship.characterIds.find((id) => id !== actor.id)!] }))
    .filter((item) => item.person?.isAlive);
  const capital = Object.values(world.holdings).filter((holding) => holding.ownerId === actor.id).reduce((sum, holding) => sum + holding.costBasisCents, 0) + Math.max(0, actor.cashCents);
  if (capital >= 10_000_000) {
    const dealFriend = trusted.find(({ person }) => competency(world, person.id, 'finance') >= 62 || competency(world, person.id, 'investing') >= 62);
    if (dealFriend) upsertPrivateMemory(world, 'Opportunity · Private deal flow', [actor.id, dealFriend.person.id], `${dealFriend.person.firstName} moves in financial circles you now have enough capital to enter. Your relationship, reputation, and liquidity have created access to deals that would not appear on a public market screen.`, 68, true);
  }
  const education = Object.values(world.education).find((record) => record.characterId === actor.id && record.status === 'completed' && record.network >= 65);
  const career = activeCareer(world, actor.id);
  if (education && career) career.organizationStanding = clamp((career.organizationStanding ?? 48) + 0.4);
  if (competency(world, actor.id, 'athletics') >= 82 && actor.reputation.public >= 62) actor.reputation.political = clamp(actor.reputation.political + 0.15);
}

export function applyDeepSimulationAdvance(before: WorldState, source: WorldState): WorldState {
  const weeks = Math.max(0, source.calendar.week - before.calendar.week);
  if (weeks <= 0) return source;
  const world = normalizeDeepSimulationState(source);
  const actor = world.characters[world.playerCharacterId];
  if (!actor?.isAlive) return world;

  const practiced = practicedSkillsForPlayer(world, weeks);
  applyOpportunityCost(world, weeks);
  applyCareerOrganization(world, weeks);
  applyEducationDepth(world, weeks);
  applyBusinessDepth(world, weeks);
  if (crossed(before, world, 13)) applyCrossSystemOpportunities(world);
  if (crossed(before, world, 26)) applyNpcAutonomy(world);
  if (crossed(before, world, 52)) annualSkillDecay(world, actor, practiced);

  const age = playerAgeYears(world);
  if (age >= 55 && actor.stress >= 78 && getTimeBudget(world).status === 'unsustainable') {
    actor.health = clamp(actor.health - Math.min(5, weeks * 0.05));
    upsertPrivateMemory(world, 'Health · Pace has a cost', [actor.id], `At this age, the schedule is no longer borrowing only from mood. Sustained overload and stress are starting to show up as a physical constraint on the rest of the life.`, 78, true);
  }
  return world;
}
