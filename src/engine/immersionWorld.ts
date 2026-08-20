import { allocateId, playerAgeYears } from './createWorld';
import { recordHistory } from './history';
import { getTimeBudget } from './livingWorld';
import { netWorthCents } from './money';
import type { Character, EducationState, MemoryRecord, Relationship, WorldState } from './types';

import { WORLD_CONTENT } from '@/content/worldContent';

export interface ImmersionSnapshotItem {
  icon: string;
  title: string;
  detail: string;
  tone: 'calm' | 'warm' | 'tense' | 'legacy';
}

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

function crossedBoundary(beforeWeek: number, afterWeek: number, interval: number): boolean {
  return Math.floor(beforeWeek / interval) < Math.floor(afterWeek / interval);
}

function ageAt(character: Character, week: number): number {
  return Math.max(0, Math.floor((week - character.birthWeek) / 52));
}

function relationshipBetween(world: WorldState, leftId: string, rightId: string): Relationship | undefined {
  return Object.values(world.relationships).find((relationship) => relationship.characterIds.includes(leftId) && relationship.characterIds.includes(rightId));
}

function activeCareer(world: WorldState, characterId: string) {
  return Object.values(world.careers).find((career) => career.characterId === characterId && career.active);
}

function activeEducation(world: WorldState, characterId: string): EducationState | undefined {
  return Object.values(world.education).find((record) => record.characterId === characterId && ['school', 'higher', 'trade'].includes(record.status));
}

function recentHistory(world: WorldState, title: string, weeks = 52): boolean {
  return world.timeline.some((entry) => entry.title === title && world.calendar.week - entry.week <= weeks);
}

function memoryFor(world: WorldState, category: string, participantIds: string[]): MemoryRecord | undefined {
  return Object.values(world.memories).find((memory) => memory.category === category && participantIds.every((id) => memory.participantIds.includes(id)));
}

function upsertMemory(
  world: WorldState,
  category: string,
  participantIds: string[],
  narrative: string,
  importance: number,
  options: { unresolved?: boolean; permanent?: boolean; valence?: number; visibility?: MemoryRecord['visibility'] } = {},
): MemoryRecord {
  const existing = memoryFor(world, category, participantIds);
  if (existing) {
    existing.narrative = narrative;
    existing.importance = clamp(Math.max(existing.importance, importance));
    existing.unresolved = options.unresolved ?? existing.unresolved;
    existing.permanent = options.permanent ?? existing.permanent;
    existing.valence = options.valence ?? existing.valence;
    existing.visibility = options.visibility ?? existing.visibility;
    return existing;
  }
  const id = allocateId(world, 'memory');
  const created: MemoryRecord = {
    id,
    participantIds,
    category,
    week: world.calendar.week,
    valence: options.valence ?? 0,
    importance: clamp(importance),
    permanent: options.permanent ?? false,
    unresolved: options.unresolved ?? false,
    visibility: options.visibility ?? 'shared',
    narrative,
  };
  world.memories[id] = created;
  return created;
}

function firstName(world: WorldState, key: string): string {
  const names = ['Avery', 'Maya', 'Nia', 'Theo', 'Noah', 'Priya', 'Eli', 'Sofia', 'Miles', 'Camila', 'Jordan', 'Darius', 'Mina', 'Quinn', 'Nora', 'Rowan', 'Sam', 'Lena'];
  return names[Math.floor(unit(world, `first:${key}`) * names.length) % names.length];
}

function lastName(world: WorldState, key: string): string {
  const names = ['Bennett', 'Shah', 'Ortega', 'Kim', 'Wallace', 'Nguyen', 'Patel', 'Brooks', 'Alvarez', 'Okafor', 'Rivera', 'Morgan', 'Price', 'Vale', 'Chen', 'Davis'];
  return names[Math.floor(unit(world, `last:${key}`) * names.length) % names.length];
}

