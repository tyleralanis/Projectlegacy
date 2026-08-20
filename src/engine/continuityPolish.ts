import { competency } from './competencies';
import { allocateId } from './createWorld';
import { recordHistory } from './history';
import { clampCents } from './money';
import { nextRandom } from './random';
import type { Character, WorldState } from './types';

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

function ageAt(world: WorldState, character: Character): number {
  return Math.max(0, Math.floor((world.calendar.week - character.birthWeek) / 52));
}

function crossed(before: WorldState, after: WorldState, interval: number): number {
  return Math.max(0, Math.floor(after.calendar.week / interval) - Math.floor(before.calendar.week / interval));
}

function upsertMemory(world: WorldState, category: string, participantIds: string[], narrative: string, importance: number, unresolved = false): void {
  const existing = Object.values(world.memories).find((memory) => memory.category === category && participantIds.every((id) => memory.participantIds.includes(id)));
  if (existing) {
    existing.narrative = narrative;
    existing.importance = Math.max(existing.importance, importance);
    existing.week = world.calendar.week;
    existing.unresolved = unresolved;
    return;
  }
  const id = allocateId(world, 'memory');
  world.memories[id] = { id, participantIds, category, week: world.calendar.week, valence: 0.05, importance, permanent: false, unresolved, visibility: 'private', narrative };
}

function processNpcInvestmentIncome(before: WorldState, world: WorldState): void {
  const weeks = Math.max(0, world.calendar.week - before.calendar.week);
  if (weeks <= 0) return;
  for (const holding of Object.values(world.holdings)) {
    if (holding.ownerId === world.playerCharacterId || holding.unitsMilli <= 0) continue;
    const owner = world.characters[holding.ownerId];
    const security = world.securities[holding.securityId];
    if (!owner?.isAlive || !security || security.dividendYieldBps <= 0) continue;
    const value = Math.round(holding.unitsMilli * security.priceCents / 1000);
    const payout = Math.max(0, Math.round(value * (security.dividendYieldBps / 10_000) * (weeks / 52)));
    if (payout <= 0) continue;
    owner.cashCents = clampCents(owner.cashCents + payout);
    world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'npc-investment-dividend', amountCents: payout, fromId: security.id, toId: owner.id, memo: `${security.symbol} dividend to ${owner.firstName} ${owner.lastName}` });
  }
}

function politicalStaff(world: WorldState) {
  const actor = world.characters[world.playerCharacterId];
  return Object.values(world.relationships)
    .filter((relationship) => relationship.kind === 'professional' && relationship.characterIds.includes(actor.id))
    .map((relationship) => ({ relationship, person: world.characters[relationship.characterIds.find((id) => id !== actor.id)!] }))
    .filter(({ person }) => person?.isAlive && competency(world, person.id, 'politics') >= 65);
}

function processPoliticsContinuity(before: WorldState, world: WorldState): void {
  const quarters = crossed(before, world, 13);
  if (quarters <= 0) return;
  const actor = world.characters[world.playerCharacterId];
  const politics = world.politics[actor.id];
  if (!politics) return;
  const staff = politicalStaff(world);
  const staffQuality = staff.length > 0 ? staff.reduce((sum, item) => sum + competency(world, item.person.id, 'politics'), 0) / staff.length : 35;
  const skill = competency(world, actor.id, 'politics') * 0.34
    + competency(world, actor.id, 'communication') * 0.22
    + competency(world, actor.id, 'negotiation') * 0.2
    + competency(world, actor.id, 'leadership') * 0.14
    + staffQuality * 0.1;
  const economyEffect = world.economy.regime === 'boom' ? 1.6
    : world.economy.regime === 'growth' ? 0.9
      : world.economy.regime === 'recession' ? -2.1
        : world.economy.regime === 'slow' ? -0.8
          : 0.2;

  if (politics.campaign && politics.campaign.weeksRemaining > 0) {
    const fundingWeeks = politics.campaign.fundsCents / 45_000;
    const operations = (skill - 55) / 24 + Math.min(1.4, staff.length * 0.25) + (fundingWeeks < 4 ? -1.5 : fundingWeeks > 20 ? 0.6 : 0);
    const oppositionDrag = Math.max(0, politics.campaign.opposition - politics.campaign.support) / 55;
    const uncertainty = (random(world) - 0.5) * 2.2;
    const delta = clamp((operations + economyEffect * 0.35 - oppositionDrag + uncertainty) * quarters, -7, 7);
    politics.campaign.support = clamp(politics.campaign.support + delta);
    actor.reputation.political = clamp(actor.reputation.political + delta * 0.08);
    upsertMemory(world, 'Politics · Campaign pulse', [actor.id], `The campaign is at ${Math.round(politics.campaign.support)}/100 support with ${politics.campaign.weeksRemaining} weeks left. Political operation quality is about ${Math.round(skill)}/100, ${staff.length} serious staff are in the orbit, campaign cash covers roughly ${Math.max(0, fundingWeeks).toFixed(0)} normal spending weeks, and the ${world.economy.regime} economy is affecting the public mood.`, 52, false);
    return;
  }

  if (!politics.office) return;
  const institutionalDifficulty = Math.max(0, politics.authority - 35) / 55;
  const governingSkill = (skill - 55) / 32;
  const staffEffect = Math.min(1.2, staff.length * 0.2);
  const uncertainty = (random(world) - 0.5) * 1.8;
  const approvalDelta = clamp((governingSkill + staffEffect + economyEffect - institutionalDifficulty + uncertainty) * quarters, -6, 6);
  politics.approval = clamp(politics.approval + approvalDelta);
  actor.reputation.political = clamp(actor.reputation.political + approvalDelta * 0.12 + (skill >= 70 ? 0.2 * quarters : 0));
  const state = approvalDelta >= 2 ? 'gaining ground' : approvalDelta <= -2 ? 'losing ground' : 'holding roughly steady';
  const narrative = `${politics.office} is ${state}. Approval is ${Math.round(politics.approval)}%. Your governing operation is about ${Math.round(skill)}/100, ${staff.length} serious staff are helping, institutional difficulty rises with authority, and the ${world.economy.regime} economy is part of the environment you are being judged inside.`;
  upsertMemory(world, 'Politics · Governing pulse', [actor.id], narrative, Math.abs(approvalDelta) >= 3 ? 62 : 44, approvalDelta <= -3);
  if (Math.abs(approvalDelta) >= 4) recordHistory(world, 'politics', approvalDelta > 0 ? 'The administration gained momentum' : 'The administration lost ground', narrative, { subjectIds: [actor.id], importance: 3 });
}

