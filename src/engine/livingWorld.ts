import { allocateId, playerAgeYears } from './createWorld';
import { recordHistory } from './history';
import type { Character, Relationship, WorldState } from './types';

export interface TimeCommitment {
  id: string;
  label: string;
  hours: number;
  detail: string;
}

export interface TimeBudget {
  capacityHours: number;
  committedHours: number;
  freeHours: number;
  overloadHours: number;
  loadRatio: number;
  status: 'open' | 'busy' | 'overloaded' | 'unsustainable';
  commitments: TimeCommitment[];
}

function clone(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world)) as WorldState;
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

function unit(input: string): number {
  return (hash(input) % 1_000_003) / 1_000_003;
}

function chance(world: WorldState, key: string): number {
  return unit(`${world.metadata.worldSeed}:${world.calendar.week}:${key}`);
}

function ageAtWeek(character: Character, week: number): number {
  return Math.max(0, Math.floor((week - character.birthWeek) / 52));
}

function relationshipWith(world: WorldState, leftId: string, rightId: string): Relationship | undefined {
  return Object.values(world.relationships).find((relationship) => relationship.characterIds.includes(leftId) && relationship.characterIds.includes(rightId));
}

function activeEducation(world: WorldState, actorId: string) {
  return Object.values(world.education).find((record) => record.characterId === actorId && ['school', 'higher', 'trade'].includes(record.status));
}

function activeCareer(world: WorldState, actorId: string) {
  return Object.values(world.careers).find((career) => career.characterId === actorId && career.active);
}

export function getTimeBudget(world: WorldState): TimeBudget {
  const actor = world.characters[world.playerCharacterId];
  const age = playerAgeYears(world);
  const commitments: TimeCommitment[] = [];
  const education = activeEducation(world, actor.id);
  const career = activeCareer(world, actor.id);
  const ownedBusinesses = Object.values(world.businesses).filter((business) => business.active && (business.ownerId ?? business.founderId) === actor.id && business.playerOwnershipBps > 0);
  const politics = world.politics[actor.id];

  if (education) {
    const hours = education.status === 'school' ? 34 : education.status === 'trade' ? 38 : 32;
    commitments.push({ id: `education:${education.id}`, label: education.status === 'school' ? 'School' : education.status === 'trade' ? 'Training' : 'College', hours, detail: 'Classes, assignments, studying, and ordinary attendance.' });
  }
  if (career) commitments.push({ id: `career:${career.id}`, label: career.title, hours: 40, detail: 'Your regular job and the energy around it.' });

  for (const business of ownedBusinesses) {
    const hours = business.delegated ? Math.max(3, business.personalTimeHours ?? 5) : Math.max(24, business.personalTimeHours ?? 30);
    commitments.push({ id: `business:${business.id}`, label: business.name, hours, detail: business.delegated ? 'Ownership oversight with professional management.' : 'Owner-led operating time.' });
  }

  if (politics?.campaign) commitments.push({ id: 'campaign', label: `${politics.campaign.office} campaign`, hours: 18, detail: 'Fundraising, appearances, staff, and voter contact.' });
  else if (politics?.office) commitments.push({ id: 'office', label: politics.office, hours: politics.officeLevel === 'national' ? 34 : 16, detail: 'The actual job of governing.' });

  if (actor.partnerId && world.characters[actor.partnerId]?.isAlive) commitments.push({ id: 'partner', label: 'Partner / marriage', hours: 5, detail: 'A healthy relationship takes recurring attention.' });
  if (actor.childIds.length > 0) {
    const livingChildren = actor.childIds.filter((id) => world.characters[id]?.isAlive);
    if (livingChildren.length > 0) commitments.push({ id: 'children', label: 'Parenting', hours: Math.min(20, 6 + livingChildren.length * 4), detail: 'Children create recurring time pressure even when nothing is wrong.' });
  }

  if (actor.focuses.includes('Sport')) commitments.push({ id: 'focus:sport', label: 'Sport', hours: 7, detail: 'Practice, games, recovery, and travel.' });
  if (actor.focuses.includes('Health')) commitments.push({ id: 'focus:health', label: 'Health', hours: 4, detail: 'Exercise and basic self-care.' });
  if (actor.focuses.includes('Networking')) commitments.push({ id: 'focus:networking', label: 'Networking', hours: 4, detail: 'Keeping professional and social connections warm.' });
  if (actor.focuses.includes('Creative Work')) commitments.push({ id: 'focus:creative', label: 'Creative work', hours: 5, detail: 'Projects, hobbies, and deliberate practice.' });

  const capacityHours = age < 5 ? 42 : age < 13 ? 58 : age < 18 ? 64 : 72;
  const committedHours = commitments.reduce((sum, commitment) => sum + commitment.hours, 0);
  const freeHours = Math.max(0, capacityHours - committedHours);
  const overloadHours = Math.max(0, committedHours - capacityHours);
  const loadRatio = capacityHours > 0 ? committedHours / capacityHours : 0;
  const status = loadRatio > 1.32 ? 'unsustainable' : loadRatio > 1 ? 'overloaded' : loadRatio > 0.78 ? 'busy' : 'open';
  return { capacityHours, committedHours, freeHours, overloadHours, loadRatio, status, commitments: commitments.sort((left, right) => right.hours - left.hours) };
}

