import { competency } from './competencies';
import { allocateId } from './createWorld';
import { recordHistory } from './history';
import { clampCents, netWorthCents } from './money';
import { nextRandom } from './random';
import { getDeepTimeBudget } from './timeSystem';
import type { Character, Domain, GameEvent, MemoryRecord, Relationship, WorldState } from './types';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function random(world: WorldState): number {
  const next = nextRandom(world.rngState);
  world.rngState = next.state;
  return next.value;
}

function crossed(before: WorldState, after: WorldState, interval: number): number {
  return Math.max(0, Math.floor(after.calendar.week / interval) - Math.floor(before.calendar.week / interval));
}

function ageAt(world: WorldState, person: Character): number {
  return Math.max(0, Math.floor((world.calendar.week - person.birthWeek) / 52));
}

function actorOf(world: WorldState): Character {
  return world.characters[world.playerCharacterId];
}

function relationshipWith(world: WorldState, personId: string): Relationship | undefined {
  const actor = actorOf(world);
  return Object.values(world.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(personId));
}

function recentMemory(world: WorldState, category: string, weeks: number, participantId?: string): boolean {
  return Object.values(world.memories).some((memory) => memory.category === category
    && world.calendar.week - memory.week < weeks
    && (!participantId || memory.participantIds.includes(participantId)));
}

function upsertMemory(
  world: WorldState,
  category: string,
  participantIds: string[],
  narrative: string,
  importance: number,
  unresolved: boolean,
  valence = 0,
): MemoryRecord {
  const existing = Object.values(world.memories).find((memory) => memory.category === category
    && participantIds.every((id) => memory.participantIds.includes(id)));
  if (existing) {
    existing.week = world.calendar.week;
    existing.narrative = narrative;
    existing.importance = Math.max(existing.importance, importance);
    existing.unresolved = unresolved;
    existing.valence = valence;
    return existing;
  }
  const id = allocateId(world, 'memory');
  const memory: MemoryRecord = {
    id,
    participantIds,
    category,
    week: world.calendar.week,
    valence,
    importance,
    permanent: false,
    unresolved,
    visibility: 'private',
    narrative,
  };
  world.memories[id] = memory;
  return memory;
}

function addDecisionMemory(world: WorldState, event: GameEvent, choiceId: string, narrative: string, valence: number): void {
  const id = allocateId(world, 'memory');
  world.memories[id] = {
    id,
    participantIds: event.participantIds.length > 0 ? [...event.participantIds] : [world.playerCharacterId],
    category: `Decision · ${event.templateId}`,
    week: world.calendar.week,
    valence,
    importance: event.severity === 'S3' || event.severity === 'S4' ? 78 : 60,
    permanent: true,
    unresolved: false,
    visibility: 'private',
    narrative: `${choiceId}: ${narrative}`,
  };
}

function addStoryEvent(
  world: WorldState,
  event: Omit<GameEvent, 'id' | 'week' | 'resolved'>,
): void {
  if (world.events.some((item) => !item.resolved)) return;
  world.events.push({ ...event, id: allocateId(world, 'event'), week: world.calendar.week, resolved: false });
  upsertMemory(world, 'Pacing · Proactive event', [world.playerCharacterId], event.title, 30, false);
}

export type LifeStage = 'early-childhood' | 'childhood' | 'teen' | 'young-adult' | 'adult' | 'established' | 'elder';

export function lifeStage(world: WorldState): LifeStage {
  const age = ageAt(world, actorOf(world));
  if (age < 6) return 'early-childhood';
  if (age < 13) return 'childhood';
  if (age < 18) return 'teen';
  if (age < 30) return 'young-adult';
  if (age < 50) return 'adult';
  if (age < 65) return 'established';
  return 'elder';
}

export function getNarrativeArcs(world: WorldState): MemoryRecord[] {
  return Object.values(world.memories)
    .filter((memory) => memory.category.startsWith('Arc · Narrative ·') && memory.unresolved)
    .sort((left, right) => right.importance - left.importance || right.week - left.week);
}

export function getRecentLifeTexture(world: WorldState, limit = 3): MemoryRecord[] {
  return Object.values(world.memories)
    .filter((memory) => memory.category.startsWith('Moment ·') && world.calendar.week - memory.week <= 52)
    .sort((left, right) => right.week - left.week)
    .slice(0, limit);
}

type MomentCandidate = {
  key: string;
  domain: Domain;
  title: string;
  detail: string;
  subjectIds?: string[];
};