function createSocialCharacter(world: WorldState, key: string, age: number, cityId: string, role: 'work' | 'school'): Character {
  const id = allocateId(world, 'character');
  const person: Character = {
    id,
    firstName: firstName(world, key),
    lastName: lastName(world, key),
    birthWeek: world.calendar.week - Math.max(5, age) * 52,
    isAlive: true,
    cityId,
    householdId: `household-${id}`,
    parentIds: [],
    childIds: [],
    cashCents: role === 'work' ? Math.round(150_000 + unit(world, `${key}:cash`) * 7_000_000) : 0,
    health: 62 + unit(world, `${key}:health`) * 33,
    mood: 48 + unit(world, `${key}:mood`) * 43,
    stress: 12 + unit(world, `${key}:stress`) * 45,
    discipline: 28 + unit(world, `${key}:discipline`) * 67,
    ambition: 25 + unit(world, `${key}:ambition`) * 70,
    empathy: 26 + unit(world, `${key}:empathy`) * 69,
    riskTolerance: 18 + unit(world, `${key}:risk`) * 76,
    ethics: 30 + unit(world, `${key}:ethics`) * 67,
    knowledge: role === 'work' ? 35 + unit(world, `${key}:knowledge`) * 60 : 10 + age * 2 + unit(world, `${key}:knowledge`) * 22,
    charisma: 25 + unit(world, `${key}:charisma`) * 70,
    fitness: 30 + unit(world, `${key}:fitness`) * 64,
    focuses: role === 'work' ? ['Job', 'Networking', 'Health'] : ['Academics', 'Family', 'Sport'],
    reputation: { public: 48, business: 47, employee: 52, political: 35, professional: 48, family: 55, faction: 12 },
    detailTier: 'standard',
    lastMeaningfulWeek: world.calendar.week,
  };
  world.characters[id] = person;
  return person;
}

function createProfessionalRelationship(world: WorldState, actorId: string, personId: string, key: string): Relationship {
  const id = allocateId(world, 'relationship');
  const relationship: Relationship = {
    id,
    characterIds: [actorId, personId],
    kind: 'professional',
    trust: 38 + unit(world, `${key}:trust`) * 28,
    affection: 20 + unit(world, `${key}:affection`) * 26,
    respect: 42 + unit(world, `${key}:respect`) * 30,
    resentment: unit(world, `${key}:resentment`) * 14,
    lastInteractionWeek: world.calendar.week,
  };
  world.relationships[id] = relationship;
  return relationship;
}

function createSchoolRelationship(world: WorldState, actorId: string, personId: string, key: string): Relationship {
  const id = allocateId(world, 'relationship');
  const relationship: Relationship = {
    id,
    characterIds: [actorId, personId],
    kind: unit(world, `${key}:kind`) > 0.74 ? 'friend' : 'acquaintance',
    trust: 34 + unit(world, `${key}:trust`) * 35,
    affection: 36 + unit(world, `${key}:affection`) * 40,
    respect: 34 + unit(world, `${key}:respect`) * 37,
    resentment: unit(world, `${key}:resentment`) * 15,
    lastInteractionWeek: world.calendar.week,
  };
  world.relationships[id] = relationship;
  return relationship;
}

function ensureWorkplaceCast(world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  const career = activeCareer(world, actor.id);
  if (!career) return;
  const existing = Object.values(world.relationships)
    .filter((relationship) => relationship.kind === 'professional' && relationship.characterIds.includes(actor.id))
    .map((relationship) => relationship.characterIds.find((id) => id !== actor.id)!)
    .filter((id) => activeCareer(world, id)?.employerId === career.employerId);
  const needed = Math.max(0, 3 - existing.length);
  if (needed === 0) return;
  const organization = world.organizations[career.employerId];
  const actorAge = playerAgeYears(world);
  const roleLabels = ['manager', 'peer', 'rising colleague'];
  const created: Character[] = [];

  for (let index = 0; index < needed; index += 1) {
    const slot = existing.length + index;
    const key = `work-cast:${career.employerId}:${slot}`;
    const role = roleLabels[slot] ?? 'colleague';
    const age = role === 'manager' ? Math.max(28, actorAge + 8 + Math.floor(unit(world, `${key}:age`) * 12)) : Math.max(18, actorAge - 4 + Math.floor(unit(world, `${key}:age`) * 9));
    const person = createSocialCharacter(world, key, age, actor.cityId, 'work');
    const salaryFactor = role === 'manager' ? 1.35 : role === 'rising colleague' ? 1.08 : 0.92;
    const careerId = allocateId(world, 'career');
    world.careers[careerId] = {
      id: careerId,
      characterId: person.id,
      employerId: career.employerId,
      title: role === 'manager' ? `${career.sector} team lead` : role === 'rising colleague' ? `Senior ${career.sector.toLowerCase()} colleague` : `${career.sector} colleague`,
      sector: career.sector,
      weeklySalaryCents: Math.round(career.weeklySalaryCents * salaryFactor),
      performance: 45 + unit(world, `${key}:performance`) * 46,
      satisfaction: 44 + unit(world, `${key}:satisfaction`) * 45,
      weeksInRole: Math.round(20 + unit(world, `${key}:tenure`) * 260),
      active: true,
    };
    person.professionId = role === 'manager' ? 'profession-project-manager' : actor.professionId;
    createProfessionalRelationship(world, actor.id, person.id, key);
    if (organization && !organization.memberIds.includes(person.id)) organization.memberIds.push(person.id);
    created.push(person);
  }

  if (created.length > 0 && !recentHistory(world, 'Work has faces now', 260)) {
    const names = created.map((person) => person.firstName).join(', ');
    recordHistory(world, 'career', 'Work has faces now', `${names} ${created.length === 1 ? 'is' : 'are'} part of the actual social world around ${career.title}. Careers are not only salaries and performance scores anymore; the people around the work can matter later.`, { subjectIds: [actor.id, ...created.map((person) => person.id)], importance: 2 });
  }
}