function crossedAges(before: WorldState, after: WorldState): number[] {
  const beforeActor = before.characters[before.playerCharacterId];
  const afterActor = after.characters[after.playerCharacterId];
  if (!beforeActor || !afterActor || beforeActor.id !== afterActor.id) return [];
  const start = ageAtWeek(beforeActor, before.calendar.week);
  const end = ageAtWeek(afterActor, after.calendar.week);
  const values: number[] = [];
  for (let age = start + 1; age <= end; age += 1) values.push(age);
  return values;
}

function milestoneCopy(age: number): { title: string; detail: string; important: boolean } {
  if (age === 1) return { title: 'One whole year', detail: 'The world is getting bigger: familiar voices, favorite things, and the beginning of a personality.', important: true };
  if (age === 5) return { title: 'School-age now', detail: 'Teachers, classmates, routines, and comparison with other kids start shaping the next few years.', important: true };
  if (age === 10) return { title: 'Double digits', detail: 'Friends, interests, school performance, and family dynamics are starting to stick as real patterns.', important: false };
  if (age === 13) return { title: 'Teenage territory', detail: 'Independence gets louder. Friends matter more, school matters differently, and adults suddenly have a lot of opinions.', important: true };
  if (age === 16) return { title: 'More independence', detail: 'Part-time work, driving-age freedom, dating, bigger mistakes, and bigger opportunities begin to open.', important: true };
  if (age === 18) return { title: 'Legally grown', detail: 'The world stops treating most choices as practice. Work, school, money, housing, politics, and consequences now open wider.', important: true };
  if (age === 21) return { title: 'The twenties are moving', detail: 'Your resume, relationships, habits, and money choices are beginning to compound.', important: false };
  if ([30, 40, 50, 60, 70, 80, 90, 100].includes(age)) return { title: `${age}`, detail: 'Another decade arrives with everything you built, avoided, repaired, and carried forward.', important: true };
  return { title: `Age ${age}`, detail: 'Another year passes. Small habits and relationships keep becoming a life.', important: false };
}