function successorCandidates(world: WorldState): Character[] {
  const actor = world.characters[world.playerCharacterId];
  const relatedIds = new Set<string>();
  for (const relationship of Object.values(world.relationships)) {
    if (!relationship.characterIds.includes(actor.id) || !['child', 'sibling', 'relative', 'spouse', 'partner'].includes(relationship.kind)) continue;
    const id = relationship.characterIds.find((candidate) => candidate !== actor.id);
    if (id) relatedIds.add(id);
  }
  return [...relatedIds].map((id) => world.characters[id]).filter((person): person is Character => Boolean(person?.isAlive && ageAt(world, person) >= 16));
}

function successorReadiness(world: WorldState, person: Character): number {
  const actor = world.characters[world.playerCharacterId];
  const relationship = Object.values(world.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(person.id));
  const businessExperience = Object.values(world.careers).some((career) => career.characterId === person.id && career.active && ['Business', 'Finance', 'Operations'].some((term) => career.sector.toLowerCase().includes(term.toLowerCase()))) ? 8 : 0;
  const ownedBusiness = Object.values(world.businesses).some((business) => business.active && (business.ownerId ?? business.founderId) === person.id) ? 8 : 0;
  const age = ageAt(world, person);
  const maturity = age < 18 ? -12 : age < 25 ? -4 : age <= 65 ? 4 : 1;
  return clamp(
    competency(world, person.id, 'leadership') * 0.19
    + competency(world, person.id, 'management') * 0.19
    + competency(world, person.id, 'finance') * 0.17
    + competency(world, person.id, 'negotiation') * 0.11
    + person.discipline * 0.1
    + (relationship?.trust ?? 35) * 0.08
    + (relationship?.respect ?? 35) * 0.08
    - (relationship?.resentment ?? 0) * 0.08
    + businessExperience + ownedBusiness + maturity,
  );
}

function processDynastyReadiness(before: WorldState, world: WorldState): void {
  if (crossed(before, world, 52) <= 0) return;
  const actor = world.characters[world.playerCharacterId];
  const candidates = successorCandidates(world);
  if (candidates.length === 0) return;
  const preferred = world.dynasty.activeHeirId ? world.characters[world.dynasty.activeHeirId] : undefined;
  const target = preferred?.isAlive ? preferred : candidates.sort((left, right) => successorReadiness(world, right) - successorReadiness(world, left))[0];
  if (!target) return;
  const readiness = successorReadiness(world, target);
  const label = readiness >= 80 ? 'ready for serious responsibility' : readiness >= 65 ? 'credible but still developing' : readiness >= 48 ? 'not ready to inherit the whole machine' : 'far from ready';
  const career = Object.values(world.careers).find((item) => item.characterId === target.id && item.active);
  const narrative = `${target.firstName} is ${label} at roughly ${Math.round(readiness)}/100 succession readiness. Leadership, management, finance, negotiation, discipline, your relationship, resentment, age, and real career/business exposure all contribute. ${career ? `${target.firstName} is currently ${career.title}, so the heir is developing a life outside the inheritance too.` : 'They do not currently have an active career adding practical experience.'}`;
  upsertMemory(world, 'Dynasty · Successor readiness', [actor.id, target.id], narrative, readiness < 60 ? 70 : 54, readiness < 60);
}

export function applyContinuityPolish(before: WorldState, source: WorldState): WorldState {
  if (source.calendar.week <= before.calendar.week) return source;
  const world = clone(source);
  processNpcInvestmentIncome(before, world);
  processPoliticsContinuity(before, world);
  processDynastyReadiness(before, world);
  return world;
}