function ensureSchoolCast(world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  const education = activeEducation(world, actor.id);
  if (!education) return;
  const existing = Object.values(world.relationships)
    .filter((relationship) => relationship.characterIds.includes(actor.id) && ['friend', 'acquaintance'].includes(relationship.kind))
    .map((relationship) => relationship.characterIds.find((id) => id !== actor.id)!)
    .filter((id) => Object.values(world.education).some((record) => record.characterId === id && record.institutionId === education.institutionId && ['school', 'higher', 'trade'].includes(record.status)));
  const target = education.status === 'school' ? 4 : 3;
  const needed = Math.max(0, target - existing.length);
  if (needed === 0) return;
  const actorAge = playerAgeYears(world);
  const created: Character[] = [];

  for (let index = 0; index < needed; index += 1) {
    const slot = existing.length + index;
    const key = `school-cast:${education.institutionId}:${education.id}:${slot}`;
    const age = Math.max(5, actorAge + Math.floor(unit(world, `${key}:age`) * 3) - 1);
    const person = createSocialCharacter(world, key, age, actor.cityId, 'school');
    const recordId = allocateId(world, 'education');
    world.education[recordId] = {
      id: recordId,
      characterId: person.id,
      institutionId: education.institutionId,
      status: education.status,
      startedWeek: education.startedWeek,
      level: education.level,
      recordedGrade: 46 + unit(world, `${key}:grade`) * 48,
      knowledgeGain: person.knowledge,
      prestige: education.prestige,
      network: 30 + unit(world, `${key}:network`) * 55,
      tuitionCentsPerYear: 0,
      manipulatedCredential: false,
    };
    createSchoolRelationship(world, actor.id, person.id, key);
    const organization = world.organizations[education.institutionId];
    if (organization && !organization.memberIds.includes(person.id)) organization.memberIds.push(person.id);
    created.push(person);
  }

  if (created.length > 0 && !recentHistory(world, 'A social world forms around school', 208)) {
    recordHistory(world, 'education', 'A social world forms around school', `${created.map((person) => person.firstName).join(', ')} ${created.length === 1 ? 'is now part' : 'are now part'} of the faces attached to this chapter. Some will fade. A few may still matter decades from now.`, { subjectIds: [actor.id, ...created.map((person) => person.id)], importance: 2 });
  }
}

function relationshipTemperature(relationship: Relationship): number {
  return clamp((relationship.trust * 0.34 + relationship.affection * 0.38 + relationship.respect * 0.28) - relationship.resentment * 0.52);
}

