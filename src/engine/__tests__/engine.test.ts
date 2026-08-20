import { describe, expect, it } from 'vitest';

import { executeAction, validateAction } from '../actions';
import { createWorld } from '../createWorld';
import { validateWorld } from '../invariants';
import { advanceWorld, getActiveEvent, resolveEvent } from '../simulation';

function canonical(world: ReturnType<typeof createWorld>) {
  const copy = JSON.parse(JSON.stringify(world));
  copy.metadata.updatedAt = '<time>';
  copy.metadata.lastCheckpoint = '<time>';
  return copy;
}

describe('deterministic weekly simulation', () => {
  it('produces identical worlds from an identical seed', () => {
    const first = createWorld({ seed: 'same-seed', startAgeYears: 18, nowISO: '2026-08-19T00:00:00.000Z' });
    const second = createWorld({ seed: 'same-seed', startAgeYears: 18, nowISO: '2026-08-19T00:00:00.000Z' });
    const resultA = advanceWorld(first, 52, { interrupt: false, autoResolveEvents: true });
    const resultB = advanceWorld(second, 52, { interrupt: false, autoResolveEvents: true });
    expect(canonical(resultA.world)).toEqual(canonical(resultB.world));
  });

  it('keeps 1Y authoritative state in parity with 52 weekly advances', () => {
    const base = createWorld({ seed: 'parity-seed', startAgeYears: 26, nowISO: '2026-08-19T00:00:00.000Z' });
    const annual = advanceWorld(base, 52, { interrupt: false, autoResolveEvents: true }).world;
    let weekly = base;
    for (let week = 0; week < 52; week += 1) weekly = advanceWorld(weekly, 1, { interrupt: false, autoResolveEvents: true }).world;
    expect(canonical(weekly)).toEqual(canonical(annual));
  });

  it('maintains world invariants over a 100-year autonomous run', () => {
    let world = createWorld({ seed: 'century-seed', startAgeYears: 0, nowISO: '2026-08-19T00:00:00.000Z' });
    for (let year = 0; year < 100; year += 1) world = advanceWorld(world, 52, { interrupt: false, autoResolveEvents: true }).world;
    expect(validateWorld(world)).toEqual([]);
  });
});

describe('action validation and world resistance', () => {
  it('rejects unaffordable transfers instead of inventing success', () => {
    const world = createWorld({ seed: 'cash-test', startAgeYears: 18, nowISO: '2026-08-19T00:00:00.000Z' });
    const action = { verb: 'relationship.transfer_cash', targetIds: ['character-mara'], parameters: { amountCents: 999_000_000 }, destructive: false };
    const validation = validateAction(world, action);
    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain('liquid cash');
  });

  it('rejects a business launch that cannot fund the minimum starting capital', () => {
    const world = createWorld({ seed: 'business-cash-test', startAgeYears: 18, nowISO: '2026-08-19T00:00:00.000Z' });
    world.characters[world.playerCharacterId].cashCents = 50_000;
    const validation = validateAction(world, { verb: 'business.create', targetIds: [], parameters: { amountCents: 1 } });
    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain('$1,000.00');
  });

  it('requires confirmation for destructive actions and never mutates on proposal', () => {
    const world = createWorld({ seed: 'confirm-test', startAgeYears: 18, nowISO: '2026-08-19T00:00:00.000Z' });
    const proposed = executeAction(world, { verb: 'career.quit', targetIds: ['career-player'], parameters: {}, destructive: true });
    expect(proposed.validation.requiresConfirmation).toBe(true);
    expect(proposed.world).toBe(world);
    expect(world.careers['career-player'].active).toBe(true);
    const confirmed = executeAction(world, { verb: 'career.quit', targetIds: ['career-player'], parameters: {}, destructive: true }, true);
    expect(confirmed.world.careers['career-player'].active).toBe(false);
  });

  it('creates an evidence record for abstract misconduct without operational detail', () => {
    const world = createWorld({ seed: 'evidence-test', startAgeYears: 35, nowISO: '2026-08-19T00:00:00.000Z' });
    const result = executeAction(world, { verb: 'misconduct.tax_evasion_attempt', targetIds: [], parameters: { amountCents: 10_000 }, destructive: true }, true);
    expect(Object.values(result.world.exposures)).toHaveLength(1);
    expect(result.message).toContain('evidence record');
    expect(validateWorld(result.world)).toEqual([]);
  });
});

describe('death and continuity', () => {
  it('preserves the world and continues through an eligible successor', () => {
    const world = createWorld({ seed: 'succession-test', startAgeYears: 110, nowISO: '2026-08-19T00:00:00.000Z' });
    const advanced = advanceWorld(world, 1, { interrupt: true, autoResolveEvents: true }).world;
    const event = getActiveEvent(advanced);
    expect(event?.templateId).toBe('dynasty.succession');
    const choice = event!.choices[0];
    const continued = resolveEvent(advanced, event!.id, choice.id);
    expect(continued.playerCharacterId).not.toBe('character-player');
    expect(continued.dynasty.generation).toBe(2);
    expect(continued.economy.marketIndex).toBeGreaterThan(0);
  });

  it('adds a real next-generation character without resetting the world', () => {
    const world = createWorld({ seed: 'child-continuity', startAgeYears: 28, nowISO: '2026-08-19T00:00:00.000Z' });
    const actor = world.characters[world.playerCharacterId];
    const partner = world.characters['character-riley'];
    actor.partnerId = partner.id;
    partner.partnerId = actor.id;
    world.relationships['relationship-player-riley'].kind = 'spouse';
    world.events.push({ id: 'event-next-generation', templateId: 'family.next-generation', domain: 'family', severity: 'S3', week: world.calendar.week, title: 'The next generation is possible', narrative: 'A family decision.', participantIds: [actor.id, partner.id], choices: [{ id: 'welcome-child', label: 'Welcome a child', detail: 'Continue the family.' }], otherActionFamilies: ['relationship', 'estate'], resolved: false });
    const continued = resolveEvent(world, 'event-next-generation', 'welcome-child');
    const childId = continued.characters[continued.playerCharacterId].childIds[0];
    expect(continued.characters[childId].parentIds).toEqual([actor.id, partner.id]);
    expect(continued.dynasty.notableHistory.at(-1)).toContain('joined the family');
    expect(validateWorld(continued)).toEqual([]);
  });
});

describe('education pathways', () => {
  it('turns an accepted offer into a weekly tuition-bearing enrollment', () => {
    const world = createWorld({ seed: 'education-enroll', startAgeYears: 22, nowISO: '2026-08-19T00:00:00.000Z' });
    world.education['education-offer'] = { id: 'education-offer', characterId: world.playerCharacterId, institutionId: 'organization-harborview-academy', status: 'accepted', level: 'Undergraduate program', recordedGrade: 70, knowledgeGain: 54, prestige: 64, network: 58, tuitionCentsPerYear: 2_400_000, manipulatedCredential: false };
    const result = executeAction(world, { verb: 'education.enroll', targetIds: ['education-offer'], parameters: {} });
    expect(result.world.education['education-offer'].status).toBe('higher');
    expect(result.world.education['education-offer'].startedWeek).toBe(world.calendar.week);
  });
});