function ordinaryMomentCandidates(world: WorldState): MomentCandidate[] {
  const actor = actorOf(world);
  const stage = lifeStage(world);
  const career = Object.values(world.careers).find((item) => item.characterId === actor.id && item.active);
  const education = Object.values(world.education).find((item) => item.characterId === actor.id && ['school', 'higher', 'trade'].includes(item.status));
  const partner = actor.partnerId ? world.characters[actor.partnerId] : undefined;
  const children = actor.childIds.map((id) => world.characters[id]).filter((person): person is Character => Boolean(person?.isAlive));
  const ownedBusinesses = Object.values(world.businesses).filter((business) => business.active && (business.ownerId ?? business.founderId) === actor.id);
  const ownedProperties = Object.values(world.properties).filter((property) => property.ownerId === actor.id);
  const politics = world.politics[actor.id];
  const candidates: MomentCandidate[] = [];

  if (stage === 'early-childhood') {
    candidates.push(
      { key: 'child-small-routine', domain: 'family', title: 'A small routine becomes familiar', detail: 'The adults, places, and repeated little rituals around you are quietly becoming the definition of normal.' },
      { key: 'child-curiosity', domain: 'life', title: 'Curiosity wins the afternoon', detail: 'A question turns into another question. Childhood is doing some of its work before any résumé exists.' },
    );
  } else if (stage === 'childhood') {
    candidates.push(
      { key: 'school-belonging', domain: 'education', title: 'School starts becoming a social world', detail: 'The classroom matters, but so do the people you sit near, the things you become known for, and the habits that are beginning to stick.' },
      { key: 'child-independence', domain: 'life', title: 'You get a little more room to choose', detail: 'A small piece of independence feels bigger than it looks. The choices are ordinary; the pattern they create is not.' },
    );
  } else if (stage === 'teen') {
    candidates.push(
      { key: 'teen-identity', domain: 'life', title: 'You notice who you are becoming', detail: 'Interests, friends, school pressure, and the need for independence are starting to pull in different directions.' },
      { key: 'teen-future-talk', domain: 'education', title: 'Adults keep asking about the future', detail: 'The question sounds simple. The answer increasingly determines what gets practiced, neglected, paid for, or ruled out.' },
    );
  } else if (stage === 'young-adult') {
    candidates.push(
      { key: 'young-adult-comparison', domain: 'life', title: 'Everyone seems to be moving at a different speed', detail: 'Some people are settling down, some are still figuring things out, and some look much further ahead than they really are.' },
      { key: 'young-adult-routine', domain: 'life', title: 'Your life is starting to have a shape', detail: 'Work, money, people, sleep, and whatever you keep making time for are becoming less temporary than they used to feel.' },
    );
  } else if (stage === 'adult') {
    candidates.push(
      { key: 'adult-calendar', domain: 'life', title: 'The calendar starts telling the truth', detail: 'What matters in theory and what actually receives hours are not always the same thing. The difference is becoming visible.' },
      { key: 'adult-compounding', domain: 'markets', title: 'Old decisions are starting to compound', detail: 'Career choices, money habits, friendships, health, and family commitments increasingly carry momentum of their own.' },
    );
  } else if (stage === 'established') {
    candidates.push(
      { key: 'established-reputation', domain: 'reputation', title: 'People increasingly know you by your history', detail: 'You enter rooms with a record now. Old work, old relationships, old wins, and old mistakes arrive before the conversation does.' },
      { key: 'established-time', domain: 'life', title: 'Time feels more expensive than money', detail: 'There are more things you could fund than things you can personally attend to. Delegation and priorities are becoming part of identity.' },
    );
  } else {
    candidates.push(
      { key: 'elder-memory', domain: 'dynasty', title: 'The past feels closer to the present', detail: 'People and decisions from decades ago still shape the family, the money, and the stories other people tell about this life.' },
      { key: 'elder-succession', domain: 'dynasty', title: 'Continuity becomes a practical question', detail: 'What survives you is increasingly determined by people, preparation, ownership, and relationships rather than by intention alone.' },
    );
  }

  if (education) {
    const detail = education.recordedGrade >= 82
      ? 'The work is going well enough that teachers and peers increasingly expect you to be one of the capable people in the room.'
      : education.recordedGrade < 55
        ? 'A few weak weeks are turning school from background noise into something you can feel following you home.'
        : 'Nothing dramatic happened. A normal stretch of classes still nudged skill, confidence, and the people who know your name.';
    candidates.push({ key: 'education-normal-week', domain: 'education', title: 'A normal school week still leaves a mark', detail, subjectIds: [education.id] });
  }

  if (career) {
    if (career.satisfaction < 42 || actor.stress > 70) candidates.push({ key: 'career-sunday-night', domain: 'career', title: 'Work follows you home', detail: `${career.title} is taking up more emotional space than the hours on paper suggest. Performance and satisfaction are starting to become separate questions.`, subjectIds: [career.id] });
    else if (career.performance >= 76) candidates.push({ key: 'career-reliable', domain: 'career', title: 'People start treating you like the reliable one', detail: `At work, strong performance is quietly changing what people bring to you and what they assume you can handle.`, subjectIds: [career.id] });
    else candidates.push({ key: 'career-routine', domain: 'career', title: 'Another ordinary week at work', detail: `Most careers are built in stretches like this: nothing cinematic, just competence, politics, fatigue, and accumulated trust.`, subjectIds: [career.id] });
  }

  if (partner?.isAlive) {
    const relationship = relationshipWith(world, partner.id);
    if (relationship && relationship.resentment < 20 && relationship.affection > 65) candidates.push({ key: 'partner-normal-evening', domain: 'relationship', title: 'A normal evening feels unusually good', detail: `Nothing major happens with ${partner.firstName}. That is partly the point. Stability is becoming part of the relationship history too.`, subjectIds: [partner.id] });
  }

  if (children.length > 0) {
    const child = children[Math.floor(random(world) * children.length) % children.length];
    candidates.push({ key: `child-growing-${Math.min(5, Math.floor(ageAt(world, child) / 4))}`, domain: 'family', title: `${child.firstName} feels a little older`, detail: `${child.firstName}'s life is moving whether or not your schedule notices. Their interests, competence, and view of the family are becoming more their own.`, subjectIds: [child.id] });
  }

  if (ownedBusinesses.length > 0) {
    const business = ownedBusinesses.sort((a, b) => b.valuationCents - a.valuationCents)[0];
    const margin = business.revenueWeeklyCents <= 0 ? -1 : (business.revenueWeeklyCents - business.costWeeklyCents) / business.revenueWeeklyCents;
    candidates.push({
      key: margin < 0 ? 'business-burn' : business.delegated ? 'business-without-you' : 'business-operator-week',
      domain: 'business',
      title: margin < 0 ? `${business.name} is making the week feel expensive` : business.delegated ? `${business.name} had a week without needing you` : `${business.name} keeps turning decisions into a job`,
      detail: margin < 0 ? 'The company is not collapsing today, but recurring losses make every new idea compete with runway.' : business.delegated ? 'Professional management handled routine execution. Ownership is starting to feel different from employment.' : 'The business is still closely tied to your own attention, which means growth keeps competing with the rest of your life.',
      subjectIds: [business.id],
    });
  }

  if (ownedProperties.length >= 2) candidates.push({ key: 'property-portfolio-routine', domain: 'property', title: 'The properties mostly behave like a portfolio now', detail: 'One building has a repair, another has rent coming in, another quietly changes value. The aggregate matters more than any single quiet week.', subjectIds: ownedProperties.slice(0, 3).map((item) => item.id) });
  if (politics?.campaign) candidates.push({ key: 'campaign-small-room', domain: 'politics', title: 'Campaigning is mostly smaller rooms than television suggests', detail: 'A lot of political momentum is repetition: listening, remembering names, asking for help, and showing up again.' });
  if (politics?.office) candidates.push({ key: 'governing-inbox', domain: 'politics', title: 'Governing has an endless inbox', detail: 'The public sees decisions. You mostly see tradeoffs, staff work, implementation problems, and the next thing already waiting.' });
  if (actor.health < 48) candidates.push({ key: 'health-body-warning', domain: 'health', title: 'Your body keeps asking for a vote', detail: 'Low health is making ordinary weeks feel less ordinary. Recovery is becoming a constraint on every other ambition.' });

  return candidates;
}

