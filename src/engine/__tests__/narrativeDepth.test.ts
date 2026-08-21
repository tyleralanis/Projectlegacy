import { describe, expect, it } from 'vitest';

import { createWorld } from '../createWorld';
import { applyNarrativeDepth, getNarrativeArcs, getRecentLifeTexture } from '../narrativeDepth';
import { resolveEvent } from '../simulationEventBridge';
import type { GameEvent, WorldState } from '../types';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function advanceCopy(world: WorldState, weeks: number): WorldState {
  const next = clone(world);
  next.calendar.week += weeks;
  return next;
}

describe('narrative depth', () => {
  it('gives quiet quarters state-grounded ordinary-life texture', () => {
    const before = createWorld({ seed: 'ordinary-life-texture', startAgeYears: 34, nowISO: '2026-08-20T00:00:00.000Z' });
    before.calendar.week = Math.floor(before.calendar.week / 13) * 13 + 12;
    const after = applyNarrativeDepth(before, advanceCopy(before, 1));

    expect(getRecentLifeTexture(after).length).toBeGreaterThan(0);
    expect(after.feed.some((entry) => entry.week === after.calendar.week)).toBe(true);
  });

  it('turns a recession into a cross-system story instead of an isolated market label', () => {
    const before = createWorld({ seed: 'economic-weather-story', startAgeYears: 42, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = before.characters[before.playerCharacterId];
    before.calendar.week = Math.floor(before.calendar.week / 13) * 13 + 12;
    before.securities.weather = { id: 'weather', symbol: 'WX', name: 'Weather Holdings', sector: 'Industrials', priceCents: 10_000, quality: 60, volatility: 40, dividendYieldBps: 0 };
    before.holdings.weather = { id: 'weather', ownerId: actor.id, securityId: 'weather', unitsMilli: 200_000, costBasisCents: 2_000_000 };
    before.economy.regime = 'steady';
    const source = advanceCopy(before, 1);
    source.economy.regime = 'recession';

    const after = applyNarrativeDepth(before, source);
    const arc = getNarrativeArcs(after).find((memory) => memory.category === 'Arc · Narrative · Economic weather');
    expect(arc?.narrative).toContain('recession');
    expect(arc?.unresolved).toBe(true);
  });

  it('treats a partner warning as a remembered choice with real relationship consequences', () => {
    const world = createWorld({ seed: 'partner-story-choice', startAgeYears: 35, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = world.characters[world.playerCharacterId];
    const partnerId = 'partner-story';
    world.characters[partnerId] = { ...clone(actor), id: partnerId, firstName: 'Riley', parentIds: [], childIds: [], partnerId: actor.id };
    actor.partnerId = partnerId;
    world.relationships.partnerStory = { id: 'partnerStory', characterIds: [actor.id, partnerId], kind: 'partner', trust: 55, affection: 62, respect: 58, resentment: 18, lastInteractionWeek: world.calendar.week - 30 };
    const event: GameEvent = {
      id: 'story-event', templateId: 'story.partner-slow-down', domain: 'relationship', severity: 'S3', week: world.calendar.week,
      title: 'Riley wants some of you back', narrative: 'The schedule has become part of the relationship.', participantIds: [actor.id, partnerId],
      choices: [
        { id: 'protect-time', label: 'Protect time together', detail: 'Make room.' },
        { id: 'ask-patience', label: 'Ask for patience', detail: 'Acknowledge it.' },
        { id: 'dismiss', label: 'Keep pushing', detail: 'Protect ambition.' },
      ],
      otherActionFamilies: ['relationship'], resolved: false,
    };
    world.events.push(event);

    const after = resolveEvent(world, event.id, 'protect-time');
    const relationship = after.relationships.partnerStory;
    expect(relationship.trust).toBeGreaterThan(55);
    expect(relationship.resentment).toBeLessThan(18);
    expect(Object.values(after.memories).some((memory) => memory.category === 'Decision · story.partner-slow-down' && memory.permanent)).toBe(true);
  });
});
