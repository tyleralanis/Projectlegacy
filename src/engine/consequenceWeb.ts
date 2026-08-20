import { allocateId, playerAgeYears } from './createWorld';
import { recordHistory } from './history';
import { getTimeBudget } from './livingWorld';
import { netWorthCents } from './money';
import type { Character, MemoryRecord, Relationship, WorldState } from './types';

const ARC_PREFIX = 'Arc · ';

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

function memoryBetween(world: WorldState, category: string, participantIds: string[]): MemoryRecord | undefined {
  return Object.values(world.memories)
    .filter((memory) => memory.category === category && participantIds.every((id) => memory.participantIds.includes(id)))
    .sort((left, right) => right.week - left.week)[0];
}

function upsertArc(
  world: WorldState,
  category: string,
  participantIds: string[],
  narrative: string,
  importance: number,
  valence: number,
): MemoryRecord {
  const existing = memoryBetween(world, category, participantIds);
  if (existing) {
    existing.narrative = narrative;
    existing.importance = Math.max(existing.importance, importance);
    existing.valence = valence;
    existing.unresolved = true;
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
    permanent: importance >= 78,
    unresolved: true,
    visibility: 'shared',
    narrative,
  };
  world.memories[id] = memory;
  return memory;
}

function closeArc(memory: MemoryRecord | undefined, narrative: string, keepPermanent = true): void {
  if (!memory) return;
  memory.unresolved = false;
  memory.narrative = narrative;
  if (keepPermanent && memory.importance >= 70) memory.permanent = true;
}

function activeCareer(world: WorldState, characterId: string) {
  return Object.values(world.careers).find((career) => career.characterId === characterId && career.active);
}

function relationshipTemperature(relationship: Relationship): number {
  return clamp(relationship.trust * 0.34 + relationship.affection * 0.38 + relationship.respect * 0.28 - relationship.resentment * 0.52);
}

function familyIds(world: WorldState): string[] {
  const actor = world.characters[world.playerCharacterId];
  const ids = new Set<string>([...actor.parentIds, ...actor.childIds]);
  if (actor.partnerId) ids.add(actor.partnerId);
  for (const relationship of Object.values(world.relationships)) {
    if (!relationship.characterIds.includes(actor.id)) continue;
    if (!['sibling', 'relative', 'partner', 'spouse', 'parent', 'child'].includes(relationship.kind)) continue;
    const otherId = relationship.characterIds.find((id) => id !== actor.id);
    if (otherId) ids.add(otherId);
  }
  return [...ids].filter((id) => world.characters[id]?.isAlive);
}

