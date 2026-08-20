import { describe, expect, it } from 'vitest';

import { createWorld } from '../createWorld';
import { applyLegalPolish } from '../legalPolish';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('legal polish', () => {
  it('moves an active legal matter through time and charges ongoing premium counsel work', () => {
    const before = createWorld({ seed: 'legal-polish', startAgeYears: 38, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = before.characters[before.playerCharacterId];
    before.calendar.week = 12;
    before.exposures.exposure = { id: 'exposure', characterId: actor.id, category: 'test.exposure', severity: 58, evidence: 55, discoverability: 60, createdWeek: 0, discovered: true, resolved: false };
    before.legalCases.case = { id: 'case', characterId: actor.id, exposureId: 'exposure', stage: 'investigation', counselQuality: 82, risk: 48 };
    const cashBefore = actor.cashCents;
    const source = clone(before);
    source.calendar.week = 13;

    const after = applyLegalPolish(before, source);
    expect(after.characters[actor.id].cashCents).toBeLessThan(cashBefore);
    expect(after.transactions.some((transaction) => transaction.kind === 'legal-case-cost')).toBe(true);
    expect(Object.values(after.memories).some((memory) => memory.category === 'Legal · Case update · case')).toBe(true);
  });

  it('does not keep charging or progressing a matter that is already resolved', () => {
    const before = createWorld({ seed: 'legal-resolved-polish', startAgeYears: 38, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = before.characters[before.playerCharacterId];
    before.calendar.week = 12;
    before.exposures.exposure = { id: 'exposure', characterId: actor.id, category: 'test.exposure', severity: 58, evidence: 55, discoverability: 60, createdWeek: 0, discovered: true, resolved: true };
    before.legalCases.case = { id: 'case', characterId: actor.id, exposureId: 'exposure', stage: 'resolved', counselQuality: 82, risk: 20, outcome: 'dismissed' };
    const source = clone(before);
    source.calendar.week = 13;

    const after = applyLegalPolish(before, source);
    expect(after.transactions.some((transaction) => transaction.kind === 'legal-case-cost')).toBe(false);
    expect(after.legalCases.case.outcome).toBe('dismissed');
  });
});