function simulateWorkplacePolitics(world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  const career = activeCareer(world, actor.id);
  if (!career) return;
  const contacts = Object.values(world.relationships)
    .filter((relationship) => relationship.kind === 'professional' && relationship.characterIds.includes(actor.id))
    .map((relationship) => ({ relationship, personId: relationship.characterIds.find((id) => id !== actor.id)! }))
    .filter(({ personId }) => activeCareer(world, personId)?.employerId === career.employerId);

  for (const { relationship, personId } of contacts) {
    const person = world.characters[personId];
    const colleagueCareer = activeCareer(world, personId);
    if (!person || !colleagueCareer) continue;
    const actorSignal = career.performance * 0.45 + actor.charisma * 0.2 + actor.discipline * 0.2 + actor.ethics * 0.15;
    const egoCollision = Math.max(0, person.ambition + actor.ambition - 145) / 80;
    relationship.respect = clamp(relationship.respect + (actorSignal - 55) / 180 + (unit(world, `work-respect:${personId}`) - 0.5) * 1.2);
    relationship.trust = clamp(relationship.trust + (actor.ethics - 50) / 280 + (actor.empathy - 50) / 420 - egoCollision * 0.18);
    relationship.resentment = clamp(relationship.resentment + egoCollision * 0.5 + Math.max(0, actorSignal - colleagueCareer.performance - 18) / 150 - actor.empathy / 1600);

    const isManager = colleagueCareer.title.toLowerCase().includes('lead');
    const temperature = relationshipTemperature(relationship);
    if (isManager && temperature >= 68) {
      career.performance = clamp(career.performance + 1.2);
      actor.reputation.professional = clamp(actor.reputation.professional + 0.5);
      upsertMemory(world, 'Workplace · Sponsor', [actor.id, person.id], `${person.firstName} has become the kind of manager who mentions your name when you are not in the room. That invisible advocacy is becoming part of your career capital.`, 66, { valence: 0.7, permanent: false });
    }
    if (isManager && (relationship.resentment >= 48 || temperature < 34)) {
      career.satisfaction = clamp(career.satisfaction - 2);
      upsertMemory(world, 'Workplace · Friction', [actor.id, person.id], `${person.firstName} is no longer merely difficult to work with. Trust is thin enough that assignments, reviews, and interpretations of your work are becoming political.`, 74, { valence: -0.8, unresolved: true });
    } else {
      const friction = memoryFor(world, 'Workplace · Friction', [actor.id, person.id]);
      if (friction && temperature > 52 && relationship.resentment < 30) {
        friction.unresolved = false;
        friction.narrative = `The friction with ${person.firstName} cooled. Neither of you forgot it, but it stopped controlling the work.`;
      }
    }
  }
}

function simulateSchoolSocialLife(world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  const education = activeEducation(world, actor.id);
  if (!education) return;
  const peers = Object.values(world.relationships)
    .filter((relationship) => relationship.characterIds.includes(actor.id) && ['friend', 'acquaintance', 'rival'].includes(relationship.kind));

  for (const relationship of peers) {
    const otherId = relationship.characterIds.find((id) => id !== actor.id)!;
    const otherEducation = Object.values(world.education).find((record) => record.characterId === otherId && record.institutionId === education.institutionId && ['school', 'higher', 'trade'].includes(record.status));
    if (!otherEducation) continue;
    const person = world.characters[otherId];
    if (!person?.isAlive) continue;
    const socialFit = (actor.charisma + actor.empathy + person.charisma + person.empathy) / 4;
    const competition = Math.abs(education.recordedGrade - otherEducation.recordedGrade);
    relationship.affection = clamp(relationship.affection + (socialFit - 45) / 300 + (unit(world, `school-affection:${otherId}`) - 0.5));
    relationship.respect = clamp(relationship.respect + (actor.discipline - 45) / 420 + competition / 900);
    relationship.resentment = clamp(relationship.resentment + Math.max(0, competition - 25) / 300 - actor.empathy / 2200);
    if (relationship.kind === 'acquaintance' && relationship.affection > 69 && relationship.trust > 60) {
      relationship.kind = 'friend';
      recordHistory(world, 'relationship', `${person.firstName} stopped feeling like just a classmate`, `Enough ordinary days accumulated that ${person.firstName} became a real friend. There was no dramatic scene; the relationship simply crossed the line.`, { subjectIds: [actor.id, person.id], importance: 3 });
      upsertMemory(world, 'Relationship · Became friends', [actor.id, person.id], `${person.firstName} became a friend during ${education.level}.`, 68, { permanent: true, valence: 0.8 });
    }
    if (relationship.kind !== 'rival' && relationship.resentment > 72 && relationship.respect > 45) {
      relationship.kind = 'rival';
      recordHistory(world, 'relationship', `${person.firstName} became competition`, `The relationship with ${person.firstName} hardened into rivalry. There is enough respect to keep watching each other and enough resentment to make it matter.`, { subjectIds: [actor.id, person.id], importance: 3 });
    }
  }
}

function rememberRelationshipTurningPoints(before: WorldState, world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  for (const relationship of Object.values(world.relationships)) {
    if (!relationship.characterIds.includes(actor.id)) continue;
    const previous = before.relationships[relationship.id];
    if (!previous) continue;
    const otherId = relationship.characterIds.find((id) => id !== actor.id)!;
    const person = world.characters[otherId];
    if (!person) continue;
    const beforeTemperature = relationshipTemperature(previous);
    const afterTemperature = relationshipTemperature(relationship);
    if (beforeTemperature < 70 && afterTemperature >= 70) {
      upsertMemory(world, 'Relationship · Deepened', [actor.id, otherId], `${person.firstName} became one of the people you genuinely trust. The relationship reached a level that usually takes repeated ordinary choices, not one perfect conversation.`, 76, { permanent: true, valence: 0.9 });
    }
    if (beforeTemperature >= 38 && afterTemperature < 38) {
      upsertMemory(world, 'Relationship · Fracture', [actor.id, otherId], `Something changed with ${person.firstName}. The relationship is now strained enough that future conversations will arrive carrying history into the room.`, 78, { permanent: true, unresolved: true, valence: -0.85 });
    }
  }
}

