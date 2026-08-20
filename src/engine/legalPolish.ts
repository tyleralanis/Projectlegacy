import { allocateId } from './createWorld';
import { recordHistory } from './history';
import { clampCents } from './money';
import { nextRandom } from './random';
import type { LegalCase, LegalExposure, WorldState } from './types';

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

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function upsertMemory(world: WorldState, legalCase: LegalCase, narrative: string, importance: number, unresolved: boolean): void {
  const actor = world.characters[world.playerCharacterId];
  const category = `Legal · Case update · ${legalCase.id}`;
  const existing = Object.values(world.memories).find((memory) => memory.category === category && memory.participantIds.includes(actor.id));
  if (existing) {
    existing.narrative = narrative;
    existing.week = world.calendar.week;
    existing.importance = Math.max(existing.importance, importance);
    existing.unresolved = unresolved;
    return;
  }
  const id = allocateId(world, 'memory');
  world.memories[id] = { id, participantIds: [actor.id, legalCase.id], category, week: world.calendar.week, valence: unresolved ? -0.4 : 0.15, importance, permanent: !unresolved, unresolved, visibility: 'private', narrative };
}

function chargeOngoingCost(world: WorldState, legalCase: LegalCase, quarters: number): number {
  const actor = world.characters[legalCase.characterId];
  if (!actor || legalCase.counselQuality <= 35 || quarters <= 0) return 0;
  const quarterly = Math.round(75_000 + legalCase.counselQuality * 4_500);
  const total = clampCents(quarterly * quarters);
  actor.cashCents = clampCents(actor.cashCents - total);
  world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'legal-case-cost', amountCents: -total, fromId: actor.id, toId: legalCase.id, memo: `Ongoing legal work · ${legalCase.stage}` });
  return total;
}

function pressure(exposure: LegalExposure, legalCase: LegalCase): number {
  return exposure.evidence * 0.44 + exposure.severity * 0.31 + exposure.discoverability * 0.12 - legalCase.counselQuality * 0.33;
}

function resolveCase(world: WorldState, legalCase: LegalCase, exposure: LegalExposure, outcome: NonNullable<LegalCase['outcome']>): void {
  const actor = world.characters[legalCase.characterId];
  legalCase.stage = 'resolved';
  legalCase.outcome = outcome;
  exposure.resolved = true;
  if (!actor) return;

  let financialCost = 0;
  if (outcome === 'settled') financialCost = Math.round(exposure.severity * 65_000 + exposure.evidence * 18_000);
  if (outcome === 'convicted') financialCost = Math.round(exposure.severity * 130_000 + exposure.evidence * 45_000);
  if (financialCost > 0) {
    actor.cashCents = clampCents(actor.cashCents - financialCost);
    world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'legal-outcome', amountCents: -financialCost, fromId: actor.id, toId: legalCase.id, memo: `${outcome} legal outcome` });
  }

  if (outcome === 'convicted') {
    actor.reputation.public = clamp(actor.reputation.public - exposure.severity * 0.16);
    actor.reputation.business = clamp(actor.reputation.business - exposure.severity * 0.12);
    actor.reputation.political = clamp(actor.reputation.political - exposure.severity * 0.22);
    actor.reputation.professional = clamp(actor.reputation.professional - exposure.severity * 0.12);
  } else if (outcome === 'settled') {
    actor.reputation.public = clamp(actor.reputation.public - exposure.severity * 0.04);
    actor.reputation.political = clamp(actor.reputation.political - exposure.severity * 0.05);
  } else if (outcome === 'acquitted' || outcome === 'dismissed') {
    actor.reputation.public = clamp(actor.reputation.public + 1.5);
  }

  const detail = outcome === 'dismissed' ? 'The matter ended without charges surviving.'
    : outcome === 'acquitted' ? 'The case reached a favorable final result after the risk and legal process played out.'
      : outcome === 'settled' ? `The matter ended through a ${money(financialCost)} settlement rather than continuing indefinitely.`
        : `The case ended in a conviction with roughly ${money(financialCost)} of modeled financial consequences plus reputation damage.`;
  recordHistory(world, 'legal', `Legal matter ${outcome}`, detail, { important: outcome === 'convicted', subjectIds: [actor.id, legalCase.id], importance: outcome === 'convicted' ? 5 : outcome === 'settled' ? 3 : 2 });
  upsertMemory(world, legalCase, `${detail} The underlying exposure is now resolved, but the history remains part of the character's record.`, outcome === 'convicted' ? 90 : 68, false);
}

