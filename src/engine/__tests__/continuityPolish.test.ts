import { describe, expect, it } from 'vitest';

import { applyContinuityPolish } from '../continuityPolish';
import { createWorld } from '../createWorld';
import type { WorldState } from '../types';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function advanceCopy(world: WorldState, weeks: number): WorldState {
  const next = clone(world);
  next.calendar.week += weeks;
  return next;
}

describe('continuity polish', () => {
  it('lets autonomous NPC investors receive the same cash yield their holdings generate', () => {
    const before = createWorld({ seed: 'npc-dividend-continuity', startAgeYears: 35, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = before.characters[before.playerCharacterId];
    const npcId = 'npc-investor';
    before.characters[npcId] = { ...clone(actor), id: npcId, firstName: 'Mina', partnerId: undefined, parentIds: [], childIds: [], cashCents: 100_000 };
    before.securities.dividend = { id: 'dividend', symbol: 'DIV', name: 'Dividend Co', sector: 'Utilities', priceCents: 10_000, quality: 72, volatility: 25, dividendYieldBps: 400 };
    before.holdings.npcHolding = { id: 'npcHolding', ownerId: npcId, securityId: 'dividend', unitsMilli: 1_000_000, costBasisCents: 10_000_000 };

    const after = applyContinuityPolish(before, advanceCopy(before, 52));
    expect(after.characters[npcId].cashCents).toBe(500_000);
    expect(after.transactions.some((transaction) => transaction.kind === 'npc-investment-dividend' && transaction.toId === npcId)).toBe(true);
  });

  it('makes holding office an ongoing simulation rather than a static title between button presses', () => {
    const before = createWorld({ seed: 'governing-continuity', startAgeYears: 45, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = before.characters[before.playerCharacterId];
    actor.competencies = { politics: 100, communication: 100, negotiation: 100, leadership: 100 };
    actor.reputation.political = 85;
    before.politics[actor.id] = { characterId: actor.id, authority: 25, approval: 50, office: 'Mayor of Harborview' };
    before.economy.regime = 'boom';
    before.calendar.week = 12;
    const source = advanceCopy(before, 1);
    source.economy.regime = 'boom';

    const after = applyContinuityPolish(before, source);
    expect(after.politics[actor.id].approval).toBeGreaterThan(50);
    expect(Object.values(after.memories).some((memory) => memory.category === 'Politics · Governing pulse')).toBe(true);
  });

  it('tracks whether a preferred heir is actually becoming capable of inheriting responsibility', () => {
    const before = createWorld({ seed: 'successor-continuity', startAgeYears: 55, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = before.characters[before.playerCharacterId];
    const heirId = 'heir-continuity';
    before.characters[heirId] = {
      ...clone(actor),
      id: heirId,
      firstName: 'Avery',
      birthWeek: before.calendar.week - 30 * 52,
      partnerId: undefined,
      parentIds: [actor.id],
      childIds: [],
      discipline: 90,
      competencies: { leadership: 88, management: 90, finance: 86, negotiation: 84 },
    };
    actor.childIds.push(heirId);
    before.relationships.heir = { id: 'heir', characterIds: [actor.id, heirId], kind: 'child', trust: 88, affection: 84, respect: 90, resentment: 3, lastInteractionWeek: before.calendar.week };
    before.dynasty.activeHeirId = heirId;
    before.calendar.week = 51;

    const after = applyContinuityPolish(before, advanceCopy(before, 1));
    const memory = Object.values(after.memories).find((item) => item.category === 'Dynasty · Successor readiness');
    expect(memory?.participantIds).toContain(heirId);
    expect(memory?.narrative).toContain('succession readiness');
  });
});