function familyMilestones(before: WorldState, world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  const milestones = new Set([1, 5, 13, 16, 18, 21, 30, 40]);
  for (const childId of actor.childIds) {
    const child = world.characters[childId];
    const previousChild = before.characters[childId];
    if (!child?.isAlive || !previousChild) continue;
    const startAge = ageAt(previousChild, before.calendar.week);
    const endAge = ageAt(child, world.calendar.week);
    for (let age = startAge + 1; age <= endAge; age += 1) {
      if (!milestones.has(age)) continue;
      const copy = age === 5 ? 'School is beginning to become its own world.'
        : age === 13 ? 'Childhood is giving way to a more private, complicated person.'
          : age === 16 ? 'Independence is no longer theoretical.'
            : age === 18 ? 'They are legally an adult now, even if neither of you entirely believes it.'
              : age === 21 ? 'Their adult life is beginning to collect momentum of its own.'
                : age === 1 ? 'The first year somehow disappeared.'
                  : `Another decade is arriving with a person who keeps becoming more themselves.`;
      recordHistory(world, 'family', `${child.firstName} turned ${age}`, `${copy} Your relationship with ${child.firstName} now has a new age on both sides of it.`, { subjectIds: [actor.id, child.id], importance: [13, 18, 21].includes(age) ? 4 : 3 });
    }
  }

  for (const parentId of actor.parentIds) {
    const parent = world.characters[parentId];
    if (!parent?.isAlive) continue;
    const age = ageAt(parent, world.calendar.week);
    const participants = [actor.id, parent.id];
    const agingMemory = memoryFor(world, 'Family · Aging parent', participants);
    if (age >= 68 && parent.health < 58) {
      const memory = upsertMemory(world, 'Family · Aging parent', participants, `${parent.firstName} is ${age} now, and their health is no longer background information. Their independence, your availability, distance, money, and old family dynamics may increasingly collide.`, 78 + Math.max(0, 55 - parent.health) / 2, { unresolved: true, valence: -0.45, permanent: true });
      if (memory.week === world.calendar.week && !recentHistory(world, `${parent.firstName} is getting older`, 260)) {
        recordHistory(world, 'family', `${parent.firstName} is getting older`, `There was no single dramatic moment. You just started noticing that ${parent.firstName}'s health and age belong in plans now.`, { subjectIds: participants, importance: 4 });
      }
    } else if (agingMemory && parent.health >= 66) {
      agingMemory.unresolved = false;
      agingMemory.narrative = `${parent.firstName}'s health is currently stable enough that aging is back to being background rather than an active family problem.`;
    }
  }
}

function careerMilestones(before: WorldState, world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  const career = activeCareer(world, actor.id);
  const beforeCareer = career ? before.careers[career.id] : undefined;
  if (!career || !beforeCareer) return;
  const marks = [52, 156, 260, 520];
  for (const mark of marks) {
    if (beforeCareer.weeksInRole < mark && career.weeksInRole >= mark) {
      const years = Math.round(mark / 52);
      recordHistory(world, 'career', `${years} year${years === 1 ? '' : 's'} in the role`, `${career.title} has lasted long enough to become more than a line you recently added to a résumé. The people, reputation, habits, and tradeoffs around the job are now part of your history.`, { subjectIds: [actor.id, career.employerId], importance: years >= 5 ? 4 : 3 });
    }
  }
}

function wealthIdentity(before: WorldState, world: WorldState): void {
  const beforeWorth = netWorthCents(before);
  const worth = netWorthCents(world);
  const thresholds = [
    { cents: 100_000_000, title: 'A millionaire on paper', detail: 'Seven figures changes what is possible, but it also changes which problems are worth paying someone else to solve.' },
    { cents: 1_000_000_000, title: 'Eight figures changes the room', detail: 'At this level, bankers, advisors, sellers, charities, relatives, and opportunists can begin treating you differently even when you feel exactly the same.' },
    { cents: 10_000_000_000, title: 'Wealth is becoming visible', detail: 'Nine-figure wealth is hard to keep socially invisible. Access expands, privacy gets more valuable, and family expectations can quietly inflate.' },
    { cents: 100_000_000_000, title: 'The fortune has gravity', detail: 'At billionaire scale, money stops behaving like a personal score. It attracts institutions, employees, political attention, heirs, litigants, and people with plans for it.' },
  ];
  for (const threshold of thresholds) {
    if (beforeWorth < threshold.cents && worth >= threshold.cents && !recentHistory(world, threshold.title, 10_000)) {
      recordHistory(world, 'markets', threshold.title, threshold.detail, { important: true, importance: 4 });
    }
  }
}