function advanceCase(world: WorldState, legalCase: LegalCase, exposure: LegalExposure, quarters: number): void {
  const cost = chargeOngoingCost(world, legalCase, quarters);
  const rawPressure = pressure(exposure, legalCase);
  const riskDrift = (rawPressure - 30) / 16 + (random(world) - 0.5) * 6;
  legalCase.risk = clamp(legalCase.risk + riskDrift * quarters);

  if (legalCase.stage === 'investigation') {
    if (legalCase.risk <= 24 && random(world) < 0.5) {
      resolveCase(world, legalCase, exposure, 'dismissed');
      return;
    }
    if (legalCase.risk >= 52 && random(world) < 0.62) legalCase.stage = 'charged';
  } else if (legalCase.stage === 'charged') {
    if (legalCase.risk <= 22 && random(world) < 0.45) {
      resolveCase(world, legalCase, exposure, 'settled');
      return;
    }
    if (legalCase.risk >= 42 && random(world) < 0.58) legalCase.stage = 'trial';
  } else if (legalCase.stage === 'trial') {
    const defense = legalCase.counselQuality * 0.42 + (100 - legalCase.risk) * 0.34 + (100 - exposure.evidence) * 0.24;
    const result = defense + random(world) * 32;
    if (result >= 72) {
      resolveCase(world, legalCase, exposure, 'acquitted');
      return;
    }
    if (legalCase.counselQuality >= 62 && result >= 52) legalCase.stage = 'appeal';
    else {
      resolveCase(world, legalCase, exposure, 'convicted');
      return;
    }
  } else if (legalCase.stage === 'appeal') {
    const appeal = legalCase.counselQuality * 0.46 + (100 - legalCase.risk) * 0.28 + (100 - exposure.evidence) * 0.16 + random(world) * 28;
    resolveCase(world, legalCase, exposure, appeal >= 62 ? 'acquitted' : 'convicted');
    return;
  }

  const narrative = `The ${legalCase.stage} is still active at roughly ${Math.round(legalCase.risk)}/100 risk. Evidence is ${Math.round(exposure.evidence)}, exposure severity is ${Math.round(exposure.severity)}, counsel quality is ${Math.round(legalCase.counselQuality)}, and ${cost > 0 ? `${money(cost)} of ongoing legal work was paid this period` : 'there is no premium ongoing counsel cost this period'}. Cases now progress instead of remaining frozen forever after the first event.`;
  upsertMemory(world, legalCase, narrative, legalCase.risk >= 70 ? 82 : 60, true);
  if (legalCase.risk >= 75) recordHistory(world, 'legal', 'Legal risk is escalating', narrative, { subjectIds: [legalCase.characterId, legalCase.id], importance: 4 });
}

export function applyLegalPolish(before: WorldState, source: WorldState): WorldState {
  const quarters = Math.max(0, Math.floor(source.calendar.week / 13) - Math.floor(before.calendar.week / 13));
  if (quarters <= 0) return source;
  const world = clone(source);
  for (const legalCase of Object.values(world.legalCases).filter((item) => item.characterId === world.playerCharacterId && item.stage !== 'resolved')) {
    const exposure = world.exposures[legalCase.exposureId];
    if (!exposure || exposure.resolved) continue;
    advanceCase(world, legalCase, exposure, quarters);
  }
  return world;
}