function addPeer(world: WorldState, label: string): void {
  const actor = world.characters[world.playerCharacterId];
  const existingPeer = Object.values(world.relationships).some((relationship) => {
    if (!relationship.characterIds.includes(actor.id) || !['friend', 'acquaintance'].includes(relationship.kind)) return false;
    const otherId = relationship.characterIds.find((id) => id !== actor.id)!;
    const other = world.characters[otherId];
    return other?.isAlive && Math.abs(ageAtWeek(other, world.calendar.week) - playerAgeYears(world)) <= 2;
  });
  if (existingPeer) return;

  const firstNames = ['Avery', 'Noah', 'Maya', 'Jordan', 'Eli', 'Sofia', 'Cameron', 'Nora', 'Sam', 'Quinn', 'Mina', 'Drew'];
  const lastNames = ['Brooks', 'Kim', 'Patel', 'Rivera', 'Bennett', 'Nguyen', 'Morgan', 'Price', 'Okafor', 'Vale'];
  const key = `${world.metadata.worldSeed}:${world.calendar.week}:${label}`;
  const firstName = firstNames[Math.floor(unit(`${key}:first`) * firstNames.length) % firstNames.length];
  const lastName = lastNames[Math.floor(unit(`${key}:last`) * lastNames.length) % lastNames.length];
  const actorAge = playerAgeYears(world);
  const ageOffset = Math.floor(unit(`${key}:age`) * 3) - 1;
  const peerAge = Math.max(5, actorAge + ageOffset);
  const id = allocateId(world, 'character');
  world.characters[id] = {
    id,
    firstName,
    lastName,
    birthWeek: world.calendar.week - peerAge * 52,
    isAlive: true,
    cityId: actor.cityId,
    householdId: `household-${id}`,
    parentIds: [],
    childIds: [],
    cashCents: actorAge < 18 ? 0 : Math.round(50_000 + unit(`${key}:cash`) * 2_500_000),
    health: 68 + unit(`${key}:health`) * 24,
    mood: 55 + unit(`${key}:mood`) * 32,
    stress: 10 + unit(`${key}:stress`) * 32,
    discipline: 28 + unit(`${key}:discipline`) * 62,
    ambition: 30 + unit(`${key}:ambition`) * 64,
    empathy: 30 + unit(`${key}:empathy`) * 65,
    riskTolerance: 20 + unit(`${key}:risk`) * 70,
    ethics: 35 + unit(`${key}:ethics`) * 60,
    knowledge: actorAge < 18 ? 10 + actorAge * 2.2 + unit(`${key}:knowledge`) * 20 : 35 + unit(`${key}:knowledge`) * 52,
    charisma: 30 + unit(`${key}:charisma`) * 64,
    fitness: 35 + unit(`${key}:fitness`) * 58,
    focuses: actorAge < 18 ? ['Academics', 'Sport', 'Family'] : ['Job', 'Networking', 'Health'],
    reputation: { public: 48, business: 45, employee: 50, political: 35, professional: 45, family: 55, faction: 12 },
    detailTier: 'standard',
    lastMeaningfulWeek: world.calendar.week,
  };
  const relationshipId = allocateId(world, 'relationship');
  world.relationships[relationshipId] = {
    id: relationshipId,
    characterIds: [actor.id, id],
    kind: 'friend',
    trust: 44 + unit(`${key}:trust`) * 16,
    affection: 48 + unit(`${key}:affection`) * 18,
    respect: 42 + unit(`${key}:respect`) * 20,
    resentment: 0,
    lastInteractionWeek: world.calendar.week,
  };
  recordHistory(world, 'relationship', `Met ${firstName} ${lastName}`, `${actor.firstName} and ${firstName} became friends ${label}.`, { subjectIds: [actor.id, id] });
}

function applyGrowingUp(before: WorldState, world: WorldState, weeks: number): void {
  const actor = world.characters[world.playerCharacterId];
  const age = playerAgeYears(world);
  const parentRelationships = actor.parentIds.map((id) => relationshipWith(world, actor.id, id)).filter(Boolean) as Relationship[];
  const parentCash = actor.parentIds.reduce((sum, id) => sum + Math.max(0, world.characters[id]?.cashCents ?? 0), 0);

  if (age < 5) {
    actor.knowledge = clamp(actor.knowledge + Math.min(5, weeks * (actor.focuses.includes('Creative Work') ? 0.05 : 0.025)));
    actor.charisma = clamp(actor.charisma + Math.min(3, weeks * 0.018));
    actor.fitness = clamp(actor.fitness + Math.min(3, weeks * 0.022));
  } else if (age < 13) {
    actor.charisma = clamp(actor.charisma + Math.min(4, weeks * (actor.focuses.includes('Family') ? 0.02 : 0.012)));
    actor.discipline = clamp(actor.discipline + Math.min(4, weeks * (actor.focuses.includes('Academics') ? 0.025 : 0.008)));
  } else if (age < 18) {
    actor.charisma = clamp(actor.charisma + Math.min(4, weeks * (actor.focuses.includes('Networking') ? 0.03 : 0.012)));
    actor.discipline = clamp(actor.discipline + Math.min(4, weeks * (actor.focuses.includes('Academics') ? 0.025 : -0.003)));
    actor.riskTolerance = clamp(actor.riskTolerance + Math.min(3, weeks * 0.012));
  }

  if (age < 18) {
    const moneyPressure = parentCash < 1_500_000 ? 1 : parentCash > 30_000_000 ? -0.4 : 0;
    actor.stress = clamp(actor.stress + Math.min(4, weeks * moneyPressure * 0.02));
    for (const relationship of parentRelationships) {
      const warmth = actor.focuses.includes('Family') ? 0.035 : -0.012;
      relationship.trust = clamp(relationship.trust + Math.min(3, weeks * warmth));
      relationship.affection = clamp(relationship.affection + Math.min(4, weeks * warmth));
    }
  }

  for (const crossed of crossedAges(before, world)) {
    const copy = milestoneCopy(crossed);
    recordHistory(world, 'life', copy.title, copy.detail, { important: copy.important, subjectIds: [actor.id] });
    if (crossed === 6) addPeer(world, 'through school');
    if (crossed === 13) addPeer(world, 'as the social world got bigger');
  }
}

