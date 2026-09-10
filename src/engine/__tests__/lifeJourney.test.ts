import { describe, expect, it } from 'vitest';

import { addWeeksISO, createWorld } from '../createWorld';
import { assertWorldValid } from '../invariants';
import { executeJourneyAction, lifePlans, personalProjects, tickLifeJourney } from '../lifeJourney';
import { advanceWorld, getActiveEvent, resolveEvent } from '../simulation';
import { executeSupplementalDepth } from '../supplementalDepthBridge';
import { getDeepTimeBudget } from '../timeSystem';
import type { IntentAction, WorldState } from '../types';

import { migrateWorld } from '@/storage/worldMigrations';

function fixture(age = 30) {
  const world = createWorld({ seed: 'life-journey-check', startAgeYears: age, nowISO: '2026-09-09T00:00:00.000Z' });
  const actor = world.characters[world.playerCharacterId];
  actor.cashCents = 10_000_000;
  actor.health = 95;
  actor.stress = 10;
  actor.focuses = ['Health'];
  world.events = [];
  return world;
}

const action = (verb: string, parameters: IntentAction['parameters'] = {}, targetIds: string[] = []): IntentAction => ({ verb, parameters, targetIds });
function start(world = fixture(), id = 'creative') {
  const result = executeSupplementalDepth(world, action('life.project_start', { projectId: id }))!;
  expect(result.validation.valid, result.message).toBe(true);
  return result.world;
}
function week(world: WorldState) {
  world.calendar.week += 1;
  world.calendar.dateISO = addWeeksISO(world.calendar.dateISO, 1);
  tickLifeJourney(world);
}

