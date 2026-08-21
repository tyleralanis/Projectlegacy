/// <reference types="node" />

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BALANCE_ARCHETYPES, formatBalanceQaMarkdown, runBalanceQa } from '../balanceHarness';

function writeArtifacts(report: ReturnType<typeof runBalanceQa>): void {
  mkdirSync('artifacts', { recursive: true });
  writeFileSync(join('artifacts', 'balance-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(join('artifacts', 'balance-report.md'), formatBalanceQaMarkdown(report), 'utf8');
}

describe('internal balance QA harness', () => {
  it('smoke-tests every archetype through the real simulation pipeline', { timeout: 120_000 }, () => {
    const report = runBalanceQa({ lives: BALANCE_ARCHETYPES.length * 2, endAge: 40, longLives: 0 });
    expect(report.archetypes).toEqual(BALANCE_ARCHETYPES);
    expect(report.lives).toBe(BALANCE_ARCHETYPES.length * 2);
    expect(report.summaries.every((summary) => summary.lives >= 2)).toBe(true);
    expect(report.hardFailures).toEqual([]);
  });

  const full = process.env.BALANCE_QA_FULL === '1' ? it : it.skip;
  full('runs the multi-thousand-life balance cohort and writes dashboard artifacts', { timeout: 900_000 }, () => {
    const lives = Math.max(2_000, Number(process.env.BALANCE_QA_LIVES ?? 2_000));
    const endAge = Math.max(50, Number(process.env.BALANCE_QA_END_AGE ?? 60));
    const longLives = Math.max(50, Number(process.env.BALANCE_QA_LONG_LIVES ?? 110));
    const report = runBalanceQa({ lives, endAge, longLives, longLifeEndAge: 95 });
    writeArtifacts(report);

    expect(report.lives).toBe(lives);
    expect(report.longLives).toBe(longLives);
    expect(report.summaries.every((summary) => summary.lives > 100)).toBe(true);
    expect(report.hardFailures).toEqual([]);
  });
});