function maintainCompanyCulture(world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  for (const business of Object.values(world.businesses)) {
    if (!business.active || (business.ownerId ?? business.founderId) !== actor.id || business.employees < 3) continue;
    const overload = business.demand / Math.max(1, business.capacity);
    const manager = business.delegated ? business.managerQuality ?? 58 : (actor.discipline + actor.empathy + actor.ethics) / 3;
    const pressure = business.growthPosture === 'aggressive' ? 14 : business.growthPosture === 'conservative' ? -4 : 4;
    const culture = clamp(manager * 0.48 + business.quality * 0.25 + business.reputation * 0.18 + actor.ethics * 0.09 - Math.max(0, overload - 1) * 28 - pressure);
    const character = culture >= 75 ? 'People generally know what good work looks like here, and strong performers are beginning to trust the place.'
      : culture >= 58 ? 'The company mostly functions like a place people can build a career, though growth pressure still leaks into ordinary weeks.'
        : culture >= 42 ? 'The company is getting results, but people are starting to trade stories about workload, priorities, and whether leadership notices the cost.'
          : 'The company is developing the kind of culture talented people complain about after they leave. Turnover, quality, and reputation can eventually make that expensive.';
    upsertMemory(world, 'Company · Culture', [actor.id, business.id], `${business.name}: ${character}`, 50 + Math.abs(culture - 58) / 2, { unresolved: culture < 42, valence: (culture - 50) / 50, permanent: false, visibility: 'private' });
    business.quality = clamp(business.quality + (culture - 55) / 800);
    business.reputation = clamp(business.reputation + (culture - 58) / 1100);
    if (culture < 38 && !recentHistory(world, `${business.name} has a people problem`, 52)) {
      recordHistory(world, 'business', `${business.name} has a people problem`, `The numbers are not the only thing under strain. Employees are increasingly experiencing the company as a place to survive rather than a place to stay.`, { subjectIds: [actor.id, business.id], importance: 3 });
    }
  }
}

function addSmallLifeMoment(world: WorldState): void {
  if (recentHistory(world, 'A small moment', 10)) return;
  const actor = world.characters[world.playerCharacterId];
  const career = activeCareer(world, actor.id);
  const education = activeEducation(world, actor.id);
  const partner = actor.partnerId ? world.characters[actor.partnerId] : undefined;
  const livingChildren = actor.childIds.map((id) => world.characters[id]).filter((child) => child?.isAlive);
  const parents = actor.parentIds.map((id) => world.characters[id]).filter((parent) => parent?.isAlive);
  const businesses = Object.values(world.businesses).filter((business) => business.active && (business.ownerId ?? business.founderId) === actor.id && business.playerOwnershipBps > 0);
  const properties = Object.values(world.properties).filter((property) => property.ownerId === actor.id);
  const choices: string[] = [];

  if (partner?.isAlive) choices.push(`You and ${partner.firstName} had one of those completely ordinary conversations that would never make a highlight reel. It still counted. Most relationships are built there.`);
  if (livingChildren.length > 0) {
    const child = livingChildren[Math.floor(unit(world, 'small-moment-child') * livingChildren.length) % livingChildren.length];
    choices.push(`${child.firstName} said or did something that made their age feel suddenly obvious. You caught a glimpse of the person they are becoming instead of the child you remember.`);
  }
  if (parents.length > 0 && playerAgeYears(world) >= 25) {
    const parent = parents[Math.floor(unit(world, 'small-moment-parent') * parents.length) % parents.length];
    choices.push(`A conversation with ${parent.firstName} briefly felt less like parent and child and more like two adults comparing notes on how strange life turned out.`);
  }
  if (career) choices.push(`At work, somebody asked for your opinion before giving theirs. It was a tiny thing, but it said something about where ${career.title} now sits in the room.`);
  if (education) choices.push(`A class, hallway, practice, or study session felt completely forgettable while it was happening. Years from now, this may be exactly the kind of day nostalgia chooses.`);
  if (businesses.length > 0) {
    const business = businesses[0];
    choices.push(`${business.name} kept moving for a week without asking whether you felt ready. Employees, customers, bills, and expectations have started making the company feel like a thing with momentum of its own.`);
  }
  if (properties.some((property) => property.occupancy === 'owner')) choices.push('Home felt briefly like home rather than an asset, payment, project, or line on a net-worth screen. That distinction is easy to miss when life gets busy.');
  if (choices.length === 0) choices.push('Nothing dramatic happened. A week still passed, routines became habits, and people formed slightly stronger opinions about who you are.');
  const detail = choices[Math.floor(unit(world, 'small-moment') * choices.length) % choices.length];
  recordHistory(world, 'life', 'A small moment', detail, { importance: 1 });
}

