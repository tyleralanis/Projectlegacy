import { describe, expect, it } from 'vitest';

import { applyConsequenceWeb, getConsequenceArcs } from '../consequenceWeb';
import { createWorld } from '../createWorld';
import { executeRelationshipDepth, relationshipLoanBalance } from '../relationshipDepth';
import type { WorldState } from '../types';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makePartner(world: WorldState, personId = 'character-riley'): void {
  const actor = world.characters[world.playerCharacterId];
  const person = world.characters[personId];
  const relationship = Object.values(world.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(personId))!;
  actor.partnerId = personId;
  person.partnerId = actor.id;
  relationship.kind = 'partner';
  relationship.trust = 72;
  relationship.affection = 78;
  relationship.respect = 70;
  relationship.resentment = 8;
}

function addBusiness(world: WorldState): string {
  const actor = world.characters[world.playerCharacterId];
  world.organizations['organization-family-business'] = {
    id: 'organization-family-business',
    kind: 'business',
    name: 'Mercer Family Works',
    resourcesCents: 10_000_000,
    influence: 20,
    stability: 60,
    memberIds: [actor.id],
    leaderId: actor.id,
    history: [],
  };
  world.businesses['business-family'] = {
    id: 'business-family',
    organizationId: 'organization-family-business',
    name: 'Mercer Family Works',
    sector: 'Professional Services',
    cityId: actor.cityId,
    founderId: actor.id,
    ownerId: actor.id,
    cashCents: 10_000_000,
    debtCents: 0,
    revenueWeeklyCents: 500_000,
    costWeeklyCents: 300_000,
    valuationCents: 50_000_000,
    playerOwnershipBps: 10_000,
    votingControlBps: 10_000,
    employees: 5,
    capacity: 60,
    demand: 52,
    quality: 70,
    reputation: 62,
    marketingBps: 500,
    pricePosition: 'market',
    growthPosture: 'balanced',
    delegated: false,
    active: true,
    personalTimeHours: 30,
  };
  return 'business-family';
}

describe('relationship depth and consequence web', () => {
  it('lets the player deliberately make one relationship a standing priority', () => {
    const world = createWorld({ seed: 'relationship-priority', startAgeYears: 30, nowISO: '2026-01-01T00:00:00.000Z' });
    makePartner(world);

    const result = executeRelationshipDepth(world, { verb: 'relationship.prioritize', targetIds: ['character-riley'], parameters: {} })!;

    expect(result.validation.valid).toBe(true);
    expect(result.world.characters[result.world.playerCharacterId].focuses).toContain('Partner');
    expect(Object.values(result.world.memories).some((memory) => memory.category === 'Relationship · Priority')).toBe(true);
  });

  it('tracks a personal loan as relationship history until repayment', () => {
    const world = createWorld({ seed: 'relationship-loan', startAgeYears: 30, nowISO: '2026-01-01T00:00:00.000Z' });
    world.characters[world.playerCharacterId].cashCents = 2_000_000;

    const loan = executeRelationshipDepth(world, { verb: 'relationship.lend_money', targetIds: ['character-mara'], parameters: { amountCents: 100_000 } })!;
    expect(relationshipLoanBalance(loan.world, 'character-mara')).toBe(100_000);
    expect(Object.values(loan.world.memories).some((memory) => memory.category === 'Obligation · Loan' && memory.unresolved)).toBe(true);

    const sibling = loan.world.characters['character-mara'];
    const relationship = loan.world.relationships['relationship-player-sibling'];
    sibling.cashCents = 500_000;
    sibling.discipline = 92;
    sibling.ethics = 92;
    relationship.trust = 90;
    relationship.respect = 90;
    relationship.resentment = 0;
    const repayment = executeRelationshipDepth(loan.world, { verb: 'relationship.collect_loan', targetIds: ['character-mara'], parameters: { amountCents: 100_000 } })!;
    expect(relationshipLoanBalance(repayment.world, 'character-mara')).toBe(0);
  });

  it('turns hiring family into both a company state change and relationship history', () => {
    const world = createWorld({ seed: 'family-business', startAgeYears: 30, nowISO: '2026-01-01T00:00:00.000Z' });
    const businessId = addBusiness(world);

    const result = executeRelationshipDepth(world, { verb: 'family.invite_business', targetIds: ['character-mara', businessId], parameters: { businessId } })!;

    expect(result.validation.valid).toBe(true);
    expect(Object.values(result.world.careers).some((career) => career.characterId === 'character-mara' && career.employerId === 'organization-family-business' && career.active)).toBe(true);
    expect(result.world.organizations['organization-family-business'].memberIds).toContain('character-mara');
    expect(Object.values(result.world.memories).some((memory) => memory.category === 'Family · Joined the business')).toBe(true);
  });

  it('turns chronic relationship pressure into a persistent partnership arc', () => {
    const before = createWorld({ seed: 'marriage-pressure', startAgeYears: 35, nowISO: '2026-01-01T00:00:00.000Z' });
    makePartner(before);
    addBusiness(before);
    before.characters[before.playerCharacterId].stress = 96;
    before.characters['character-riley'].stress = 91;
    const relationship = before.relationships['relationship-player-riley'];
    relationship.resentment = 42;
    relationship.lastInteractionWeek = before.calendar.week - 30;
    const source = clone(before);
    source.calendar.week += 13;

    const after = applyConsequenceWeb(before, source);
    const arcs = getConsequenceArcs(after, 'character-riley');

    expect(arcs.some((memory) => memory.category === 'Arc · Partnership')).toBe(true);
    expect(after.relationships['relationship-player-riley'].resentment).toBeGreaterThan(42);
  });

  it('remembers future promises long enough for later choices to contradict them', () => {
    const start = createWorld({ seed: 'future-promise', startAgeYears: 30, nowISO: '2026-01-01T00:00:00.000Z' });
    makePartner(start);
    const planned = executeRelationshipDepth(start, { verb: 'relationship.plan_future', targetIds: ['character-riley'], parameters: {} })!;
    const before = clone(planned.world);
    before.characters[before.playerCharacterId].focuses = ['Job', 'Networking', 'Health'];
    before.relationships['relationship-player-riley'].trust = 42;
    before.relationships['relationship-player-riley'].affection = 44;
    before.relationships['relationship-player-riley'].respect = 50;
    before.relationships['relationship-player-riley'].resentment = 42;
    const source = clone(before);
    source.calendar.week += 105;

    const after = applyConsequenceWeb(before, source);

    expect(Object.values(after.memories).some((memory) => memory.category === 'Arc · Broken expectation' && memory.unresolved)).toBe(true);
  });
});