function processOrdinaryLife(before: WorldState, world: WorldState): void {
  if (crossed(before, world, 13) <= 0) return;
  const actor = actorOf(world);
  const available = ordinaryMomentCandidates(world).filter((candidate) => !recentMemory(world, `Moment · ${candidate.key}`, 52));
  if (available.length === 0) return;
  const selected = available[Math.floor(random(world) * available.length) % available.length];
  const participantIds = [actor.id, ...(selected.subjectIds ?? [])];
  const id = allocateId(world, 'memory');
  world.memories[id] = { id, participantIds, category: `Moment · ${selected.key}`, week: world.calendar.week, valence: 0.12, importance: 34, permanent: false, unresolved: false, visibility: 'private', narrative: selected.detail };
  recordHistory(world, selected.domain, selected.title, selected.detail, { subjectIds: participantIds, importance: 1 });
}

function resolveArc(world: WorldState, category: string, participantIds: string[], closingNarrative?: string): void {
  const memory = Object.values(world.memories).find((item) => item.category === category && participantIds.every((id) => item.participantIds.includes(id)));
  if (!memory?.unresolved) return;
  memory.unresolved = false;
  memory.week = world.calendar.week;
  if (closingNarrative) memory.narrative = closingNarrative;
}

function processEconomicWeather(before: WorldState, world: WorldState): void {
  if (crossed(before, world, 13) <= 0 && before.economy.regime === world.economy.regime) return;
  const actor = actorOf(world);
  const career = Object.values(world.careers).some((item) => item.characterId === actor.id && item.active);
  const businesses = Object.values(world.businesses).filter((item) => item.active && (item.ownerId ?? item.founderId) === actor.id).length;
  const properties = Object.values(world.properties).filter((item) => item.ownerId === actor.id).length;
  const holdings = Object.values(world.holdings).filter((item) => item.ownerId === actor.id).length;
  const exposed = Number(career) + businesses + properties + Math.min(2, holdings);
  if (exposed === 0) return;
  const category = 'Arc · Narrative · Economic weather';
  if (world.economy.regime === 'recession' || world.economy.regime === 'slow') {
    const narrative = `The ${world.economy.regime} economy is no longer just a headline. Your ${career ? 'career' : 'income'}, ${businesses} business${businesses === 1 ? '' : 'es'}, ${properties} propert${properties === 1 ? 'y' : 'ies'}, and ${holdings} market holding${holdings === 1 ? '' : 's'} give the same economy several different ways to reach you.`;
    upsertMemory(world, category, [actor.id], narrative, world.economy.regime === 'recession' ? 74 : 58, true, -0.25);
    if (before.economy.regime !== world.economy.regime) {
      actor.stress = clamp(actor.stress + Math.min(4, exposed * 0.6));
      recordHistory(world, 'markets', 'The economy changed the weather around your life', narrative, { subjectIds: [actor.id], importance: world.economy.regime === 'recession' ? 3 : 2 });
    }
  } else {
    const existing = Object.values(world.memories).find((item) => item.category === category && item.unresolved);
    if (existing) {
      resolveArc(world, category, [actor.id], `The economy has moved into ${world.economy.regime}. The pressure did not vanish everywhere at once, but the broad environment stopped getting worse.`);
      recordHistory(world, 'markets', 'The economic pressure began to ease', `The economy moved into ${world.economy.regime}. Businesses, jobs, property, and markets can now recover at different speeds.`, { subjectIds: [actor.id], importance: 2 });
    }
  }
}

function processSuccessOverhead(before: WorldState, world: WorldState): void {
  if (crossed(before, world, 13) <= 0) return;
  const actor = actorOf(world);
  const time = getDeepTimeBudget(world);
  const ownedBusinesses = Object.values(world.businesses).filter((item) => item.active && (item.ownerId ?? item.founderId) === actor.id);
  const ownedProperties = Object.values(world.properties).filter((item) => item.ownerId === actor.id);
  const holdings = Object.values(world.holdings).filter((item) => item.ownerId === actor.id);
  const organizationsLed = Object.values(world.organizations).filter((item) => item.leaderId === actor.id).length;
  const wealth = netWorthCents(world);
  const wealthLoad = wealth >= 100_000_000_000 ? 24 : wealth >= 10_000_000_000 ? 16 : wealth >= 1_000_000_000 ? 10 : wealth >= 100_000_000 ? 5 : 0;
  const delegatedBusinesses = ownedBusinesses.filter((item) => item.delegated).length;
  const managedProperties = ownedProperties.filter((item) => item.managed).length;
  const advisorRelief = Object.values(world.advisors ?? {}).filter((item) => item.active).length * 3;
  const complexity = ownedBusinesses.length * 10 + ownedProperties.length * 3 + Math.min(10, holdings.length) + organizationsLed * 7 + actor.childIds.length * 2 + wealthLoad - delegatedBusinesses * 5 - managedProperties * 1.5 - advisorRelief;
  const category = 'Arc · Narrative · Success has overhead';
  const strained = complexity >= 35 && (time.status === 'overloaded' || time.status === 'unsustainable' || actor.stress >= 68);
  if (strained) {
    const narrative = `Success has created its own administration. The life currently carries roughly ${Math.round(complexity)} points of ownership, wealth, family, and organizational complexity while your week is ${time.status}. Delegation reduces the load; ownership does not make the consequences disappear.`;
    upsertMemory(world, category, [actor.id], narrative, complexity >= 60 ? 78 : 62, true, -0.15);
    actor.stress = clamp(actor.stress + Math.min(1.4, complexity / 80));
  } else if (complexity < 28 || time.status === 'open') {
    resolveArc(world, category, [actor.id], 'The machinery around your life is currently under control. Delegation, fewer obligations, or additional free time brought complexity back within a sustainable range.');
  }
}

