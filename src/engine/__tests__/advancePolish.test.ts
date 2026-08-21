import { describe, expect, it } from 'vitest';

import { advanceWorldWithOptionalCapacityDecisions } from '../advancePolish';
import { createWorld } from '../createWorld';
import { normalizeDelegatedWorld } from '../delegationNormalize';
import type { Business, WorldState } from '../types';

function addCompany(world: WorldState, id: string, delegated = false): Business {
  const actor = world.characters[world.playerCharacterId];
  const organizationId = `organization-${id}`;
  world.organizations[organizationId] = {
    id: organizationId,
    kind: 'business',
    name: `${id} Company`,
    resourcesCents: 5_000_000,
    influence: 30,
    stability: 60,
    memberIds: [actor.id],
    leaderId: actor.id,
    history: [],
  };
  const business: Business = {
    id,
    organizationId,
    name: `${id} Company`,
    sector: 'Technology',
    cityId: actor.cityId,
    founderId: actor.id,
    ownerId: actor.id,
    cashCents: 10_000_000,
    debtCents: 0,
    revenueWeeklyCents: 500_000,
    costWeeklyCents: 300_000,
    valuationCents: 30_000_000,
    playerOwnershipBps: 10_000,
    votingControlBps: 10_000,
    employees: 5,
    capacity: 20,
    demand: 60,
    quality: 70,
    reputation: 65,
    marketingBps: 600,
    pricePosition: 'market',
    growthPosture: 'balanced',
    delegated,
    active: true,
  };
  world.businesses[id] = business;
  return business;
}

function addCapacityEvent(world: WorldState, business: Business): void {
  world.events.push({
    id: `capacity-${business.id}`,
    templateId: 'business.capacity',
    domain: 'business',
    severity: 'S3',
    week: world.calendar.week,
    title: 'Growth is breaking capacity',
    narrative: 'Demand is outrunning capacity.',
    participantIds: [world.playerCharacterId, business.organizationId],
    choices: [
      { id: 'hire', label: 'Hire', detail: 'Add capacity.' },
      { id: 'raise-price', label: 'Raise prices', detail: 'Slow demand.' },
      { id: 'reduce-marketing', label: 'Ease marketing', detail: 'Slow demand.' },
      { id: 'delegate', label: 'Delegate', detail: 'Hire an operator.' },
    ],
    otherActionFamilies: ['business'],
    resolved: false,
  });
}

describe('capacity interruption polish', () => {
  it('treats pressing Advance with a pending capacity warning as ignore-and-continue', () => {
    const world = createWorld({ seed: 'skip-capacity', startAgeYears: 30, nowISO: '2026-08-21T00:00:00.000Z' });
    const business = addCompany(world, 'owner-led');
    addCapacityEvent(world, business);
    const qualityBefore = business.quality;

    const result = advanceWorldWithOptionalCapacityDecisions(world, 1);
    expect(result.world.events.find((event) => event.id === 'capacity-owner-led')?.resolved).toBe(true);
    expect(result.world.events.find((event) => event.id === 'capacity-owner-led')?.selectedChoiceId).toBe('ignore');
    expect(result.world.businesses['owner-led'].delegated).toBe(false);
    expect(result.world.businesses['owner-led'].quality).toBeLessThan(qualityBefore);
    expect(result.summary.interruptedByEventId).not.toBe('capacity-owner-led');
  });

  it('restores delegation when a legacy save still has a real hired CEO', () => {
    const world = createWorld({ seed: 'repair-ceo', startAgeYears: 30, nowISO: '2026-08-21T00:00:00.000Z' });
    const business = addCompany(world, 'managed');
    const executiveId = Object.keys(world.characters).find((id) => id !== world.playerCharacterId)!;
    world.organizations[business.organizationId].leaderId = executiveId;
    business.managerName = 'Casey Morgan';
    business.managerQuality = 84;
    business.managerSalaryWeeklyCents = 250_000;
    business.delegated = false;
    world.careers['ceo-career'] = {
      id: 'ceo-career',
      characterId: executiveId,
      employerId: business.organizationId,
      title: 'Chief Executive Officer',
      sector: business.sector,
      weeklySalaryCents: 250_000,
      performance: 80,
      satisfaction: 70,
      weeksInRole: 10,
      active: true,
    };
    addCapacityEvent(world, business);

    const normalized = normalizeDelegatedWorld(world);
    expect(normalized.businesses.managed.delegated).toBe(true);
    expect(normalized.events.find((event) => event.id === 'capacity-managed')?.resolved).toBe(true);
  });
});
