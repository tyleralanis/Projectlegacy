import { describe, expect, it } from 'vitest';

import { runStressSuite } from '../regression';

describe('seeded simulation acceptance suite', () => {
  it('completes 10,000 lives, 1,000 five-generation dynasties, and 100 200-year worlds', { timeout: 120_000 }, () => {
    const report = runStressSuite(10_000, 1_000, 100);
    expect(report.lives).toBe(10_000);
    expect(report.dynasties).toBe(1_000);
    expect(report.longWorlds).toBe(100);
    expect(report.exceptions).toBe(0);
    expect(report.nonFinite).toBe(0);
    expect(report.impossibleOwnership).toBe(0);
    expect(report.deaths).toBeGreaterThan(9_000);
    for (const rate of Object.values(report.strategyExtremeRates)) expect(rate).toBeLessThan(0.95);
  });
});