function maintainMarriageArc(world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  const partner = actor.partnerId ? world.characters[actor.partnerId] : undefined;
  if (!partner?.isAlive) return;
  const relationship = relationshipBetween(world, actor.id, partner.id);
  if (!relationship || !['partner', 'spouse'].includes(relationship.kind)) return;
  const participants = [actor.id, partner.id];
  const category = `${ARC_PREFIX}Partnership`;
  const existing = memoryBetween(world, category, participants);
  const budget = getTimeBudget(world);
  const children = actor.childIds.filter((id) => world.characters[id]?.isAlive).length;
  const moneyPressure = actor.cashCents < 0 ? 18 : actor.cashCents < 500_000 ? 8 : 0;
  const timePressure = budget.status === 'unsustainable' ? 24 : budget.status === 'overloaded' ? 13 : 0;
  const stressPressure = Math.max(0, actor.stress - 62) * 0.45 + Math.max(0, partner.stress - 62) * 0.3;
  const neglectPressure = Math.max(0, world.calendar.week - relationship.lastInteractionWeek - 10) * 0.5;
  const parentingPressure = children * 2.5;
  const protection = relationship.trust * 0.24 + relationship.affection * 0.18 + relationship.respect * 0.12 + (actor.focuses.includes('Partner') ? 13 : 0);
  const pressure = moneyPressure + timePressure + stressPressure + neglectPressure + parentingPressure + relationship.resentment * 0.42 - protection;

  if (pressure >= 10) {
    relationship.resentment = clamp(relationship.resentment + Math.min(2.5, pressure / 28));
    relationship.affection = clamp(relationship.affection - Math.min(1.7, pressure / 40));
    const narrative = children > 0
      ? `${actor.firstName} and ${partner.firstName} are not fighting about one thing so much as the accumulated weight of work, children, money, attention, and whose exhaustion counts first. The relationship is strong enough to have history and strained enough for that history to be interpreted differently.`
      : `${actor.firstName} and ${partner.firstName} are carrying more pressure than the relationship is currently absorbing. Work, money, stress, and ordinary neglect are beginning to turn separate problems into one shared problem.`;
    const arc = upsertArc(world, category, participants, narrative, Math.min(96, 62 + pressure), -0.65);
    if (arc.week === world.calendar.week) recordHistory(world, 'relationship', 'The relationship has entered a rough season', narrative, { subjectIds: participants, importance: 4 });
  } else if (existing && relationshipTemperature(relationship) >= 62 && relationship.resentment < 28) {
    closeArc(existing, `${actor.firstName} and ${partner.firstName} came through the rough season with enough repair that it stopped defining the relationship. The arguments still happened; they just stopped being the whole story.`);
    recordHistory(world, 'relationship', 'The relationship found its footing again', `Things with ${partner.firstName} stopped feeling like one long unresolved conversation.`, { subjectIds: participants, importance: 3 });
  }

  const promise = memoryBetween(world, 'Promise · Future', participants);
  if (promise?.unresolved && world.calendar.week - promise.week >= 104) {
    const aligned = actor.focuses.includes('Partner') || relationshipTemperature(relationship) >= 68;
    if (aligned) {
      promise.unresolved = false;
      promise.narrative = `${promise.narrative} Two years later, your actual choices still broadly resembled the future you talked about, which turned the promise into evidence rather than just a nice conversation.`;
      relationship.trust = clamp(relationship.trust + 4);
    } else {
      relationship.resentment = clamp(relationship.resentment + 5);
      upsertArc(world, `${ARC_PREFIX}Broken expectation`, participants, `${partner.firstName} remembers that the two of you talked seriously about the future. The problem is not that life changed; it is that the relationship increasingly feels like those expectations changed without being renegotiated.`, 82, -0.78);
    }
  }
}

function maintainParentChildArcs(world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  for (const childId of actor.childIds) {
    const child = world.characters[childId];
    const relationship = relationshipBetween(world, actor.id, childId);
    if (!child?.isAlive || !relationship) continue;
    const age = ageAt(child, world.calendar.week);
    const participants = [actor.id, child.id];
    const neglect = world.calendar.week - relationship.lastInteractionWeek;
    const category = `${ARC_PREFIX}Parenting ${child.id}`;
    const existing = memoryBetween(world, category, participants);

    if (age < 18 && neglect >= 26) {
      relationship.resentment = clamp(relationship.resentment + Math.min(4, neglect / 30));
      relationship.trust = clamp(relationship.trust - Math.min(2.5, neglect / 45));
      upsertArc(world, category, participants, `${child.firstName} is still young enough that absence is being interpreted before they have the adult language to explain it. Other adults, friends, school, and their own coping habits are filling in the space where your attention would have gone.`, 72 + Math.min(18, neglect / 4), -0.62);
    } else if (existing && neglect < 10 && relationshipTemperature(relationship) >= 58) {
      closeArc(existing, `You and ${child.firstName} rebuilt enough ordinary contact that the period of distance stopped being the main frame around the relationship.`);
    }

    if (age >= 18 && age <= 30) {
      const independence = `${ARC_PREFIX}Adult child ${child.id}`;
      const adultArc = memoryBetween(world, independence, participants);
      const career = activeCareer(world, child.id);
      const needsMoney = child.cashCents < 0;
      const livingTogether = child.householdId === actor.householdId;
      if ((needsMoney || livingTogether) && child.ambition > 45) {
        upsertArc(world, independence, participants, `${child.firstName} is an adult now, but independence is uneven. ${needsMoney ? 'Money is part of the pressure.' : ''} ${livingTogether ? 'You are still sharing a household.' : ''} Help can become a bridge or a dependency depending on how long the arrangement lasts and whether ${child.firstName}'s own life keeps moving.`, 68 + (needsMoney ? 8 : 0), -0.2);
      } else if (adultArc && career && child.cashCents >= 200_000) {
        closeArc(adultArc, `${child.firstName}'s adult life has enough momentum now that support feels more optional than structural. The relationship is shifting from parenting toward two adults who happen to have a long history together.`);
      }
    }
  }
}