function processLegalSpillover(before: WorldState, world: WorldState): void {
  if (crossed(before, world, 13) <= 0) return;
  const actor = actorOf(world);
  const activeCases = Object.values(world.legalCases).filter((item) => item.characterId === actor.id && item.stage !== 'resolved');
  const category = 'Arc · Narrative · Reputation under legal pressure';
  if (activeCases.length === 0) {
    resolveArc(world, category, [actor.id], 'The active legal cloud has cleared. Reputation may recover gradually, but there is no current case pulling on it each quarter.');
    return;
  }
  const worstRisk = Math.max(...activeCases.map((item) => item.risk));
  actor.reputation.public = clamp(actor.reputation.public - 0.5 - worstRisk / 220);
  actor.reputation.professional = clamp(actor.reputation.professional - 0.35 - worstRisk / 300);
  actor.reputation.business = clamp(actor.reputation.business - 0.25 - worstRisk / 360);
  const career = Object.values(world.careers).find((item) => item.characterId === actor.id && item.active);
  if (career) career.organizationStanding = clamp((career.organizationStanding ?? 50) - 0.3 - worstRisk / 350);
  upsertMemory(world, category, [actor.id], `${activeCases.length} active legal matter${activeCases.length === 1 ? '' : 's'} are creating second-order consequences. The worst current risk is about ${Math.round(worstRisk)}/100, and public, professional, business, and internal work standing can erode even before a final legal outcome.`, worstRisk >= 70 ? 82 : 68, true, -0.5);
}

function processAthleticSpillover(before: WorldState, world: WorldState): void {
  if (crossed(before, world, 13) <= 0) return;
  const actor = actorOf(world);
  const career = Object.values(world.careers).find((item) => item.characterId === actor.id && item.active && /sport|athlet|football|basketball|baseball|soccer|tennis|hockey|player/i.test(`${item.sector} ${item.title}`));
  const category = 'Arc · Narrative · Body versus career';
  if (!career || competency(world, actor.id, 'athletics') < 55) {
    resolveArc(world, category, [actor.id], 'Athletics is no longer exerting enough pressure on the rest of the life to remain an active story.');
    return;
  }
  if (actor.health < 58) {
    career.performance = clamp(career.performance - Math.max(0.5, (60 - actor.health) / 14));
    career.satisfaction = clamp(career.satisfaction - 0.8);
    upsertMemory(world, category, [actor.id, career.id], `Your athletic career is colliding with health. Health is ${Math.round(actor.health)}/100, so recovery is now affecting performance, satisfaction, and how much of the future can be borrowed for the next competition.`, 72, true, -0.35);
  } else if (actor.health >= 72) {
    resolveArc(world, category, [actor.id], 'Health recovered enough that the body is no longer the central threat to the athletic career.');
  }
}

function processEducationCareerBridge(before: WorldState, world: WorldState): void {
  if (crossed(before, world, 52) <= 0) return;
  const actor = actorOf(world);
  const career = Object.values(world.careers).find((item) => item.characterId === actor.id && item.active && item.weeksInRole <= 156);
  if (!career) return;
  const education = Object.values(world.education)
    .filter((item) => item.characterId === actor.id && item.status === 'completed' && item.network >= 60)
    .sort((a, b) => b.network - a.network)[0];
  if (!education || recentMemory(world, `Callback · Education network · ${career.id}`, 520)) return;
  const chance = clamp((education.network - 50) / 60 + (education.prestige - 50) / 140, 0.12, 0.65);
  if (random(world) > chance) return;
  career.organizationStanding = clamp((career.organizationStanding ?? 50) + 3 + education.network / 40);
  career.promotionProgress = clamp((career.promotionProgress ?? 0) + 4);
  actor.reputation.professional = clamp(actor.reputation.professional + 1.5);
  const id = allocateId(world, 'memory');
  world.memories[id] = { id, participantIds: [actor.id, career.id, education.id], category: `Callback · Education network · ${career.id}`, week: world.calendar.week, valence: 0.55, importance: 64, permanent: true, unresolved: false, visibility: 'private', narrative: 'A relationship or reputation built through education resurfaced as real professional leverage instead of disappearing at graduation.' };
  recordHistory(world, 'career', 'An old school connection opened a door', 'The network attached to your education translated into a real introduction, better internal standing, and more promotion momentum. Credentials mattered, but the people around the credential mattered too.', { subjectIds: [actor.id, career.id, education.id], importance: 3 });
}

function callbackDomain(memory: MemoryRecord): Domain {
  const category = memory.category.toLowerCase();
  if (category.includes('relationship') || category.includes('family') || category.includes('partner')) return 'relationship';
  if (category.includes('business')) return 'business';
  if (category.includes('career')) return 'career';
  if (category.includes('education') || category.includes('school')) return 'education';
  if (category.includes('invest') || category.includes('wealth') || category.includes('money')) return 'markets';
  if (category.includes('politic')) return 'politics';
  return 'life';
}