describe('personal projects and life plans', () => {
  it('loads a pre-update save without changing its version or requiring a journal', () => {
    const old = fixture();
    const migrated = migrateWorld(old);
    expect(migrated.journey).toBeUndefined();
    expect(migrated.metadata.schemaVersion).toBe(old.metadata.schemaVersion);
    expect(() => assertWorldValid(migrated)).not.toThrow();
  });

  it('sets aside a selected plan even when its button includes the old plan id', () => {
    const selected = executeJourneyAction(fixture(), action('life.choose_plan', { planId: 'craft' }))!.world;
    expect(selected.journey?.activePlans[selected.playerCharacterId]).toBe('craft');
    const cleared = executeJourneyAction(selected, action('life.clear_plan', { planId: 'craft' }))!.world;
    expect(cleared.journey?.activePlans[cleared.playerCharacterId]).toBeUndefined();
    expect(selected.journey?.activePlans[selected.playerCharacterId]).toBe('craft');
  });

  it('charges material costs once and prevents a second unfinished project', () => {
    const source = fixture();
    const world = start(source, 'practical');
    expect(world.characters[world.playerCharacterId].cashCents).toBe(source.characters[source.playerCharacterId].cashCents - 8000);
    expect(source.journey).toBeUndefined();
    const duplicate = executeJourneyAction(world, action('life.project_start', { projectId: 'creative' }))!;
    expect(duplicate.validation.valid).toBe(false);
    expect(duplicate.world).toBe(world);
  });

  it('enforces age, cash, and mentoring experience through the same app dispatcher', () => {
    expect(executeSupplementalDepth(fixture(5), action('life.project_start', { projectId: 'creative' }))?.validation.valid).toBe(false);
    const broke = fixture();
    broke.characters[broke.playerCharacterId].cashCents = 0;
    expect(executeJourneyAction(broke, action('life.project_start', { projectId: 'practical' }))?.validation.valid).toBe(false);
    const novice = fixture();
    novice.careers = {};
    expect(executeJourneyAction(novice, action('life.project_start', { projectId: 'mentoring' }))?.validation.valid).toBe(false);
    expect(lifePlans(fixture(5))).toEqual([]);
    expect(lifePlans(fixture(12)).some((plan) => plan.id === 'independence')).toBe(false);
  });

  it('includes project hours, and pausing frees time without deleting progress', () => {
    let world = start();
    week(world);
    const project = personalProjects(world)[0];
    const before = getDeepTimeBudget(world);
    world = executeJourneyAction(world, action('life.project_pause', {}, [project.id]))!.world;
    expect(getDeepTimeBudget(world).committedHours).toBe(before.committedHours - 3);
    week(world);
    expect(personalProjects(world)[0].completedWeeks).toBe(1);
    world = executeJourneyAction(world, action('life.project_resume', {}, [project.id]))!.world;
    week(world);
    expect(personalProjects(world)[0].completedWeeks).toBe(2);
  });

  it('interrupts a long skip at the halfway choice and applies branching consequences', () => {
    let world = start();
    for (let index = 0; index < 3; index += 1) week(world);
    const advanced = advanceWorld(world, 52);
    const event = getActiveEvent(advanced.world)!;
    expect(event.templateId).toMatch(/^project.checkpoint:/);
    expect(advanced.summary.advancedWeeks).toBe(1);
    world = resolveEvent(advanced.world, event.id, 'stretch');
    const project = personalProjects(world)[0];
    expect(project.durationWeeks).toBe(12);
    expect(project.hoursPerWeek).toBe(5);
    expect(project.checkpointHandled).toBe(true);
    expect(() => assertWorldValid(world)).not.toThrow();
  });

  it('does not process the same project week twice or progress past a waiting choice', () => {
    const world = start();
    for (let index = 0; index < 4; index += 1) week(world);
    tickLifeJourney(world);
    expect(personalProjects(world)[0].completedWeeks).toBe(4);
    week(world);
    expect(personalProjects(world)[0].completedWeeks).toBe(4);
    expect(world.events.filter((event) => event.templateId.startsWith('project.'))).toHaveLength(1);
  });

  it('can pause at a checkpoint, then resume and complete only once', () => {
    let world = start(fixture(), 'family-stories');
    for (let index = 0; index < 3; index += 1) week(world);
    world = resolveEvent(world, getActiveEvent(world)!.id, 'pause');
    const id = personalProjects(world)[0].id;
    week(world);
    expect(personalProjects(world)[0].completedWeeks).toBe(3);
    world = executeJourneyAction(world, action('life.project_resume', {}, [id]))!.world;
    for (let index = 0; index < 3; index += 1) week(world);
    expect(personalProjects(world)[0].status).toBe('completed');
    const mood = world.characters[world.playerCharacterId].mood;
    week(world);
    expect(world.characters[world.playerCharacterId].mood).toBe(mood);
    expect(world.timeline.filter((entry) => entry.title === 'Completed: Record your family stories')).toHaveLength(1);
    expect(executeJourneyAction(world, action('life.project_start', { projectId: 'family-stories' }))?.validation.valid).toBe(false);
  });

  it('delays progress for poor health and resumes after recovery', () => {
    const world = start();
    world.characters[world.playerCharacterId].health = 20;
    week(world);
    expect(personalProjects(world)[0].completedWeeks).toBe(0);
    world.characters[world.playerCharacterId].health = 90;
    week(world);
    expect(personalProjects(world)[0].completedWeeks).toBe(1);
  });

  it('preserves deterministic multiweek versus weekly advancement', () => {
    const source = start();
    const batch = advanceWorld(source, 12, { interrupt: false, autoResolveEvents: true }).world;
    let weekly = source;
    for (let index = 0; index < 12; index += 1) weekly = advanceWorld(weekly, 1, { interrupt: false, autoResolveEvents: true }).world;
    expect(batch.journey).toEqual(weekly.journey);
    expect(batch.characters).toEqual(weekly.characters);
    expect(batch.rngState).toBe(weekly.rngState);
    expect(personalProjects(batch)[0].status).toBe('completed');
  });

  it('does not carry an unfinished project or chosen plan onto an heir', () => {
    let world = start();
    world = executeJourneyAction(world, action('life.choose_plan', { planId: 'craft' }))!.world;
    const priorId = world.playerCharacterId;
    const heir = Object.values(world.characters).find((character) => character.isAlive && character.id !== priorId)!;
    world.playerCharacterId = heir.id;
    week(world);
    expect(personalProjects(world)).toEqual([]);
    expect(world.journey?.activePlans[heir.id]).toBeUndefined();
    expect(Object.values(world.journey!.projects)[0].status).toBe('abandoned');
  });

  it('validates resumed saves and rejects corrupt progress before import', () => {
    const world = start();
    week(world);
    expect(migrateWorld(world).journey).toEqual(world.journey);
    personalProjects(world)[0].completedWeeks = Number.NaN;
    expect(() => migrateWorld(world)).toThrow(/personal project/i);
  });

  it('requires explicit confirmation to abandon and never refunds spent materials', () => {
    const world = start(fixture(), 'practical');
    const id = personalProjects(world)[0].id;
    const leave = action('life.project_leave', {}, [id]);
    expect(executeJourneyAction(world, leave)?.validation.requiresConfirmation).toBe(true);
    const abandoned = executeJourneyAction(world, leave, true)!;
    expect(personalProjects(abandoned.world)[0].status).toBe('abandoned');
    expect(abandoned.world.characters[world.playerCharacterId].cashCents).toBe(world.characters[world.playerCharacterId].cashCents);
  });

  it('records a reached life plan once, keeps it across plan changes, and never grants cash', () => {
    const world = fixture();
    const actor = world.characters[world.playerCharacterId];
    const career = Object.values(world.careers).find((item) => item.characterId === actor.id)!;
    career.active = true; career.weeksInRole = 30; career.performance = 80;
    const chosen = executeJourneyAction(world, action('life.choose_plan', { planId: 'career' }))!.world;
    expect(lifePlans(chosen).find((plan) => plan.id === 'career')?.completed).toBe(true);
    const again = executeJourneyAction(chosen, action('life.choose_plan', { planId: 'career' }))!.world;
    expect(again.timeline.filter((entry) => entry.title.startsWith('Life milestone:'))).toHaveLength(1);
    expect(again.characters[actor.id].cashCents).toBe(actor.cashCents);
    const beforeRead = JSON.stringify(again);
    lifePlans(again);
    expect(JSON.stringify(again)).toBe(beforeRead);
  });

  it('catches up once per week without repairing resentment or touching dead relatives', () => {
    const source = fixture();
    const actor = source.characters[source.playerCharacterId];
    const family = Object.values(source.relationships).find((link) => link.characterIds.includes(actor.id) && link.kind === 'parent')!;
    family.resentment = 80;
    const result = executeSupplementalDepth(source, action('relationship.keep_in_touch'))!;
    expect(result.validation.valid).toBe(true);
    expect(result.world.relationships[family.id].resentment).toBe(80);
    expect(getDeepTimeBudget(result.world).commitments.some((item) => item.id === 'social-catch-up')).toBe(true);
    expect(executeSupplementalDepth(result.world, action('relationship.keep_in_touch'))?.validation.valid).toBe(false);
    expect(source.journey).toBeUndefined();
  });
});