function maintainSiblingAndHeirPolitics(world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  const heirId = world.dynasty.activeHeirId;
  if (!heirId || !world.characters[heirId]?.isAlive) return;
  const potential = actor.childIds.filter((id) => id !== heirId && world.characters[id]?.isAlive && ageAt(world.characters[id], world.calendar.week) >= 16);
  if (potential.length === 0) return;
  const heir = world.characters[heirId];
  for (const otherId of potential) {
    const other = world.characters[otherId];
    const relationship = relationshipBetween(world, actor.id, otherId);
    if (!other || !relationship) continue;
    const participants = [actor.id, heirId, otherId];
    const category = `${ARC_PREFIX}Succession politics ${otherId}`;
    const discussed = memoryBetween(world, 'Family · Inheritance conversation', [actor.id, otherId]);
    const fairness = actor.empathy * 0.25 + actor.ethics * 0.25 + relationship.trust * 0.2 + relationship.respect * 0.15 + (discussed ? 15 : 0);
    if (fairness < 58) {
      relationship.resentment = clamp(relationship.resentment + 1.5);
      upsertArc(world, category, participants, `${other.firstName} knows—or strongly suspects—that ${heir.firstName} is being positioned as the preferred successor. The unanswered question is whether this feels like a practical decision, a judgment of worth, or simply another example of who gets chosen first in this family.`, 78, -0.58);
    } else {
      const arc = memoryBetween(world, category, participants);
      if (arc) closeArc(arc, `${other.firstName} may not love the succession plan, but enough explanation and trust exists that it no longer feels like a secret verdict on their place in the family.`);
    }
  }
}

function maintainFamilyBusinessArcs(world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  for (const business of Object.values(world.businesses)) {
    if (!business.active || (business.ownerId ?? business.founderId) !== actor.id) continue;
    const organization = world.organizations[business.organizationId];
    if (!organization) continue;
    const familyWorkers = organization.memberIds
      .filter((id) => id !== actor.id && familyIds(world).includes(id))
      .map((id) => ({ person: world.characters[id], career: activeCareer(world, id), relationship: relationshipBetween(world, actor.id, id) }))
      .filter((item) => item.person?.isAlive && item.career && item.relationship) as { person: Character; career: NonNullable<ReturnType<typeof activeCareer>>; relationship: Relationship }[];
    for (const { person, career, relationship } of familyWorkers) {
      const participants = [actor.id, person.id, business.id];
      const category = `${ARC_PREFIX}Family business ${person.id}`;
      const existing = memoryBetween(world, category, participants);
      const personalHeat = relationship.resentment + Math.max(0, 55 - relationship.trust);
      if (career.performance >= 74 && relationship.respect >= 60) {
        career.satisfaction = clamp(career.satisfaction + 0.8);
        relationship.respect = clamp(relationship.respect + 0.8);
        upsertArc(world, category, participants, `${person.firstName} is proving useful inside ${business.name}, which is both professionally convenient and emotionally dangerous. Every strong quarter makes it harder to separate family loyalty from a real argument that they deserve more authority.`, 74, 0.4);
      } else if (career.performance < 48 || personalHeat >= 70) {
        career.satisfaction = clamp(career.satisfaction - 1.5);
        relationship.resentment = clamp(relationship.resentment + 1.2);
        upsertArc(world, category, participants, `${person.firstName}'s role at ${business.name} is becoming hard to discuss like an ordinary employment problem. Performance, family history, loyalty, fairness to other employees, and what happens at holidays are all sitting in the same meeting now.`, 84, -0.72);
      } else if (existing && career.performance >= 58 && personalHeat < 45) {
        closeArc(existing, `${person.firstName}'s role at ${business.name} settled into something that currently works. Family and work are still entangled, just not actively combustible.`);
      }
    }
  }
}