export function getImmersionSnapshot(world: WorldState): ImmersionSnapshotItem[] {
  const actor = world.characters[world.playerCharacterId];
  const budget = getTimeBudget(world);
  const career = activeCareer(world, actor.id);
  const education = activeEducation(world, actor.id);
  const partner = actor.partnerId ? world.characters[actor.partnerId] : undefined;
  const relationships = Object.values(world.relationships).filter((relationship) => relationship.characterIds.includes(actor.id));
  const closest = relationships
    .map((relationship) => ({ relationship, score: relationshipTemperature(relationship), otherId: relationship.characterIds.find((id) => id !== actor.id)! }))
    .filter((item) => world.characters[item.otherId]?.isAlive)
    .sort((left, right) => right.score - left.score)[0];
  const neglected = relationships
    .map((relationship) => ({ relationship, weeks: world.calendar.week - relationship.lastInteractionWeek, otherId: relationship.characterIds.find((id) => id !== actor.id)! }))
    .filter((item) => world.characters[item.otherId]?.isAlive && ['parent', 'child', 'sibling', 'friend', 'partner', 'spouse'].includes(item.relationship.kind))
    .sort((left, right) => right.weeks - left.weeks)[0];
  const business = Object.values(world.businesses).filter((item) => item.active && (item.ownerId ?? item.founderId) === actor.id && item.playerOwnershipBps > 0).sort((a, b) => b.valuationCents - a.valuationCents)[0];
  const home = Object.values(world.properties).find((property) => property.ownerId === actor.id && property.occupancy === 'owner');
  const items: ImmersionSnapshotItem[] = [];

  if (career) items.push({ icon: '💼', title: career.title, detail: career.performance >= 72 ? 'Work is going well enough that people are noticing.' : career.performance < 45 ? 'Performance is shaky enough that the next review matters.' : 'The job is steady, which can be either reassuring or suspiciously temporary.', tone: career.performance < 45 ? 'tense' : 'calm' });
  else if (education) items.push({ icon: '📚', title: education.level, detail: education.recordedGrade >= 82 ? 'Academically, you are building options.' : education.recordedGrade < 60 ? 'School is becoming a problem that future-you will inherit.' : 'You are getting through it with a record that still leaves multiple doors open.', tone: education.recordedGrade < 60 ? 'tense' : 'calm' });
  else items.push({ icon: '🧭', title: 'No institution owns the weekday', detail: 'Without school or a regular job, your time is unusually flexible—and unusually easy to waste.', tone: 'warm' });

  if (business) items.push({ icon: '🏢', title: business.name, detail: business.delegated ? `${business.managerName ?? 'Management'} is carrying most of the operating week while you remain the owner.` : `The company still depends heavily on your attention. Demand is ${Math.round(business.demand)} against ${Math.round(business.capacity)} capacity.`, tone: business.demand > business.capacity * 1.15 ? 'tense' : 'legacy' });
  else if (home) items.push({ icon: '🏠', title: home.name, detail: home.condition < 55 ? 'Home is accumulating the kind of maintenance that eventually stops being cosmetic.' : 'For now, home is doing its job: being somewhere life happens instead of another crisis.', tone: home.condition < 55 ? 'tense' : 'warm' });

  if (partner?.isAlive) {
    const relationship = relationshipBetween(world, actor.id, partner.id);
    items.push({ icon: '❤️', title: partner.firstName, detail: relationship && relationshipTemperature(relationship) >= 65 ? 'The relationship currently feels like a source of stability rather than another obligation.' : 'There is enough history here that neglect or attention will both compound.', tone: relationship && relationshipTemperature(relationship) < 42 ? 'tense' : 'warm' });
  } else if (closest) {
    const person = world.characters[closest.otherId];
    items.push({ icon: '🫶', title: person.firstName, detail: `${person.firstName} is currently one of the strongest relationships in your orbit. Strong does not mean permanent.`, tone: 'warm' });
  }

  if (neglected && neglected.weeks >= 20) {
    const person = world.characters[neglected.otherId];
    items.push({ icon: '📵', title: `${neglected.weeks} weeks is a while`, detail: `${person.firstName} has gone a long time without a real interaction. Silence is beginning to count as behavior.`, tone: 'tense' });
  }

  items.push({ icon: budget.status === 'unsustainable' ? '🔥' : budget.status === 'overloaded' ? '⏳' : '🌤️', title: budget.status === 'open' ? 'There is room in the week' : budget.status === 'busy' ? 'The calendar is pretty full' : budget.status === 'overloaded' ? 'Something has to give' : 'This pace is not sustainable', detail: `${budget.committedHours}h committed against about ${budget.capacityHours}h of sustainable weekly capacity.`, tone: budget.status === 'open' ? 'calm' : budget.status === 'busy' ? 'warm' : 'tense' });
  return items.slice(0, 4);
}