function processLongCallbacks(before: WorldState, world: WorldState): void {
  if (crossed(before, world, 52) <= 0) return;
  const actor = actorOf(world);
  const eligible = Object.values(world.memories)
    .filter((memory) => memory.week <= world.calendar.week - 104
      && (memory.permanent || memory.importance >= 72)
      && !memory.category.startsWith('Callback ·')
      && !memory.category.startsWith('Moment ·')
      && !memory.category.startsWith('Pacing ·')
      && !Object.values(world.memories).some((other) => other.category === `Callback · ${memory.id}`))
    .sort((a, b) => b.importance - a.importance || a.week - b.week);
  if (eligible.length === 0 || random(world) > 0.58) return;
  const source = eligible[Math.floor(random(world) * Math.min(6, eligible.length))];
  const others = source.participantIds.filter((id) => id !== actor.id).map((id) => world.characters[id]).filter((person): person is Character => Boolean(person?.isAlive));
  for (const person of others) {
    const relationship = relationshipWith(world, person.id);
    if (!relationship) continue;
    const positive = source.valence >= 0;
    relationship.trust = clamp(relationship.trust + (positive ? 1.5 : -0.7));
    relationship.respect = clamp(relationship.respect + (positive ? 1 : -0.4));
    relationship.resentment = clamp(relationship.resentment + (positive ? -0.5 : 0.7));
  }
  const participantNames = others.slice(0, 2).map((person) => person.firstName).join(' and ');
  const detail = participantNames
    ? `${participantNames} is still connected to something that happened years ago: ${source.narrative}`
    : `Something from years ago is still shaping the present: ${source.narrative}`;
  const id = allocateId(world, 'memory');
  world.memories[id] = { id, participantIds: [...source.participantIds], category: `Callback · ${source.id}`, week: world.calendar.week, valence: source.valence, importance: Math.min(84, source.importance), permanent: true, unresolved: false, visibility: source.visibility, narrative: detail };
  recordHistory(world, callbackDomain(source), 'An old decision came back into the present', detail, { subjectIds: source.participantIds, importance: source.importance >= 85 ? 4 : 3 });
}

function pickNeglectedFamily(world: WorldState): { person: Character; relationship: Relationship } | undefined {
  const actor = actorOf(world);
  return Object.values(world.relationships)
    .filter((relationship) => relationship.characterIds.includes(actor.id) && ['parent', 'child', 'sibling', 'relative'].includes(relationship.kind))
    .map((relationship) => ({ relationship, person: world.characters[relationship.characterIds.find((id) => id !== actor.id)!] }))
    .filter((item): item is { person: Character; relationship: Relationship } => Boolean(item.person?.isAlive))
    .filter(({ relationship }) => world.calendar.week - relationship.lastInteractionWeek >= 39)
    .sort((left, right) => left.relationship.lastInteractionWeek - right.relationship.lastInteractionWeek)[0];
}

function pickFriend(world: WorldState): { person: Character; relationship: Relationship } | undefined {
  const actor = actorOf(world);
  return Object.values(world.relationships)
    .filter((relationship) => relationship.characterIds.includes(actor.id) && ['friend', 'professional'].includes(relationship.kind) && relationship.trust >= 52)
    .map((relationship) => ({ relationship, person: world.characters[relationship.characterIds.find((id) => id !== actor.id)!] }))
    .filter((item): item is { person: Character; relationship: Relationship } => Boolean(item.person?.isAlive))
    .sort((left, right) => right.relationship.trust - left.relationship.trust)[0];
}

