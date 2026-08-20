import { describe, expect, it } from 'vitest';

import { createWorld } from '../createWorld';
import { formatMoney } from '../money';
import { executeRebalancePolish } from '../rebalancePolish';
import { applySystemPolishAdvance } from '../systemPolish';
import { executeSystemPolishAction } from '../systemPolishActions';
import type { Business, CareerState, PropertyAsset, WorldState } from '../types';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function advanceCopy(world: WorldState, weeks: number): WorldState {
  const next = clone(world);
  next.calendar.week += weeks;
  return next;
}

function property(world: WorldState, id: string): PropertyAsset {
  return {
    id,
    name: `Rental ${id}`,
    kind: 'multifamily',
    cityId: world.characters[world.playerCharacterId].cityId,
    ownerId: world.playerCharacterId,
    valueCents: 50_000_000,
    debtCents: 15_000_000,
    condition: 92,
    occupancy: 'vacant',
    weeklyRentCents: 110_000,
    weeklyCostsCents: 20_000,
    managed: true,
  };
}

function delegatedBusiness(world: WorldState, id: string): Business {
  const actor = world.characters[world.playerCharacterId];
  const organizationId = `organization-${id}`;
  world.organizations[organizationId] = { id: organizationId, kind: 'business', name: id, resourcesCents: 20_000_000, influence: 35, stability: 70, memberIds: [actor.id], leaderId: actor.id, history: [] };
  return {
    id,
    organizationId,
    name: 'North Point Services',
    sector: 'Services',
    cityId: actor.cityId,
    founderId: actor.id,
    ownerId: actor.id,
    cashCents: 30_000_000,
    debtCents: 0,
    revenueWeeklyCents: 1_500_000,
    costWeeklyCents: 1_000_000,
    valuationCents: 150_000_000,
    playerOwnershipBps: 10_000,
    votingControlBps: 10_000,
    employees: 12,
    capacity: 120,
    demand: 90,
    quality: 76,
    reputation: 72,
    marketingBps: 500,
    pricePosition: 'market',
    growthPosture: 'balanced',
    delegated: true,
    active: true,
    managerName: 'Avery Bennett',
    managerQuality: 84,
    managerSalaryWeeklyCents: 250_000,
    personalTimeHours: 5,
    productLines: [],
    marketShare: 4,
    customerLoyalty: 70,
    culture: 74,
    complexity: 48,
    locations: 2,
  };
}

function strongCareer(world: WorldState): CareerState {
  return {
    id: 'career-polish',
    characterId: world.playerCharacterId,
    employerId: 'organization-northstar-logistics',
    title: 'Operations specialist',
    sector: 'Operations',
    weeklySalaryCents: 200_000,
    performance: 92,
    satisfaction: 70,
    weeksInRole: 25,
    active: true,
    hoursPerWeek: 40,
    level: 2,
    department: 'Operations',
    promotionProgress: 70,
    organizationStanding: 86,
  };
}