function maintainFavorCallbacks(world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  const favors = Object.values(world.memories).filter((memory) => memory.category === 'Obligation · Favor' && memory.unresolved && memory.participantIds.includes(actor.id));
  for (const favor of favors) {
    if (world.calendar.week - favor.week < 40) continue;
    const otherId = favor.participantIds.find((id) => id !== actor.id);
    const person = otherId ? world.characters[otherId] : undefined;
    const relationship = otherId ? relationshipBetween(world, actor.id, otherId) : undefined;
    if (!person?.isAlive || !relationship) continue;
    const callback = unit(world, `favor-callback:${favor.id}`);
    if (callback > 0.24) continue;
    if (relationshipTemperature(relationship) >= 55 && person.empathy >= 45) {
      actor.stress = clamp(actor.stress - 4);
      actor.reputation.professional = clamp(actor.reputation.professional + (relationship.kind === 'professional' ? 2 : 0.5));
      relationship.trust = clamp(relationship.trust + 3);
      favor.unresolved = false;
      favor.narrative = `${favor.narrative} Much later, ${person.firstName} found a way to return the favor without being asked twice.`;
      recordHistory(world, 'relationship', `${person.firstName} remembered`, `An old favor came back around at a moment when it actually helped. Relationships can store practical value in ways a balance sheet cannot.`, { subjectIds: [actor.id, person.id], importance: 3 });
    } else {
      relationship.resentment = clamp(relationship.resentment + 2);
      favor.narrative = `${favor.narrative} Time passed without the obligation being returned, which is slowly changing how the favor is remembered.`;
      favor.importance = Math.min(90, favor.importance + 3);
    }
  }
}

function maintainWealthAndFamilyPressure(world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  const worth = netWorthCents(world);
  if (worth < 100_000_000) return;
  for (const familyId of familyIds(world)) {
    const person = world.characters[familyId];
    const relationship = relationshipBetween(world, actor.id, familyId);
    if (!person?.isAlive || !relationship || person.cashCents >= 0) continue;
    const participants = [actor.id, person.id];
    const category = `${ARC_PREFIX}Wealth and family ${person.id}`;
    const visibility = Math.min(1, Math.log10(Math.max(1, worth / 100)) / 9);
    const pressure = visibility * 35 + Math.max(0, -person.cashCents) / 1_000_000 + relationship.affection * 0.15;
    if (pressure >= 28) {
      upsertArc(world, category, participants, `${person.firstName} is struggling financially while your wealth is large enough to be impossible to treat as irrelevant. Any choice—helping, lending, saying no, structuring support, or avoiding the conversation—will mean something inside the relationship.`, 72 + Math.min(18, pressure / 3), -0.28);
    }
  }
}