function processNpcInitiative(before: WorldState, world: WorldState): void {
  if (crossed(before, world, 26) <= 0) return;
  if (world.events.some((event) => !event.resolved)) return;
  const pacing = Object.values(world.memories).find((memory) => memory.category === 'Pacing · Proactive event');
  if (pacing && world.calendar.week - pacing.week < 20) return;
  if (random(world) > 0.62) return;

  const actor = actorOf(world);
  const time = getDeepTimeBudget(world);
  const partner = actor.partnerId ? world.characters[actor.partnerId] : undefined;
  const partnerRelationship = partner?.isAlive ? relationshipWith(world, partner.id) : undefined;
  const career = Object.values(world.careers).find((item) => item.characterId === actor.id && item.active);
  const family = pickNeglectedFamily(world);
  const friend = pickFriend(world);
  const delegatedBusiness = Object.values(world.businesses)
    .filter((business) => business.active && business.delegated && (business.ownerId ?? business.founderId) === actor.id && (business.managerQuality ?? 0) >= 45)
    .sort((a, b) => b.valuationCents - a.valuationCents)[0];
  const completedEducation = Object.values(world.education).find((item) => item.characterId === actor.id && item.status === 'completed' && item.mentorId && world.characters[item.mentorId]?.isAlive);
  const adultChild = actor.childIds.map((id) => world.characters[id]).find((person) => person?.isAlive && ageAt(world, person) >= 18 && ageAt(world, person) <= 30);

  if (partner?.isAlive && partnerRelationship && (time.status === 'overloaded' || time.status === 'unsustainable') && (partnerRelationship.resentment >= 15 || world.calendar.week - partnerRelationship.lastInteractionWeek >= 26)) {
    addStoryEvent(world, {
      templateId: 'story.partner-slow-down', domain: 'relationship', severity: 'S3',
      title: `${partner.firstName} wants some of you back`,
      narrative: `Your week is ${time.status}, and ${partner.firstName} has started feeling the difference between being loved and actually getting time. This is not a breakup ultimatum. It is the earlier conversation that determines whether one arrives later.`,
      participantIds: [actor.id, partner.id], otherActionFamilies: ['relationship'],
      choices: [
        { id: 'protect-time', label: 'Protect time together', detail: 'Give the relationship some real room, even if something else loses a little momentum.', tone: 'positive' },
        { id: 'ask-patience', label: 'Ask for patience', detail: 'Acknowledge the problem without changing the schedule much yet.' },
        { id: 'dismiss', label: 'Keep pushing', detail: 'Protect the current ambitions and accept that resentment may grow.', tone: 'danger' },
      ],
    });
    return;
  }

  if (family) {
    addStoryEvent(world, {
      templateId: 'story.family-reach-out', domain: 'family', severity: 'S2',
      title: `${family.person.firstName} asks when they are going to see you`,
      narrative: `Nothing is technically wrong. That is why this matters now. It has been ${Math.floor((world.calendar.week - family.relationship.lastInteractionWeek) / 4)} months since the relationship had real attention.`,
      participantIds: [actor.id, family.person.id], otherActionFamilies: ['family', 'relationship'],
      choices: [
        { id: 'show-up', label: 'Make actual time', detail: 'Spend the attention now instead of promising it abstractly.', tone: 'positive' },
        { id: 'call', label: 'Have a real call', detail: 'Reconnect without rearranging the whole week.' },
        { id: 'later', label: 'Say you will catch up later', detail: 'Keep the schedule intact and let the relationship carry the delay.' },
      ],
    });
    return;
  }

  if (career && career.weeksInRole >= 26 && career.performance >= 68 && (career.organizationStanding ?? 50) >= 52) {
    addStoryEvent(world, {
      templateId: 'story.career-stretch', domain: 'career', severity: 'S2',
      title: 'Your manager puts something harder on your desk',
      narrative: `Strong enough work has created a new kind of problem: people believe you can carry more. The assignment could accelerate promotion momentum, or simply become extra labor if you do not manage the scope.`,
      participantIds: [actor.id, career.id, ...(career.managerId ? [career.managerId] : [])], otherActionFamilies: ['career'],
      choices: [
        { id: 'take-it', label: 'Take the stretch assignment', detail: 'Trade stress and time for visibility, performance, and promotion momentum.', tone: 'positive' },
        { id: 'negotiate-scope', label: 'Negotiate the scope', detail: 'Use communication and negotiation skill to seek upside without accepting every burden.' },
        { id: 'decline', label: 'Decline it', detail: 'Protect the current life at the cost of some internal momentum.' },
      ],
    });
    return;
  }

  if (completedEducation?.mentorId) {
    const mentor = world.characters[completedEducation.mentorId];
    addStoryEvent(world, {
      templateId: 'story.mentor-callback', domain: 'education', severity: 'S2',
      title: `${mentor.firstName} remembers you`,
      narrative: 'A mentor from school reaches out with an introduction and a question about what you are doing now. The value of education is briefly a person rather than a credential.',
      participantIds: [actor.id, mentor.id, completedEducation.id], otherActionFamilies: ['education', 'career', 'relationship'],
      choices: [
        { id: 'take-introduction', label: 'Take the introduction', detail: 'Turn the old relationship into new professional access.', tone: 'positive' },
        { id: 'ask-advice', label: 'Ask for advice instead', detail: 'Deepen the mentor relationship without chasing the opportunity immediately.' },
        { id: 'thank-pass', label: 'Thank them and pass', detail: 'Keep the relationship warm without adding another commitment.' },
      ],
    });
    return;
  }

  if (delegatedBusiness && delegatedBusiness.cashCents > Math.max(5_000_000, delegatedBusiness.costWeeklyCents * 16)) {
    addStoryEvent(world, {
      templateId: 'story.ceo-owner-checkin', domain: 'business', severity: 'S3',
      title: `${delegatedBusiness.managerName ?? 'Your CEO'} brings you an owner-level decision`,
      narrative: `${delegatedBusiness.name} has enough runway that the question is no longer whether payroll clears. Management wants direction on how aggressively to convert excess capital into growth. Routine hiring and operations remain delegated; this is about the owner's appetite for risk.`,
      participantIds: [actor.id, delegatedBusiness.id], otherActionFamilies: ['business'],
      choices: [
        { id: 'back-growth', label: 'Back the long-term plan', detail: 'Commit meaningful company cash to capacity, quality, and demand while accepting execution risk.' },
        { id: 'protect-cash', label: 'Protect the balance sheet', detail: 'Keep more runway and let the CEO compound more slowly.' },
        { id: 'trust-ceo', label: 'Use the CEO’s judgment', detail: 'Let management choose based on its quality rating rather than making the operating call yourself.' },
      ],
    });
    return;
  }

  if (adultChild) {
    addStoryEvent(world, {
      templateId: 'story.adult-child-guidance', domain: 'family', severity: 'S2',
      title: `${adultChild.firstName} asks what you would do in their position`,
      narrative: `${adultChild.firstName} is old enough that advice can no longer be confused with control. They want guidance about work, money, and the shape of an adult life that is becoming their own.`,
      participantIds: [actor.id, adultChild.id], otherActionFamilies: ['family', 'career', 'markets'],
      choices: [
        { id: 'mentor', label: 'Walk through it with them', detail: 'Invest time and practical guidance without choosing for them.', tone: 'positive' },
        { id: 'offer-money', label: 'Offer some financial help', detail: 'Use money to create room, knowing support can also create expectations.' },
        { id: 'let-own-it', label: 'Tell them it is theirs to solve', detail: 'Protect autonomy and accept that it may feel emotionally distant.' },
      ],
    });
    return;
  }

  if (friend) {
    addStoryEvent(world, {
      templateId: 'story.friend-opportunity', domain: 'relationship', severity: 'S2',
      title: `${friend.person.firstName} has an idea and thought of you`,
      narrative: 'A trusted connection brings you something half opportunity, half relationship test. The practical value is uncertain; the fact that they called you first is not.',
      participantIds: [actor.id, friend.person.id], otherActionFamilies: ['relationship', 'career', 'business'],
      choices: [
        { id: 'hear-them-out', label: 'Hear them out properly', detail: 'Spend attention, preserve trust, and learn what they actually need.' },
        { id: 'help-network', label: 'Make an introduction', detail: 'Use your network without committing your own money or work.' },
        { id: 'pass', label: 'Pass cleanly', detail: 'Decline without pretending you might do it later.' },
      ],
    });
  }
}