function applyTimePressure(world: WorldState, weeks: number): void {
  const actor = world.characters[world.playerCharacterId];
  if (!actor.isAlive || weeks <= 0) return;
  const budget = getTimeBudget(world);
  if (budget.overloadHours <= 0) {
    if (budget.freeHours >= 18) actor.mood = clamp(actor.mood + Math.min(2.5, weeks * 0.025));
    return;
  }

  const excess = budget.overloadHours / Math.max(1, budget.capacityHours);
  const stressHit = Math.min(18, excess * weeks * 0.42);
  actor.stress = clamp(actor.stress + stressHit);
  actor.mood = clamp(actor.mood - Math.min(10, stressHit * 0.42));
  if (budget.status === 'unsustainable') actor.health = clamp(actor.health - Math.min(8, weeks * excess * 0.09));

  const career = activeCareer(world, actor.id);
  if (career) career.performance = clamp(career.performance - Math.min(9, weeks * excess * 0.08));
  const education = activeEducation(world, actor.id);
  if (education) education.recordedGrade = clamp(education.recordedGrade - Math.min(7, weeks * excess * 0.065));

  const protectedFamily = actor.focuses.includes('Family') || actor.focuses.includes('Partner');
  if (!protectedFamily) {
    for (const relationship of Object.values(world.relationships)) {
      if (!relationship.characterIds.includes(actor.id) || !['parent', 'child', 'sibling', 'partner', 'spouse', 'friend'].includes(relationship.kind)) continue;
      relationship.affection = clamp(relationship.affection - Math.min(5, weeks * excess * 0.035));
      relationship.resentment = clamp(relationship.resentment + Math.min(4, weeks * excess * 0.025));
    }
  }

  const recentlyLogged = world.timeline.some((entry) => entry.title === 'There are not enough hours' && world.calendar.week - entry.week < 13);
  if (!recentlyLogged) {
    const top = budget.commitments.slice(0, 3).map((item) => `${item.label} (${item.hours}h)`).join(', ');
    recordHistory(world, 'life', 'There are not enough hours', `Your week is carrying about ${budget.committedHours} committed hours against roughly ${budget.capacityHours} sustainable hours. ${top || 'Life itself'} is doing most of the squeezing. Something will eventually give if nothing is delegated or dropped.`, { important: budget.status === 'unsustainable', subjectIds: [actor.id] });
  }
}

function applyCareerTexture(world: WorldState, weeks: number): void {
  const actor = world.characters[world.playerCharacterId];
  const career = activeCareer(world, actor.id);
  if (!career || weeks <= 0) return;
  const quarterBoundaries = Math.floor(world.calendar.week / 13) - Math.floor((world.calendar.week - weeks) / 13);
  if (quarterBoundaries <= 0) return;

  const recessionRisk = world.economy.regime === 'recession' ? 0.18 : world.economy.regime === 'slow' ? 0.07 : 0.015;
  const performanceRisk = career.performance < 45 ? 0.2 : career.performance < 58 ? 0.08 : 0;
  if (chance(world, `career-shock:${career.id}`) < Math.min(0.55, recessionRisk + performanceRisk)) {
    career.active = false;
    actor.stress = clamp(actor.stress + 9);
    actor.mood = clamp(actor.mood - 6);
    recordHistory(world, 'career', 'The job disappeared', `${career.title} ended in a ${world.economy.regime} economy. Performance, labor conditions, and bad timing all mattered. Your experience remains on the resume.`, { important: true, subjectIds: [actor.id, career.employerId] });
    return;
  }

  if (career.performance >= 76 && actor.focuses.includes('Networking') && chance(world, `recruiter:${career.id}`) < 0.22) {
    actor.reputation.professional = clamp(actor.reputation.professional + 2.5);
    recordHistory(world, 'career', 'A recruiter starts circling', `Someone in your industry noticed the work. Nothing is guaranteed, but your name is traveling farther than your current job title.`, { subjectIds: [actor.id] });
  }
}