function maintainInstitutionalMemory(world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  const career = activeCareer(world, actor.id);
  if (career && career.weeksInRole > 260 && career.performance >= 72) {
    const organization = world.organizations[career.employerId];
    if (organization && !organization.history.some((entry) => entry.includes(`${actor.firstName} ${actor.lastName} became a long-tenured high performer`))) {
      organization.history.push(`${actor.firstName} ${actor.lastName} became a long-tenured high performer in week ${world.calendar.week}.`);
      actor.reputation.professional = clamp(actor.reputation.professional + 2);
      recordHistory(world, 'career', 'Your name now carries history inside the institution', `${organization.name} has known you long enough that future promotions, exits, references, and reunions will not start from zero.`, { subjectIds: [actor.id, organization.id], importance: 3 });
    }
  }

  for (const business of Object.values(world.businesses)) {
    if (!business.active || (business.ownerId ?? business.founderId) !== actor.id || business.employees < 20) continue;
    const organization = world.organizations[business.organizationId];
    if (!organization) continue;
    if (business.reputation >= 72 && !organization.history.some((entry) => entry.includes('became a respected local employer'))) {
      organization.history.push(`${business.name} became a respected local employer in week ${world.calendar.week}.`);
      actor.reputation.business = clamp(actor.reputation.business + 3);
    }
    if (business.reputation < 35 && !organization.history.some((entry) => entry.includes('developed a poor employer reputation'))) {
      organization.history.push(`${business.name} developed a poor employer reputation in week ${world.calendar.week}.`);
      actor.reputation.business = clamp(actor.reputation.business - 3);
    }
  }
}

function maintainOldFriendReturns(world: WorldState): void {
  const actor = world.characters[world.playerCharacterId];
  const oldFriends = Object.values(world.relationships)
    .filter((relationship) => relationship.characterIds.includes(actor.id) && ['friend', 'acquaintance', 'professional'].includes(relationship.kind))
    .map((relationship) => ({ relationship, otherId: relationship.characterIds.find((id) => id !== actor.id)! }))
    .filter(({ relationship, otherId }) => world.characters[otherId]?.isAlive && world.calendar.week - relationship.lastInteractionWeek >= 260);
  if (oldFriends.length === 0) return;
  const selected = oldFriends.sort((left, right) => right.relationship.respect - left.relationship.respect)[0];
  const person = world.characters[selected.otherId];
  if (unit(world, `old-friend-return:${person.id}`) > 0.08) return;
  const already = Object.values(world.memories).some((memory) => memory.category === 'Relationship · Returned years later' && memory.participantIds.includes(person.id));
  if (already) return;
  selected.relationship.lastInteractionWeek = world.calendar.week;
  selected.relationship.affection = clamp(selected.relationship.affection + 2);
  upsertArc(world, 'Relationship · Returned years later', [actor.id, person.id], `${person.firstName} reappeared after years of almost no contact. The interesting part is not nostalgia; it is that both of you are different people now, with different jobs, families, resources, grudges, and reasons to reconnect.`, 76, 0.15);
  recordHistory(world, 'relationship', `${person.firstName} came back into your life`, `Five years is long enough for an old relationship to become a new one wearing familiar clothes.`, { subjectIds: [actor.id, person.id], importance: 4 });
}

export function getConsequenceArcs(world: WorldState, personId?: string): MemoryRecord[] {
  const actorId = world.playerCharacterId;
  return Object.values(world.memories)
    .filter((memory) => memory.unresolved && (memory.category.startsWith(ARC_PREFIX) || memory.category.startsWith('Promise ·') || memory.category.startsWith('Obligation ·')))
    .filter((memory) => memory.participantIds.includes(actorId))
    .filter((memory) => !personId || memory.participantIds.includes(personId))
    .sort((left, right) => right.importance - left.importance || left.week - right.week);
}

export function applyConsequenceWeb(before: WorldState, source: WorldState): WorldState {
  const weeks = Math.max(0, source.calendar.week - before.calendar.week);
  if (weeks <= 0 || source.playerCharacterId !== before.playerCharacterId) return source;
  const world = clone(source);

  maintainMarriageArc(world);
  maintainParentChildArcs(world);
  maintainSiblingAndHeirPolitics(world);
  maintainFamilyBusinessArcs(world);
  maintainFavorCallbacks(world);
  maintainWealthAndFamilyPressure(world);

  if (crossedBoundary(before.calendar.week, world.calendar.week, 13)) {
    maintainInstitutionalMemory(world);
    maintainOldFriendReturns(world);
  }

  return world;
}