export function relationshipPortrait(world: WorldState, personId: string): { summary: string; traits: string[]; recentSharedHistory: string[]; currentLife: string } {
  const actor = world.characters[world.playerCharacterId];
  const person = world.characters[personId];
  const relationship = relationshipBetween(world, actor.id, personId);
  if (!person || !relationship) return { summary: 'This person is still mostly unknown to you.', traits: [], recentSharedHistory: [], currentLife: 'Their life is mostly outside your view.' };
  const temperature = relationshipTemperature(relationship);
  const summary = temperature >= 75 ? `There is real history and trust here. ${person.firstName} is close enough that your choices can feel personal.`
    : temperature >= 55 ? `The relationship is solid, but not immune to neglect, conflict, or changing lives.`
      : temperature >= 35 ? `You know each other, but the relationship currently has more distance than warmth.`
        : `This relationship is strained. Future interactions arrive carrying unresolved history.`;
  const traits = [
    person.ambition >= 72 ? 'very ambitious' : person.ambition <= 35 ? 'not especially status-driven' : 'moderately ambitious',
    person.empathy >= 72 ? 'highly empathetic' : person.empathy <= 35 ? 'emotionally blunt' : 'socially balanced',
    person.riskTolerance >= 72 ? 'comfortable with risk' : person.riskTolerance <= 32 ? 'cautious' : 'measured about risk',
    person.discipline >= 72 ? 'very disciplined' : person.discipline <= 35 ? 'inconsistent' : 'reasonably disciplined',
  ];
  const history = [...Object.values(world.memories)]
    .filter((memory) => memory.participantIds.includes(actor.id) && memory.participantIds.includes(person.id))
    .sort((left, right) => right.week - left.week)
    .slice(0, 4)
    .map((memory) => memory.narrative);
  const career = activeCareer(world, person.id);
  const partner = person.partnerId ? world.characters[person.partnerId] : undefined;
  const city = WORLD_CONTENT.cities.find((item) => item.id === person.cityId)?.name ?? 'another city';
  const pieces = [career ? `works as ${career.title}` : ageAt(person, world.calendar.week) < 18 ? 'is still in school-age life' : 'is between formal roles', `lives in ${city}`];
  if (partner?.isAlive) pieces.push(`is partnered with ${partner.firstName}`);
  if (person.childIds.filter((id) => world.characters[id]?.isAlive).length > 0) pieces.push(`has ${person.childIds.filter((id) => world.characters[id]?.isAlive).length} child${person.childIds.filter((id) => world.characters[id]?.isAlive).length === 1 ? '' : 'ren'}`);
  return { summary, traits, recentSharedHistory: history, currentLife: `${person.firstName} ${pieces.join(', ')}.` };
}

export function applyImmersionWorld(before: WorldState, source: WorldState): WorldState {
  const weeks = Math.max(0, source.calendar.week - before.calendar.week);
  if (weeks <= 0 || source.playerCharacterId !== before.playerCharacterId) return source;
  const world = clone(source);
  ensureWorkplaceCast(world);
  ensureSchoolCast(world);
  rememberRelationshipTurningPoints(before, world);
  familyMilestones(before, world);
  careerMilestones(before, world);
  wealthIdentity(before, world);

  if (crossedBoundary(before.calendar.week, world.calendar.week, 13)) {
    simulateWorkplacePolitics(world);
    simulateSchoolSocialLife(world);
    maintainCompanyCulture(world);
    addSmallLifeMoment(world);
  }
  return world;
}