describe('system polish', () => {
  it('uses predictable compact money strings that stay short on mobile cards', () => {
    expect(formatMoney(249_600_000, true)).toBe('$2.5M');
    expect(formatMoney(-437_560, true)).toBe('-$4.38K');
    expect(formatMoney(18_512_000, true)).toBe('$185K');
  });

  it('pays real dividend cash instead of hiding income inside market value', () => {
    const before = createWorld({ seed: 'dividend-polish', startAgeYears: 30, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = before.characters[before.playerCharacterId];
    actor.cashCents = 0;
    before.securities.dividend = { id: 'dividend', symbol: 'DIV', name: 'Dividend Co', sector: 'Utilities', priceCents: 10_000, quality: 70, volatility: 25, dividendYieldBps: 500 };
    before.holdings.holding = { id: 'holding', ownerId: actor.id, securityId: 'dividend', unitsMilli: 1_000_000, costBasisCents: 10_000_000 };

    const after = applySystemPolishAdvance(before, advanceCopy(before, 52));
    expect(after.characters[after.playerCharacterId].cashCents).toBe(500_000);
    expect(after.transactions.some((transaction) => transaction.kind === 'investment-dividend' && transaction.amountCents === 500_000)).toBe(true);
  });

  it('creates recurring annual tuition bills and honors recurring scholarship aid', () => {
    const before = createWorld({ seed: 'tuition-polish', startAgeYears: 19, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = before.characters[before.playerCharacterId];
    const university = before.organizations['organization-harborview-university'] ? 'organization-harborview-university' : undefined;
    const catalogUniversity = university ?? 'university-harborview-state';
    before.education.college = {
      id: 'college',
      characterId: actor.id,
      institutionId: catalogUniversity,
      status: 'higher',
      startedWeek: before.calendar.week - 51,
      level: 'Undergraduate · Finance',
      recordedGrade: 82,
      knowledgeGain: actor.knowledge,
      prestige: 65,
      network: 60,
      tuitionCentsPerYear: 3_000_000,
      manipulatedCredential: false,
      scholarshipCents: 1_000_000,
    };

    const after = applySystemPolishAdvance(before, advanceCopy(before, 1));
    const bill = Object.values(after.liabilities).find((liability) => liability.kind === 'student' && liability.securedById === 'college');
    expect(bill?.principalCents).toBeGreaterThan(0);
    expect(bill?.principalCents).toBeLessThanOrEqual(2_000_000);
  });

  it('turns strong semiannual career reviews into real compensation and leverage', () => {
    const before = createWorld({ seed: 'career-review-polish', startAgeYears: 30, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = before.characters[before.playerCharacterId];
    actor.reputation.professional = 95;
    actor.knowledge = 95;
    actor.discipline = 95;
    actor.charisma = 90;
    actor.competencies = { management: 95, communication: 95, leadership: 95 };
    Object.values(before.careers).forEach((career) => { if (career.characterId === actor.id) career.active = false; });
    before.careers['career-polish'] = strongCareer(before);
    const cashBefore = actor.cashCents;
    const afterSource = advanceCopy(before, 1);
    afterSource.careers['career-polish'].weeksInRole = 26;

    const after = applySystemPolishAdvance(before, afterSource);
    expect(after.careers['career-polish'].weeklySalaryCents).toBeGreaterThan(200_000);
    expect(after.characters[after.playerCharacterId].cashCents).toBeGreaterThan(cashBefore);
    expect(after.timeline.some((entry) => entry.title === 'A strong performance review')).toBe(true);
  });

  it('lets a portfolio manager fill routine vacancies with persistent tenants', () => {
    const before = createWorld({ seed: 'managed-leasing-polish', startAgeYears: 35, nowISO: '2026-08-20T00:00:00.000Z' });
    before.properties.rental = property(before, 'rental');
    before.calendar.week = 3;
    const source = advanceCopy(before, 1);
    const after = applySystemPolishAdvance(before, source);
    expect(after.properties.rental.occupancy).toBe('tenant');
    expect(Object.values(after.memories).some((memory) => memory.category === 'Property · Tenant · rental' && memory.unresolved)).toBe(true);
  });

  it('creates concise owner-level reports for professionally managed companies', () => {
    const before = createWorld({ seed: 'board-report-polish', startAgeYears: 40, nowISO: '2026-08-20T00:00:00.000Z' });
    before.businesses.company = delegatedBusiness(before, 'company');
    before.calendar.week = 12;
    const after = applySystemPolishAdvance(before, advanceCopy(before, 1));
    const report = Object.values(after.memories).find((memory) => memory.category === 'Business · Board report · company');
    expect(report?.narrative).toContain('CEO quality is 84/100');
    expect(report?.narrative).toContain('operating margin');
  });

  it('rebalances only liquid public positions while preserving real cost-basis history', () => {
    const world = createWorld({ seed: 'rebalance-polish', startAgeYears: 30, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = world.characters[world.playerCharacterId];
    actor.cashCents = 500_000;
    world.securities.a = { id: 'a', symbol: 'AAA', name: 'AAA', sector: 'Industrials', priceCents: 10_000, quality: 70, volatility: 30, dividendYieldBps: 100 };
    world.securities.b = { id: 'b', symbol: 'BBB', name: 'BBB', sector: 'Technology', priceCents: 10_000, quality: 70, volatility: 40, dividendYieldBps: 0 };
    world.securities.p = { id: 'p', symbol: 'PVT', name: 'Private', sector: 'Private Markets', priceCents: 10_000, quality: 60, volatility: 60, dividendYieldBps: 0 };
    world.holdings.a = { id: 'a', ownerId: actor.id, securityId: 'a', unitsMilli: 2_000_000, costBasisCents: 10_000_000 };
    world.holdings.b = { id: 'b', ownerId: actor.id, securityId: 'b', unitsMilli: 1_000_000, costBasisCents: 10_000_000 };
    world.holdings.p = { id: 'p', ownerId: actor.id, securityId: 'p', unitsMilli: 500_000, costBasisCents: 5_000_000 };
    const privateUnits = world.holdings.p.unitsMilli;
    const sourceCash = world.characters[world.playerCharacterId].cashCents;

    const result = executeRebalancePolish(world, { verb: 'markets.rebalance', targetIds: [], parameters: {} })!;
    expect(result.validation.valid).toBe(true);
    expect(result.world.holdings.p.unitsMilli).toBe(privateUnits);
    expect(world.characters[world.playerCharacterId].cashCents).toBe(sourceCash);
    expect(result.world.holdings.a.costBasisCents + result.world.holdings.b.costBasisCents).toBeGreaterThan(20_000_000);
  });

  it('makes rent increases part of the tenant relationship instead of free revenue', () => {
    const world = createWorld({ seed: 'rent-polish', startAgeYears: 35, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = world.characters[world.playerCharacterId];
    world.properties.rental = property(world, 'rental');
    world.properties.rental.occupancy = 'tenant';
    const tenantId = 'tenant-polish';
    world.characters[tenantId] = { ...clone(actor), id: tenantId, firstName: 'Maya', partnerId: undefined, parentIds: [], childIds: [], cashCents: 8_000_000 };
    world.relationships.tenant = { id: 'tenant', characterIds: [actor.id, tenantId], kind: 'professional', trust: 60, affection: 20, respect: 60, resentment: 5, lastInteractionWeek: world.calendar.week };
    world.memories.tenancy = { id: 'tenancy', participantIds: [actor.id, tenantId, 'rental'], category: 'Property · Tenant · rental', week: world.calendar.week, valence: 0.2, importance: 50, permanent: false, unresolved: true, visibility: 'shared', narrative: 'Maya rents the unit.' };

    const result = executeSystemPolishAction(world, { verb: 'property.set_rent', targetIds: ['rental'], parameters: { weeklyRentCents: Math.round(world.properties.rental.weeklyRentCents * 1.05) } })!;
    expect(result.validation.valid).toBe(true);
    expect(result.world.relationships.tenant.resentment).toBeGreaterThan(5);
    expect(result.world.properties.rental.weeklyRentCents).toBeGreaterThan(world.properties.rental.weeklyRentCents);
  });

  it('stores athletic scholarships as recurring annual aid instead of a one-off balance reduction', () => {
    const world = createWorld({ seed: 'scholarship-polish', startAgeYears: 19, nowISO: '2026-08-20T00:00:00.000Z' });
    const actor = world.characters[world.playerCharacterId];
    actor.fitness = 100;
    actor.discipline = 100;
    actor.reputation.public = 100;
    actor.competencies = { athletics: 100, academics: 90 };
    world.education.college = { id: 'college', characterId: actor.id, institutionId: 'university-harborview-state', status: 'higher', startedWeek: world.calendar.week, level: 'Undergraduate · Business', recordedGrade: 90, knowledgeGain: 80, prestige: 70, network: 70, tuitionCentsPerYear: 4_000_000, manipulatedCredential: false, athleticLevel: 100, athleticRecognition: 100 };
    world.liabilities.tuition = { id: 'tuition', debtorId: actor.id, kind: 'student', principalCents: 4_000_000, annualRateBps: 0, weeklyPaymentCents: 0, securedById: 'college' };

    const result = executeSystemPolishAction(world, { verb: 'education.sports_seek_scholarship', targetIds: ['college'], parameters: {} })!;
    expect(result.validation.valid).toBe(true);
    expect(result.world.education.college.scholarshipCents).toBeGreaterThan(0);
    expect(result.world.liabilities.tuition.principalCents).toBeLessThan(4_000_000);
  });
});