function eventRelationship(world: WorldState, event: GameEvent): Relationship | undefined {
  const actor = actorOf(world);
  const otherId = event.participantIds.find((id) => id !== actor.id && world.characters[id]);
  return otherId ? relationshipWith(world, otherId) : undefined;
}

export function resolveNarrativeEvent(world: WorldState, event: GameEvent, choiceId: string, delegated = false): boolean {
  if (!event.templateId.startsWith('story.')) return false;
  const actor = actorOf(world);
  const relationship = eventRelationship(world, event);

  if (event.templateId === 'story.partner-slow-down') {
    if (choiceId === 'protect-time') {
      if (relationship) { relationship.trust = clamp(relationship.trust + 6); relationship.affection = clamp(relationship.affection + 6); relationship.resentment = clamp(relationship.resentment - 8); relationship.lastInteractionWeek = world.calendar.week; }
      actor.stress = clamp(actor.stress - 4);
      addDecisionMemory(world, event, choiceId, 'You deliberately made room for the partnership when ambition was crowding it out.', 0.7);
    } else if (choiceId === 'ask-patience') {
      if (relationship) { relationship.trust = clamp(relationship.trust + 1); relationship.resentment = clamp(relationship.resentment + 2); relationship.lastInteractionWeek = world.calendar.week; }
      addDecisionMemory(world, event, choiceId, 'You acknowledged the pressure but mostly kept the existing schedule.', -0.05);
    } else {
      if (relationship) { relationship.trust = clamp(relationship.trust - 5); relationship.affection = clamp(relationship.affection - 4); relationship.resentment = clamp(relationship.resentment + 9); relationship.lastInteractionWeek = world.calendar.week; }
      addDecisionMemory(world, event, choiceId, 'You chose the current ambitions over the relationship warning.', -0.75);
    }
    return true;
  }

  if (event.templateId === 'story.family-reach-out') {
    if (relationship) {
      relationship.lastInteractionWeek = world.calendar.week;
      if (choiceId === 'show-up') { relationship.trust = clamp(relationship.trust + 7); relationship.affection = clamp(relationship.affection + 8); relationship.resentment = clamp(relationship.resentment - 5); actor.stress = clamp(actor.stress + 1); }
      else if (choiceId === 'call') { relationship.trust = clamp(relationship.trust + 3); relationship.affection = clamp(relationship.affection + 4); relationship.resentment = clamp(relationship.resentment - 2); }
      else { relationship.trust = clamp(relationship.trust - 2); relationship.resentment = clamp(relationship.resentment + 3); }
    }
    addDecisionMemory(world, event, choiceId, choiceId === 'show-up' ? 'You showed up before distance turned into a crisis.' : choiceId === 'call' ? 'You made some room for the relationship without rearranging the whole life.' : 'You postponed the relationship again.', choiceId === 'later' ? -0.35 : 0.45);
    return true;
  }

  if (event.templateId === 'story.career-stretch') {
    const career = event.participantIds.map((id) => world.careers[id]).find(Boolean) ?? Object.values(world.careers).find((item) => item.characterId === actor.id && item.active);
    if (!career) return true;
    if (choiceId === 'take-it') {
      career.performance = clamp(career.performance + 4);
      career.promotionProgress = clamp((career.promotionProgress ?? 0) + 9);
      career.organizationStanding = clamp((career.organizationStanding ?? 50) + 4);
      actor.stress = clamp(actor.stress + 5);
      addDecisionMemory(world, event, choiceId, 'You accepted additional scope and converted time into visibility and promotion momentum.', 0.45);
    } else if (choiceId === 'negotiate-scope') {
      const skill = competency(world, actor.id, 'negotiation') * 0.55 + competency(world, actor.id, 'communication') * 0.45;
      const success = random(world) * 100 < skill;
      career.performance = clamp(career.performance + (success ? 3 : 1));
      career.promotionProgress = clamp((career.promotionProgress ?? 0) + (success ? 8 : 3));
      career.organizationStanding = clamp((career.organizationStanding ?? 50) + (success ? 5 : -1));
      actor.stress = clamp(actor.stress + (success ? 2 : 4));
      addDecisionMemory(world, event, choiceId, success ? 'You negotiated a stretch role without accepting every piece of the burden.' : 'You tried to shape the assignment; the organization mostly heard hesitation.', success ? 0.65 : 0.05);
    } else {
      career.satisfaction = clamp(career.satisfaction + 2);
      career.promotionProgress = clamp((career.promotionProgress ?? 0) - 3);
      career.organizationStanding = clamp((career.organizationStanding ?? 50) - 1);
      actor.stress = clamp(actor.stress - 2);
      addDecisionMemory(world, event, choiceId, 'You protected the current life instead of maximizing career acceleration.', 0.05);
    }
    return true;
  }

  if (event.templateId === 'story.mentor-callback') {
    const mentorId = event.participantIds.find((id) => id !== actor.id && world.characters[id]);
    const mentorRelationship = mentorId ? relationshipWith(world, mentorId) : undefined;
    if (choiceId === 'take-introduction') {
      actor.reputation.professional = clamp(actor.reputation.professional + 4);
      const career = Object.values(world.careers).find((item) => item.characterId === actor.id && item.active);
      if (career) { career.organizationStanding = clamp((career.organizationStanding ?? 50) + 4); career.promotionProgress = clamp((career.promotionProgress ?? 0) + 5); }
      if (mentorRelationship) { mentorRelationship.trust = clamp(mentorRelationship.trust + 3); mentorRelationship.respect = clamp(mentorRelationship.respect + 4); mentorRelationship.lastInteractionWeek = world.calendar.week; }
      addDecisionMemory(world, event, choiceId, 'You let an old educational relationship become new professional access.', 0.75);
    } else if (choiceId === 'ask-advice') {
      actor.knowledge = clamp(actor.knowledge + 2);
      if (mentorRelationship) { mentorRelationship.trust = clamp(mentorRelationship.trust + 5); mentorRelationship.respect = clamp(mentorRelationship.respect + 3); mentorRelationship.lastInteractionWeek = world.calendar.week; }
      addDecisionMemory(world, event, choiceId, 'You chose the relationship and the advice over the immediate opportunity.', 0.55);
    } else {
      if (mentorRelationship) { mentorRelationship.trust = clamp(mentorRelationship.trust + 1); mentorRelationship.lastInteractionWeek = world.calendar.week; }
      addDecisionMemory(world, event, choiceId, 'You kept the old connection warm without adding another commitment.', 0.15);
    }
    return true;
  }

  if (event.templateId === 'story.ceo-owner-checkin') {
    const business = event.participantIds.map((id) => world.businesses[id]).find(Boolean);
    if (!business) return true;
    if (choiceId === 'back-growth') {
      const spend = Math.min(Math.max(1_000_000, business.costWeeklyCents * 6), Math.max(0, business.cashCents - business.costWeeklyCents * 10));
      business.cashCents = clampCents(business.cashCents - spend);
      business.capacity = Math.round(business.capacity * 1.08 + Math.max(2, business.employees * 0.05));
      business.quality = clamp(business.quality + 3);
      business.demand = clamp(business.demand * 1.04 + 2, 0, 10_000_000);
      addDecisionMemory(world, event, choiceId, `You authorized a ${Math.round(spend / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} long-term investment plan rather than running the company yourself.`, 0.45);
    } else if (choiceId === 'protect-cash') {
      business.growthPosture = 'conservative';
      business.quality = clamp(business.quality + 1);
      addDecisionMemory(world, event, choiceId, 'You told management to protect runway and compound more slowly.', 0.1);
    } else {
      const quality = business.managerQuality ?? 50;
      if (quality >= 80) {
        business.capacity = Math.round(business.capacity * 1.05 + 1);
        business.quality = clamp(business.quality + 2.5);
        business.reputation = clamp(business.reputation + 1.5);
      } else if (quality < 55) {
        business.cashCents = clampCents(business.cashCents - Math.min(business.cashCents, business.costWeeklyCents * 2));
        business.quality = clamp(business.quality - 1.5);
      }
      addDecisionMemory(world, event, choiceId, `You left the owner-level capital call to a CEO rated about ${Math.round(quality)}/100.`, quality >= 80 ? 0.5 : quality < 55 ? -0.35 : 0.05);
    }
    return true;
  }

  if (event.templateId === 'story.adult-child-guidance') {
    const child = event.participantIds.map((id) => world.characters[id]).find((person) => person && person.id !== actor.id);
    if (!child) return true;
    const childRelationship = relationshipWith(world, child.id);
    if (choiceId === 'mentor') {
      child.discipline = clamp(child.discipline + 2.5);
      child.knowledge = clamp(child.knowledge + 2);
      child.ambition = clamp(child.ambition + 1.5);
      actor.stress = clamp(actor.stress + 1);
      if (childRelationship) { childRelationship.trust = clamp(childRelationship.trust + 6); childRelationship.respect = clamp(childRelationship.respect + 5); childRelationship.lastInteractionWeek = world.calendar.week; }
      addDecisionMemory(world, event, choiceId, 'You gave your adult child time and judgment without taking over the decision.', 0.75);
    } else if (choiceId === 'offer-money') {
      const support = Math.min(Math.max(100_000, Math.round(Math.max(0, actor.cashCents) * 0.01)), 2_500_000);
      actor.cashCents = clampCents(actor.cashCents - support);
      child.cashCents = clampCents(child.cashCents + support);
      if (childRelationship) { childRelationship.affection = clamp(childRelationship.affection + 4); childRelationship.trust = clamp(childRelationship.trust + 2); childRelationship.lastInteractionWeek = world.calendar.week; }
      world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'family-support', amountCents: support, fromId: actor.id, toId: child.id, memo: `Support for ${child.firstName}` });
      addDecisionMemory(world, event, choiceId, 'You used money to create room for your adult child. The help is now part of the family history as well as the balance sheet.', 0.35);
    } else {
      if (childRelationship) { childRelationship.respect = clamp(childRelationship.respect + 2); childRelationship.affection = clamp(childRelationship.affection - 1); childRelationship.lastInteractionWeek = world.calendar.week; }
      addDecisionMemory(world, event, choiceId, 'You emphasized autonomy over intervention.', 0.05);
    }
    return true;
  }

  if (event.templateId === 'story.friend-opportunity') {
    if (relationship) {
      relationship.lastInteractionWeek = world.calendar.week;
      if (choiceId === 'hear-them-out') { relationship.trust = clamp(relationship.trust + 4); relationship.respect = clamp(relationship.respect + 2); actor.stress = clamp(actor.stress + 1); }
      else if (choiceId === 'help-network') { relationship.trust = clamp(relationship.trust + 5); relationship.respect = clamp(relationship.respect + 4); actor.reputation.professional = clamp(actor.reputation.professional + 1); }
      else relationship.respect = clamp(relationship.respect + 1);
    }
    addDecisionMemory(world, event, choiceId, choiceId === 'help-network' ? 'You used access rather than money to help a trusted connection.' : choiceId === 'hear-them-out' ? 'You gave the idea real attention before judging it.' : 'You declined clearly instead of creating a fake maybe.', choiceId === 'pass' ? 0.05 : 0.4);
    return true;
  }

  if (delegated) addDecisionMemory(world, event, choiceId, 'A standing policy handled this proactive story event while time advanced.', 0);
  return true;
}

export function applyNarrativeDepth(before: WorldState, source: WorldState): WorldState {
  if (source.calendar.week <= before.calendar.week) return source;
  const world = clone(source);
  processOrdinaryLife(before, world);
  processEconomicWeather(before, world);
  processSuccessOverhead(before, world);
  processLegalSpillover(before, world);
  processAthleticSpillover(before, world);
  processEducationCareerBridge(before, world);
  processLongCallbacks(before, world);
  processNpcInitiative(before, world);
  return world;
}