function applyWorldNews(world: WorldState, weeks: number): void {
  const quarterBoundaries = Math.floor(world.calendar.week / 13) - Math.floor((world.calendar.week - weeks) / 13);
  if (quarterBoundaries <= 0) return;
  const recentlyLogged = world.timeline.some((entry) => entry.category === 'world' && world.calendar.week - entry.week < 10);
  if (recentlyLogged) return;
  const economy = world.economy;
  const variants = economy.regime === 'recession'
    ? [
        'Hiring freezes are spreading. People who felt secure six months ago are suddenly updating resumes.',
        'Credit is tighter and buyers are getting pickier. Weak businesses are discovering how short a runway can feel.',
        'The local mood has turned defensive: fewer big purchases, more nervous employers, and a lot more “wait and see.”',
      ]
    : economy.regime === 'boom'
      ? [
          'Everybody suddenly knows somebody who is hiring. Wages, rents, and confidence are all trying to outrun each other.',
          'Money is moving quickly. Good businesses are expanding and mediocre ones are briefly convinced they are good businesses.',
          'The city feels flush. That is great for opportunity and less great for anyone trying to buy a house cheaply.',
        ]
      : economy.regime === 'growth'
        ? [
            'Employers are competing a little harder for good people, while housing quietly keeps getting more expensive.',
            'Business is healthy enough that expansion plans are coming back out of drawers.',
            'The economy is moving forward, unevenly but noticeably. Opportunity is easier to find than certainty.',
          ]
        : [
            'The economy is mostly behaving itself, which is usually when people start assuming it always will.',
            'Hiring, housing, and markets are moving without much drama. Small differences in skill and timing matter more in quiet periods.',
            'Nothing is booming and nothing is collapsing. Ordinary decisions are doing most of the compounding.',
          ];
  const detail = variants[Math.floor(chance(world, 'world-news') * variants.length) % variants.length];
  recordHistory(world, 'world', 'Around town', detail, { important: economy.regime === 'recession' });
}

function maybeCreateRelationshipReachOut(world: WorldState): void {
  if (world.events.some((event) => !event.resolved)) return;
  const actor = world.characters[world.playerCharacterId];
  const candidates = Object.values(world.relationships)
    .filter((relationship) => relationship.characterIds.includes(actor.id) && ['parent', 'sibling', 'friend', 'partner', 'spouse'].includes(relationship.kind))
    .map((relationship) => {
      const otherId = relationship.characterIds.find((id) => id !== actor.id)!;
      return { relationship, other: world.characters[otherId] };
    })
    .filter((item) => item.other?.isAlive && world.calendar.week - item.relationship.lastInteractionWeek >= 20)
    .sort((left, right) => (world.calendar.week - right.relationship.lastInteractionWeek) - (world.calendar.week - left.relationship.lastInteractionWeek));
  if (candidates.length === 0 || chance(world, 'relationship-reach-out') > 0.34) return;

  const selected = candidates[0];
  const id = allocateId(world, 'event');
  const family = ['parent', 'sibling'].includes(selected.relationship.kind);
  world.events.push({
    id,
    templateId: 'relationship.reconnect',
    domain: 'relationship',
    severity: 'S2',
    week: world.calendar.week,
    title: family ? `${selected.other.firstName} is checking whether you're still alive` : `${selected.other.firstName} reaches out`,
    narrative: family
      ? `It has been a while. ${selected.other.firstName} wants actual time, not another “we should catch up soon.”`
      : `${selected.other.firstName} noticed the distance too. There is still enough history here to do something with it.`,
    participantIds: [actor.id, selected.other.id],
    choices: [
      { id: 'make-time', label: 'Make time', detail: 'Put something else down and show up for the relationship.' },
      { id: 'keep-distance', label: 'Keep some distance', detail: 'Protect your time. The relationship may cool further.' },
    ],
    otherActionFamilies: ['relationship'],
    resolved: false,
  });
}

export function applyLivingWorldPass(before: WorldState, source: WorldState): WorldState {
  const weeks = Math.max(0, source.calendar.week - before.calendar.week);
  if (weeks <= 0 || source.playerCharacterId !== before.playerCharacterId) return source;
  const world = clone(source);
  const actor = world.characters[world.playerCharacterId];
  if (!actor?.isAlive) return world;

  applyGrowingUp(before, world, weeks);
  applyTimePressure(world, weeks);
  applyCareerTexture(world, weeks);
  applyWorldNews(world, weeks);

  const relationshipWindows = Math.floor(world.calendar.week / 4) - Math.floor(before.calendar.week / 4);
  if (relationshipWindows > 0) maybeCreateRelationshipReachOut(world);
  return world;
}
