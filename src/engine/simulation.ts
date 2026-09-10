import { addWeeksISO, allocateId, playerAgeYears } from './createWorld';
import { explain, recordHistory } from './history';
import { resolveProjectCheckpoint, tickLifeJourney } from './lifeJourney';
import { clampCents, netWorthCents } from './money';
import { normalizeSimulationDetail, shouldSimulateNpcThisWeek, updateBackgroundStatistics } from './performance';
import { nextRandom, randomBetween } from './random';
import type {
  AdvanceResult,
  Business,
  Character,
  Domain,
  GameEvent,
  OutcomeExplanation,
  Severity,
  WorldState,
} from './types';

import { eventIsAgeEligible } from '@/content/worldContent';

export interface AdvanceOptions {
  interrupt?: boolean;
  autoResolveEvents?: boolean;
}

const severityRank: Record<Severity, number> = { S0: 0, S1: 1, S2: 2, S3: 3, S4: 4 };

function cloneWorld(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world)) as WorldState;
}

function roll(world: WorldState): number {
  const result = nextRandom(world.rngState);
  world.rngState = result.state;
  return result.value;
}

function range(world: WorldState, minimum: number, maximum: number): number {
  const result = randomBetween(world.rngState, minimum, maximum);
  world.rngState = result.state;
  return result.value;
}

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function player(world: WorldState): Character {
  return world.characters[world.playerCharacterId];
}

function addFeed(world: WorldState, domain: Domain, title: string, detail: string, important = false, explanation?: OutcomeExplanation): void {
  recordHistory(world, domain, title, detail, { important, explanation });
}

function addTransaction(world: WorldState, kind: string, amountCents: number, memo: string, fromId?: string, toId?: string): void {
  world.transactions.push({
    id: allocateId(world, 'transaction'),
    week: world.calendar.week,
    kind,
    amountCents: clampCents(amountCents),
    fromId,
    toId,
    memo,
  });
  if (world.transactions.length > 1_200) world.transactions.splice(0, world.transactions.length - 1_200);
}

function updateEconomy(world: WorldState): void {
  const shock = range(world, -0.006, 0.006);
  world.economy.growth = clamp(world.economy.growth * 0.97 + shock, -0.08, 0.1);
  world.economy.inflation = clamp(world.economy.inflation * 0.985 + range(world, -0.0015, 0.0015), -0.01, 0.12);
  world.economy.policyRate = clamp(world.economy.policyRate + (world.economy.inflation - 0.025) * 0.015, 0, 0.16);
  world.economy.unemployment = clamp(0.055 - world.economy.growth * 0.22 + range(world, -0.002, 0.002), 0.025, 0.22);
  const weeklyMarketReturn = world.economy.growth / 52 - world.economy.policyRate / 220 + range(world, -0.02, 0.02);
  const weeklyHousingReturn = (world.economy.growth + world.economy.inflation - world.economy.policyRate * 0.45) / 52 + range(world, -0.004, 0.004);
  world.economy.marketIndex = clamp(world.economy.marketIndex * (1 + weeklyMarketReturn), 8, 10_000);
  world.economy.housingIndex = clamp(world.economy.housingIndex * (1 + weeklyHousingReturn), 20, 5_000);
  world.economy.regime =
    world.economy.growth < -0.02
      ? 'recession'
      : world.economy.growth < 0.01
        ? 'slow'
        : world.economy.growth < 0.04
          ? 'steady'
          : world.economy.growth < 0.065
            ? 'growth'
            : 'boom';

  for (const security of Object.values(world.securities)) {
    const qualityDrift = (security.quality - 50) / 90_000;
    const volatility = security.volatility / 100;
    const companyNoise = range(world, -0.035, 0.035) * volatility;
    security.priceCents = Math.max(100, clampCents(security.priceCents * (1 + weeklyMarketReturn * 0.55 + qualityDrift + companyNoise)));
  }
}

function processCareerAndHousehold(world: WorldState): void {
  const actor = player(world);
  if (!actor.isAlive) return;
  const career = Object.values(world.careers).find((item) => item.characterId === actor.id && item.active);
  let incomeCents = 0;
  if (career) {
    const focusBoost = actor.focuses.includes('Job') ? 0.28 : -0.05;
    const healthEffect = (actor.health - 60) / 180;
    career.performance = clamp(career.performance + focusBoost + healthEffect + range(world, -0.5, 0.5));
    career.satisfaction = clamp(career.satisfaction + (actor.focuses.includes('Job') ? 0.08 : -0.04) - actor.stress / 1800);
    career.weeksInRole += 1;
    incomeCents = career.weeklySalaryCents;
  }
  const age = playerAgeYears(world);
  const baseCosts = age < 18 ? 0 : 48_000 + Math.round(actor.childIds.length * 12_000);
  const taxes = Math.round(incomeCents * 0.19);
  const cashDelta = incomeCents - taxes - baseCosts;
  actor.cashCents = clampCents(actor.cashCents + cashDelta);
  if (incomeCents > 0) addTransaction(world, 'income', incomeCents, 'Weekly employment income', career?.employerId, actor.id);
  if (taxes > 0) addTransaction(world, 'tax', -taxes, 'Withheld income tax', actor.id, 'government-harborview');
  if (baseCosts > 0) addTransaction(world, 'household', -baseCosts, 'Household and living costs', actor.id);
}

function updateBusiness(world: WorldState, business: Business): void {
  if (!business.active) return;
  const economyFactor = 1 + world.economy.growth * 0.8;
  const marketing = business.marketingBps / 10_000;
  const saturation = Math.max(0.15, 1 - business.demand / Math.max(20, business.capacity * 3));
  business.demand = clamp(
    business.demand * 0.92 + business.reputation * 0.06 + marketing * 90 * saturation * economyFactor + range(world, -4, 4),
    2,
    10_000_000,
  );
  const fulfilled = Math.max(0, Math.min(business.demand, business.capacity));
  const priceFactor = business.pricePosition === 'value' ? 0.82 : business.pricePosition === 'premium' ? 1.32 : 1;
  const revenue = Math.round(fulfilled * 10_000 * priceFactor);
  const payroll = business.employees * 82_000;
  const operating = Math.round(revenue * 0.36 + payroll + revenue * marketing + 18_000);
  const interest = Math.round((business.debtCents * (world.economy.policyRate + 0.045)) / 52);
  const profit = revenue - operating - interest;
  business.revenueWeeklyCents = revenue;
  business.costWeeklyCents = operating + interest;
  business.cashCents = clampCents(business.cashCents + profit);
  const overload = business.demand / Math.max(1, business.capacity);
  business.quality = clamp(business.quality + (overload > 1.15 ? -0.55 * overload : 0.12) + range(world, -0.25, 0.25));
  business.reputation = clamp(business.reputation + (business.quality - 55) / 240 - Math.max(0, overload - 1) * 0.3);

  // A few profitable weeks are evidence, not a mature earnings history. Move
  // valuation gradually toward ordinary revenue/profit multiples instead of
  // capitalizing one week's profit by more than a hundred times every week.
  const annualProfit = Math.max(0, profit) * 52;
  const revenueEnterpriseValue = Math.max(0, business.revenueWeeklyCents * 52 * 0.55);
  const profitEnterpriseValue = Math.max(0, annualProfit * 4);
  const operatingEquityValue = Math.max(0, Math.max(revenueEnterpriseValue, profitEnterpriseValue) - business.debtCents);
  const netBusinessCash = Math.max(0, business.cashCents - business.debtCents);
  const indicatedValue = Math.max(netBusinessCash, operatingEquityValue);
  business.valuationCents = Math.max(0, clampCents(business.valuationCents * 0.94 + indicatedValue * 0.06));

  if (business.cashCents < -Math.max(2_500_000, business.costWeeklyCents * 10)) {
    business.active = false;
    addFeed(world, 'business', `${business.name} closed`, 'Debt and operating losses exhausted the company’s runway. The experience and relationships remain.', true);
  }
}

function processBusinessesAndProperties(world: WorldState): void {
  const actor = player(world);
  for (const business of Object.values(world.businesses)) updateBusiness(world, business);
  for (const property of Object.values(world.properties)) {
    const weeklyReturn = (world.economy.growth + world.economy.inflation - world.economy.policyRate * 0.45) / 52 + range(world, -0.003, 0.003);
    property.valueCents = Math.max(100_000, clampCents(property.valueCents * (1 + weeklyReturn)));
    const interest = Math.round((property.debtCents * (world.economy.policyRate + 0.02)) / 52);
    const rent = property.occupancy === 'tenant' ? property.weeklyRentCents : 0;
    const management = property.managed ? Math.round(rent * 0.09) : 0;
    const net = rent - property.weeklyCostsCents - interest - management;
    if (property.ownerId === actor.id) actor.cashCents = clampCents(actor.cashCents + net);
    property.condition = clamp(property.condition - (property.managed ? 0.018 : 0.025) + range(world, -0.04, 0.03));
    if (rent !== 0 || net !== 0) addTransaction(world, 'property', net, `${property.name} weekly operations`, property.occupancy === 'tenant' ? 'tenant' : actor.id, actor.id);
  }
  for (const liability of Object.values(world.liabilities)) {
    if (liability.principalCents <= 0) continue;
    const debtor = world.characters[liability.debtorId];
    if (!debtor) continue;
    const interest = Math.round((liability.principalCents * liability.annualRateBps) / 10_000 / 52);
    const principalPaid = Math.max(0, Math.min(liability.principalCents, liability.weeklyPaymentCents - interest));
    const payment = Math.min(liability.principalCents + interest, liability.weeklyPaymentCents);
    liability.principalCents = clampCents(liability.principalCents - principalPaid);
    debtor.cashCents = clampCents(debtor.cashCents - payment);
    if (debtor.id === actor.id) addTransaction(world, 'debt-payment', -payment, `${liability.kind} debt payment`, actor.id, liability.securedById);
  }
}

function secondaryCompletionWeek(world: WorldState, actor: Character): number {
  const graduation = world.timeline
    .filter((entry) => entry.category === 'education' && entry.title === 'Graduation')
    .sort((left, right) => left.week - right.week)[0];
  return graduation?.week ?? actor.birthWeek + 18 * 52;
}

function equivalentProgramWeeks(world: WorldState, actor: Character, startedWeek: number): number {
  const elapsed = Math.max(0, world.calendar.week - startedWeek);
  const secondaryEnd = secondaryCompletionWeek(world, actor);
  const partTimeOverlap = Math.max(0, Math.min(world.calendar.week, secondaryEnd) - startedWeek);
  return elapsed - Math.min(elapsed, partTimeOverlap) * 0.5;
}

function processEducation(world: WorldState): void {
  const actor = player(world);
  const age = playerAgeYears(world);
  let records = Object.values(world.education).filter((item) => item.characterId === actor.id && !['completed', 'withdrawn', 'accepted'].includes(item.status));
  const school = records.find((record) => record.status === 'school');
  if (!school && age >= 5 && age < 18) {
    const id = allocateId(world, 'education');
    const created = {
      id,
      characterId: actor.id,
      institutionId: 'organization-harborview-academy',
      status: 'school' as const,
      level: 'General studies',
      recordedGrade: 65,
      knowledgeGain: actor.knowledge,
      prestige: 52,
      network: 35,
      tuitionCentsPerYear: 0,
      manipulatedCredential: false,
      startedWeek: world.calendar.week,
    };
    world.education[id] = created;
    records = [...records, created];
    addFeed(world, 'education', 'School begins', `${actor.firstName} enters Harborview Academy.`, true);
  }
  if (records.length === 0) return;

  const hasActiveSecondarySchool = records.some((record) => record.status === 'school');
  for (const record of records) {
    if (record.tuitionCentsPerYear > 0) {
      const tuition = Math.round(record.tuitionCentsPerYear / 52);
      actor.cashCents = clampCents(actor.cashCents - tuition);
      addTransaction(world, 'tuition', -tuition, `${record.level} tuition`, actor.id, record.institutionId);
    }

    const partTimePostsecondary = hasActiveSecondarySchool && ['higher', 'trade'].includes(record.status);
    const loadFactor = partTimePostsecondary ? 0.5 : 1;
    const effort = actor.focuses.includes('Academics') ? 0.7 : -0.15;
    const stability = (actor.mood - actor.stress) / 240;
    record.recordedGrade = clamp(record.recordedGrade + (effort + stability + range(world, -0.6, 0.6)) * loadFactor);
    const knowledgeGrowth = Math.max(0, 0.08 + effort * 0.08 + (record.prestige - 50) / 900) * loadFactor;
    actor.knowledge = clamp(actor.knowledge + knowledgeGrowth);
    record.knowledgeGain = actor.knowledge;
    record.network = clamp(record.network + (actor.focuses.includes('Networking') ? 0.18 : 0.03) * loadFactor);

    if (age >= 18 && record.status === 'school') {
      record.status = 'completed';
      record.level = 'Secondary diploma';
      addFeed(world, 'education', 'Graduation', `${actor.firstName} graduates with a ${record.recordedGrade >= 85 ? 'strong' : record.recordedGrade >= 70 ? 'solid' : 'mixed'} record.`, true);
      continue;
    }

    if (record.startedWeek === undefined) continue;
    const programWeeks = equivalentProgramWeeks(world, actor, record.startedWeek);
    if ((record.status === 'higher' && programWeeks >= 208) || (record.status === 'trade' && programWeeks >= 104)) {
      record.status = 'completed';
      addFeed(world, 'education', 'Program completed', `${actor.firstName} completes ${record.level}.`, true);
    }
  }
}

function processHealthAndRelationships(world: WorldState): void {
  const actor = player(world);
  if (!actor.isAlive) return;
  const age = playerAgeYears(world);
  const healthFocus = actor.focuses.includes('Health') ? 0.16 : -0.03;
  const aging = age < 45 ? 0.01 : (age - 42) / 1700;
  actor.health = clamp(actor.health + healthFocus - aging - actor.stress / 16_000 + range(world, -0.22, 0.18));
  actor.stress = clamp(actor.stress + (actor.focuses.includes('Family') ? -0.08 : 0.02) + range(world, -0.25, 0.25));
  actor.mood = clamp(actor.mood + (actor.health - 55) / 1500 - actor.stress / 2600 + range(world, -0.18, 0.18));
  actor.fitness = clamp(actor.fitness + healthFocus * 0.5 - aging * 0.8);

  for (const relationship of Object.values(world.relationships)) {
    if (!relationship.characterIds.includes(actor.id)) continue;
    const otherId = relationship.characterIds[0] === actor.id ? relationship.characterIds[1] : relationship.characterIds[0];
    const other = world.characters[otherId];
    if (!other?.isAlive) continue;
    const familyFocus = actor.focuses.includes('Family') || actor.focuses.includes('Partner');
    const drift = familyFocus ? 0.05 : -0.045;
    relationship.affection = clamp(relationship.affection + drift + range(world, -0.08, 0.08));
    relationship.trust = clamp(relationship.trust + drift * 0.45 + (actor.ethics - 50) / 12_000);
    relationship.resentment = clamp(relationship.resentment - drift * 0.3 + (familyFocus ? -0.015 : 0.035));
  }

  for (const character of Object.values(world.characters)) {
    if (!character.isAlive || character.id === actor.id) continue;
    if (!shouldSimulateNpcThisWeek(world, character)) continue;
    const characterAge = Math.max(0, Math.floor((world.calendar.week - character.birthWeek) / 52));
    const characterAging = characterAge < 45 ? 0.004 : (characterAge - 42) / 2400;
    character.health = clamp(character.health - characterAging + range(world, -0.09, 0.07));
    character.mood = clamp(character.mood + range(world, -0.08, 0.08));
    const mortality = characterAge < 55 ? 0.000008 : Math.min(0.16, 0.00006 * Math.exp((characterAge - 55) / 10)) * (1.2 - character.health / 190);
    if (characterAge < 112 && roll(world) >= mortality) continue;
    character.isAlive = false;
    character.deathWeek = world.calendar.week;
    if (character.partnerId) {
      const survivingPartner = world.characters[character.partnerId];
      if (survivingPartner?.partnerId === character.id) delete survivingPartner.partnerId;
      delete character.partnerId;
    }
    if (world.dynasty.activeHeirId === character.id) delete world.dynasty.activeHeirId;
    if ([...actor.parentIds, ...actor.childIds, actor.partnerId].includes(character.id)) addFeed(world, 'family', `${character.firstName} ${character.lastName} died`, 'Their relationships, memories, ownership history, and influence remain part of the world.', true);
  }

  const deathRisk = age < 55 ? 0.000015 : Math.min(0.2, 0.00008 * Math.exp((age - 55) / 10)) * (1.25 - actor.health / 180);
  if (age >= 110 || roll(world) < deathRisk) {
    actor.isAlive = false;
    actor.deathWeek = world.calendar.week;
    createDeathEvent(world, actor);
  }
}

function processPoliticsAndLegal(world: WorldState): void {
  const actor = player(world);
  const politics = world.politics[actor.id];
  if (politics?.campaign) {
    politics.campaign.weeksRemaining -= 1;
    const spend = Math.min(politics.campaign.fundsCents, 45_000);
    politics.campaign.fundsCents -= spend;
    politics.campaign.support = clamp(
      politics.campaign.support + spend / 350_000 + actor.charisma / 1100 + actor.reputation.political / 1500 - politics.campaign.opposition / 3000 + range(world, -0.7, 0.7),
    );
    if (politics.campaign.weeksRemaining <= 0 && !hasUnresolvedTemplate(world, 'politics.election')) {
      addEvent(world, {
        templateId: 'politics.election',
        domain: 'politics',
        severity: 'S4',
        title: 'Election day',
        narrative: `The campaign for ${politics.campaign.office} reaches the voters. Your coalition, record, and the local mood now meet the final count.`,
        choices: [
          { id: 'accept-result', label: 'Receive the result', detail: 'Let the count resolve from the campaign state.' },
        ],
        participantIds: [],
        otherActionFamilies: [],
      });
    }
  }

  for (const exposure of Object.values(world.exposures)) {
    if (exposure.resolved || exposure.discovered) continue;
    const ageFactor = Math.min(2, (world.calendar.week - exposure.createdWeek) / 260 + 0.2);
    if (roll(world) < (exposure.discoverability / 100) * ageFactor * 0.0015) {
      exposure.discovered = true;
      const caseId = allocateId(world, 'case');
      world.legalCases[caseId] = {
        id: caseId,
        characterId: exposure.characterId,
        exposureId: exposure.id,
        stage: 'investigation',
        counselQuality: 35,
        risk: clamp(exposure.evidence * 0.7 + exposure.severity * 0.3),
      };
      addEvent(world, {
        templateId: 'legal.investigation',
        domain: 'legal',
        severity: 'S4',
        title: 'An investigation opens',
        narrative: 'Authorities have connected an old decision to new evidence. The matter now threatens money, reputation, and any public role.',
        choices: [
          { id: 'hire-counsel', label: 'Hire experienced counsel', detail: 'Spend for a stronger defense and prepare to respond.' },
          { id: 'cooperate', label: 'Cooperate', detail: 'Reduce obstruction risk while accepting exposure.' },
          { id: 'contest', label: 'Contest the case', detail: 'Protect your position, with higher cost and uncertainty.' },
        ],
        participantIds: [actor.id],
        otherActionFamilies: ['legal'],
        explanation: explain('The investigation came from accumulated evidence and the chance that it would be discovered over time.', [
          { label: 'Evidence trail', impact: exposure.evidence >= 60 ? 'negative' : 'neutral', detail: `Evidence strength is ${Math.round(exposure.evidence)} out of 100.` },
          { label: 'Discoverability', impact: exposure.discoverability >= 50 ? 'negative' : 'neutral', detail: 'Visible decisions are more likely to resurface.' },
          { label: 'Time elapsed', impact: 'negative', detail: 'Unresolved exposure remained in the world instead of disappearing.' },
        ]),
      });
      for (const childId of actor.childIds) {
        const relationship = Object.values(world.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(childId));
        if (!relationship) continue;
        relationship.trust = clamp(relationship.trust - exposure.severity * 0.08);
        relationship.resentment = clamp(relationship.resentment + exposure.severity * 0.06);
      }
    }
  }
}

function hasUnresolvedTemplate(world: WorldState, templateId: string): boolean {
  return world.events.some((event) => event.templateId === templateId && !event.resolved);
}

function addEvent(
  world: WorldState,
  event: Omit<GameEvent, 'id' | 'week' | 'resolved'>,
): GameEvent {
  const created: GameEvent = {
    ...event,
    id: allocateId(world, 'event'),
    week: world.calendar.week,
    resolved: false,
  };
  world.events.push(created);
  return created;
}

function maybeGenerateEvent(world: WorldState): GameEvent | undefined {
  const actor = player(world);
  if (!actor.isAlive) return world.events.find((event) => !event.resolved);
  const age = playerAgeYears(world);
  const career = Object.values(world.careers).find((item) => item.characterId === actor.id && item.active);
  const overloaded = Object.values(world.businesses).find((business) => business.active && !business.delegated && business.demand > business.capacity * 1.2);
  const neglectedProperty = Object.values(world.properties).find((property) => property.ownerId === actor.id && property.condition < 42);

  if (overloaded && !hasUnresolvedTemplate(world, 'business.capacity')) {
    return addEvent(world, {
      templateId: 'business.capacity',
      domain: 'business',
      severity: 'S3',
      title: 'Growth is breaking capacity',
      narrative: `${overloaded.name} has more demand than it can fulfill. Delays are beginning to hurt quality and trust.`,
      choices: [
        { id: 'hire', label: 'Hire ahead of demand', detail: 'Add people and capacity, increasing near-term costs.' },
        { id: 'raise-price', label: 'Raise prices', detail: 'Slow demand and protect margins, risking some customers.' },
        { id: 'reduce-marketing', label: 'Ease marketing', detail: 'Give operations room to recover.' },
        { id: 'delegate', label: 'Hire an operator', detail: 'Spend more, but reduce your own weekly burden.' },
      ],
      participantIds: [actor.id, overloaded.organizationId],
      otherActionFamilies: ['business'],
    });
  }
  if (neglectedProperty && !hasUnresolvedTemplate(world, 'property.condition')) {
    return addEvent(world, {
      templateId: 'property.condition',
      domain: 'property',
      severity: 'S2',
      title: 'Maintenance is no longer optional',
      narrative: `${neglectedProperty.name} needs material repairs. Delaying may preserve cash now but risks the tenant relationship and future value.`,
      choices: [
        { id: 'repair', label: 'Repair it properly', detail: 'Restore condition at a meaningful cash cost.' },
        { id: 'patch', label: 'Make a temporary repair', detail: 'Spend less now; the underlying risk remains.' },
        { id: 'sell', label: 'Prepare to sell', detail: 'Exit the asset with a condition discount.' },
      ],
      participantIds: [actor.id, neglectedProperty.id],
      otherActionFamilies: ['property'],
    });
  }
  if (career && career.weeksInRole > 52 && career.performance > 72 && world.calendar.week % 26 === 0 && !hasUnresolvedTemplate(world, 'career.promotion')) {
    return addEvent(world, {
      templateId: 'career.promotion',
      domain: 'career',
      severity: 'S3',
      title: 'A larger role opens',
      narrative: `${career.title} has gone well. Leadership offers more authority, higher pay, and a heavier workload.`,
      choices: [
        { id: 'accept', label: 'Accept the promotion', detail: 'Increase income and responsibility.' },
        { id: 'negotiate', label: 'Negotiate first', detail: 'Risk the goodwill for better terms.' },
        { id: 'decline', label: 'Decline for now', detail: 'Protect time and health without burning the bridge.' },
      ],
      participantIds: [actor.id, career.employerId],
      otherActionFamilies: ['career'],
    });
  }
  const alreadyInPostsecondary = Object.values(world.education).some((record) => record.characterId === actor.id && ['accepted', 'higher', 'trade'].includes(record.status));
  if (age === 18 && !alreadyInPostsecondary && world.calendar.week % 13 === 0 && !hasUnresolvedTemplate(world, 'education.next-step')) {
    return addEvent(world, {
      templateId: 'education.next-step',
      domain: 'education',
      severity: 'S3',
      title: 'Choose what comes after school',
      narrative: 'Work, university, and trade training each open different networks, costs, and paths. None guarantees success.',
      choices: [
        { id: 'university', label: 'Apply to university', detail: 'Take on cost for credentials, knowledge, and a wider network.' },
        { id: 'trade', label: 'Enter trade training', detail: 'Build practical skill with earlier earnings.' },
        { id: 'work', label: 'Work full time', detail: 'Build experience and cash without tuition.' },
        { id: 'business', label: 'Try a small business', detail: 'Take an uncertain early entrepreneurial path.' },
      ],
      participantIds: [actor.id],
      otherActionFamilies: ['education', 'career', 'business'],
    });
  }
  const partner = actor.partnerId ? world.characters[actor.partnerId] : undefined;
  if (partner?.isAlive && eventIsAgeEligible('family.new-child', age) && actor.childIds.length < 4 && roll(world) < 0.0014 && !hasUnresolvedTemplate(world, 'family.next-generation')) {
    return addEvent(world, {
      templateId: 'family.next-generation',
      domain: 'family',
      severity: 'S3',
      title: 'The next generation is possible',
      narrative: `${actor.firstName} and ${partner.firstName} have reached a moment where welcoming a child could reshape time, money, relationships, and the future dynasty.`,
      choices: [
        { id: 'welcome-child', label: 'Welcome a child', detail: 'Begin a new family relationship and accept long-term care, cost, and succession consequences.' },
        { id: 'not-now', label: 'Not now', detail: 'Keep the current household path without closing the future permanently.' },
      ],
      participantIds: [actor.id, partner.id],
      otherActionFamilies: ['relationship', 'estate'],
    });
  }
  if (roll(world) < 0.0011 && !hasUnresolvedTemplate(world, 'relationship.reconnect')) {
    const relation = Object.values(world.relationships).find((item) => item.characterIds.includes(actor.id));
    if (relation) {
      const otherId = relation.characterIds.find((id) => id !== actor.id)!;
      const other = world.characters[otherId];
      return addEvent(world, {
        templateId: 'relationship.reconnect',
        domain: 'relationship',
        severity: 'S2',
        title: `${other.firstName} reaches out`,
        narrative: 'A quiet stretch has left room for a more honest conversation about where the relationship is going.',
        choices: [
          { id: 'make-time', label: 'Make time', detail: 'Invest attention and rebuild trust.' },
          { id: 'keep-distance', label: 'Keep some distance', detail: 'Protect your time; the relationship may cool.' },
        ],
        participantIds: [actor.id, other.id],
        otherActionFamilies: ['relationship'],
      });
    }
  }
  if (netWorthCents(world) > 1_000_000_000 && roll(world) < 0.002 && !hasUnresolvedTemplate(world, 'wealth.institutional')) {
    return addEvent(world, {
      templateId: 'wealth.institutional',
      domain: 'organization',
      severity: 'S3',
      title: 'Wealth is becoming an institution',
      narrative: 'Your holdings now create governance, staffing, public scrutiny, and succession problems that personal attention cannot solve alone.',
      choices: [
        { id: 'family-office', label: 'Build a family office', detail: 'Pay for disciplined management and succession planning.' },
        { id: 'stay-direct', label: 'Keep direct control', detail: 'Save fees while accepting concentration and attention risk.' },
        { id: 'philanthropy', label: 'Create a foundation', detail: 'Trade capital for public purpose, access, and obligations.' },
      ],
      participantIds: [actor.id],
      otherActionFamilies: ['organization', 'estate'],
    });
  }
  return undefined;
}

function createDeathEvent(world: WorldState, actor: Character): void {
  if (hasUnresolvedTemplate(world, 'dynasty.succession')) return;
  const heirs = actor.childIds.filter((id) => world.characters[id]?.isAlive);
  let successors = heirs.length > 0 ? heirs : Object.values(world.characters)
    .filter((candidate) => candidate.isAlive && candidate.id !== actor.id && candidate.lastName === actor.lastName)
    .sort((left, right) => right.birthWeek - left.birthWeek)
    .map((candidate) => candidate.id);
  if (successors.length === 0 && actor.partnerId && world.characters[actor.partnerId]?.isAlive) successors = [actor.partnerId];
  if (successors.length === 0) {
    const id = allocateId(world, 'character');
    const firstName = ['Avery', 'Jordan', 'Morgan', 'Quinn'][Math.floor(roll(world) * 4)];
    world.characters[id] = {
      id,
      firstName,
      lastName: actor.lastName,
      birthWeek: world.calendar.week - 30 * 52,
      isAlive: true,
      cityId: actor.cityId,
      householdId: `household-${id}`,
      parentIds: [],
      childIds: [],
      cashCents: 250_000,
      health: 78,
      mood: 62,
      stress: 28,
      discipline: 56,
      ambition: 58,
      empathy: 60,
      riskTolerance: 48,
      ethics: 65,
      knowledge: 52,
      charisma: 54,
      fitness: 58,
      focuses: ['Family', 'Job', 'Health'],
      reputation: { public: 50, business: 50, employee: 50, political: 50, professional: 50, family: 55, faction: 20 },
      detailTier: 'full',
      lastMeaningfulWeek: world.calendar.week,
    };
    const relationshipId = allocateId(world, 'relationship');
    world.relationships[relationshipId] = { id: relationshipId, characterIds: [actor.id, id], kind: 'relative', trust: 45, affection: 42, respect: 50, resentment: 5, lastInteractionWeek: world.calendar.week };
    successors = [id];
  }
  addEvent(world, {
    templateId: 'dynasty.succession',
    domain: 'dynasty',
    severity: 'S4',
    title: `${actor.firstName} ${actor.lastName} has died`,
    narrative: 'The life ends, but its obligations, ownership, relationships, and consequences remain in the world.',
    choices: successors.slice(0, 4).map((id) => ({
      id: `continue:${id}`,
      label: `Continue as ${world.characters[id].firstName}`,
      detail: heirs.includes(id) ? 'Carry the dynasty into the next generation.' : 'Continue through an eligible family successor.',
    })),
    participantIds: [actor.id, ...successors],
    otherActionFamilies: ['estate'],
  });
  addFeed(world, 'dynasty', 'A life closes', `${actor.firstName} ${actor.lastName} died at age ${playerAgeYears(world)}.`, true);
}

function thresholdForAdvance(requestedWeeks: number): number {
  if (requestedWeeks <= 1) return 1;
  if (requestedWeeks <= 4) return 2;
  return 3;
}

function autoResolveEvent(world: WorldState, event: GameEvent): void {
  const safest = event.choices.find((choice) => !['danger', 'sell'].includes(choice.tone ?? choice.id)) ?? event.choices[0];
  if (!safest) return;
  resolveEventMutable(world, event, safest.id, true);
}

export function advanceWorld(source: WorldState, requestedWeeks: number, options: AdvanceOptions = {}): AdvanceResult {
  if (!Number.isInteger(requestedWeeks) || requestedWeeks < 1 || requestedWeeks > 520) {
    throw new Error('Advance length must be an integer between 1 and 520 weeks.');
  }
  const world = cloneWorld(source);
  const startWeek = world.calendar.week;
  const startingCash = player(world).cashCents;
  const startingNetWorth = netWorthCents(world);
  const highlights: string[] = [];
  const delegatedDecisions: string[] = [];
  const missedOpportunities: string[] = [];
  const consequences: string[] = [];
  let interruptedByEventId: string | undefined;
  const interrupt = options.interrupt ?? true;

  const existing = world.events.find((event) => !event.resolved);
  if (existing && interrupt) {
    return {
      world,
      summary: {
        requestedWeeks,
        advancedWeeks: 0,
        startWeek,
        endWeek: startWeek,
        cashDeltaCents: 0,
        netWorthDeltaCents: 0,
        highlights: ['Resolve the active event before advancing.'],
        delegatedDecisions,
        missedOpportunities: ['Time is paused until the pending decision is resolved.'],
        consequences,
        interruptedByEventId: existing.id,
      },
    };
  }

  for (let step = 0; step < requestedWeeks; step += 1) {
    world.calendar.week += 1;
    world.calendar.dateISO = addWeeksISO(world.calendar.dateISO, 1);
    updateEconomy(world);
    processCareerAndHousehold(world);
    processBusinessesAndProperties(world);
    processEducation(world);
    processHealthAndRelationships(world);
    processPoliticsAndLegal(world);
    tickLifeJourney(world);
    updateBackgroundStatistics(world);
    if (world.calendar.week % 13 === 0) normalizeSimulationDetail(world);

    const event = world.events.find((item) => !item.resolved) ?? maybeGenerateEvent(world);
    if (event) {
      const rank = severityRank[event.severity];
      if (interrupt && rank >= thresholdForAdvance(requestedWeeks)) {
        interruptedByEventId = event.id;
        highlights.push(event.title);
        break;
      }
      if (options.autoResolveEvents ?? true) {
        autoResolveEvent(world, event);
        if (rank >= 2) delegatedDecisions.push(`${event.title}: ${event.selectedChoiceId ?? 'handled by standing policy'}`);
        if (rank >= 3) consequences.push(`${event.title} was handled by standing policy.`);
      }
    }
  }

  world.metadata.updatedAt = new Date().toISOString();
  const actor = player(world);
  if (world.calendar.week > startWeek && !interruptedByEventId) {
    highlights.push(`The world advanced ${world.calendar.week - startWeek} week${world.calendar.week - startWeek === 1 ? '' : 's'} in a ${world.economy.regime} economy.`);
  }
  if (actor.health < 45) highlights.push('Health needs attention.');
  if (actor.cashCents < 0) highlights.push('Liquidity is negative even if other assets still carry value.');
  if (requestedWeeks >= 13 && !actor.focuses.includes('Networking')) missedOpportunities.push('Few new professional relationships formed because Networking was not a standing focus.');
  if (requestedWeeks >= 26 && !actor.focuses.includes('Health')) consequences.push('Health and fitness received less attention during the time skip.');
  if (interruptedByEventId) missedOpportunities.push('The remaining time was not advanced because a major decision needs you.');

  return {
    world,
    summary: {
      requestedWeeks,
      advancedWeeks: world.calendar.week - startWeek,
      startWeek,
      endWeek: world.calendar.week,
      cashDeltaCents: actor.cashCents - startingCash,
      netWorthDeltaCents: netWorthCents(world) - startingNetWorth,
      highlights: highlights.slice(0, 6),
      delegatedDecisions: delegatedDecisions.slice(0, 8),
      missedOpportunities: missedOpportunities.slice(0, 5),
      consequences: consequences.slice(0, 5),
      explanation: explain('The summary reflects every simulated week, standing focuses, delegated choices, and major interruptions.', [
        { label: 'Standing focuses', impact: 'neutral', detail: actor.focuses.join(', ') },
        { label: 'Economy', impact: world.economy.regime === 'recession' ? 'negative' : world.economy.regime === 'growth' || world.economy.regime === 'boom' ? 'positive' : 'neutral', detail: `The economy ended in a ${world.economy.regime} regime.` },
        { label: 'Delegated decisions', impact: delegatedDecisions.length > 0 ? 'neutral' : 'positive', detail: delegatedDecisions.length > 0 ? `${delegatedDecisions.length} decision(s) used standing policy.` : 'No important decision was delegated.' },
      ]),
      interruptedByEventId,
    },
  };
}

function resolveEventMutable(world: WorldState, event: GameEvent, choiceId: string, delegated: boolean): void {
  const actor = player(world);
  const choice = event.choices.find((item) => item.id === choiceId);
  if (!choice) throw new Error('That choice is not available for this event.');
  event.resolved = true;
  event.selectedChoiceId = choiceId;
  resolveProjectCheckpoint(world, event, choiceId);

  switch (event.templateId) {
    case 'career.promotion': {
      const career = Object.values(world.careers).find((item) => item.characterId === actor.id && item.active);
      if (!career) break;
      if (choiceId === 'accept') {
        career.title = `Senior ${career.title}`;
        career.weeklySalaryCents = Math.round(career.weeklySalaryCents * 1.19);
        actor.stress = clamp(actor.stress + 8);
      } else if (choiceId === 'negotiate') {
        const success = roll(world) < (actor.charisma + career.performance) / 200;
        if (success) career.weeklySalaryCents = Math.round(career.weeklySalaryCents * 1.25);
        else actor.reputation.professional = clamp(actor.reputation.professional - 3);
      } else {
        actor.mood = clamp(actor.mood + 3);
      }
      break;
    }
    case 'education.next-step': {
      if (choiceId === 'university' || choiceId === 'trade') {
        const id = allocateId(world, 'education');
        world.education[id] = {
          id,
          characterId: actor.id,
          institutionId: choiceId === 'university' ? 'organization-harborview-academy' : 'organization-northstar-logistics',
          status: choiceId === 'university' ? 'higher' : 'trade',
          level: choiceId === 'university' ? 'Undergraduate program' : 'Trade apprenticeship',
          recordedGrade: 70,
          knowledgeGain: actor.knowledge,
          prestige: choiceId === 'university' ? 64 : 48,
          network: choiceId === 'university' ? 58 : 52,
          tuitionCentsPerYear: choiceId === 'university' ? 2_400_000 : 320_000,
          manipulatedCredential: false,
          startedWeek: world.calendar.week,
        };
      } else if (choiceId === 'business') {
        createStarterBusiness(world, actor);
      } else if (!Object.values(world.careers).some((career) => career.characterId === actor.id && career.active)) {
        const id = allocateId(world, 'career');
        world.careers[id] = {
          id,
          characterId: actor.id,
          employerId: 'organization-northstar-logistics',
          title: 'Operations assistant',
          sector: 'Logistics',
          weeklySalaryCents: 84_600,
          performance: 52,
          satisfaction: 58,
          weeksInRole: 0,
          active: true,
        };
      }
      break;
    }
    case 'family.next-generation': {
      if (choiceId !== 'welcome-child') break;
      const partner = actor.partnerId ? world.characters[actor.partnerId] : undefined;
      if (!partner?.isAlive) break;
      const names = ['Avery', 'Jordan', 'Casey', 'Morgan', 'Quinn', 'Rowan', 'Sage', 'Taylor'];
      const firstName = names[Math.floor(roll(world) * names.length)];
      const id = allocateId(world, 'character');
      const inherited = (left: number, right: number) => clamp((left + right) / 2 + range(world, -8, 8));
      world.characters[id] = {
        id,
        firstName,
        lastName: actor.lastName,
        birthWeek: world.calendar.week,
        isAlive: true,
        cityId: actor.cityId,
        householdId: actor.householdId,
        parentIds: [actor.id, partner.id],
        childIds: [],
        cashCents: 0,
        health: inherited(actor.health, partner.health),
        mood: 72,
        stress: 8,
        discipline: inherited(actor.discipline, partner.discipline),
        ambition: inherited(actor.ambition, partner.ambition),
        empathy: inherited(actor.empathy, partner.empathy),
        riskTolerance: inherited(actor.riskTolerance, partner.riskTolerance),
        ethics: inherited(actor.ethics, partner.ethics),
        knowledge: 2,
        charisma: inherited(actor.charisma, partner.charisma),
        fitness: inherited(actor.fitness, partner.fitness),
        focuses: ['Family', 'Health', 'Creative Work'],
        reputation: { public: 50, business: 50, employee: 50, political: 50, professional: 50, family: 60, faction: 10 },
        detailTier: 'full',
        lastMeaningfulWeek: world.calendar.week,
      };
      actor.childIds.push(id);
      partner.childIds.push(id);
      const actorRelationshipId = allocateId(world, 'relationship');
      world.relationships[actorRelationshipId] = { id: actorRelationshipId, characterIds: [actor.id, id], kind: 'child', trust: 78, affection: 90, respect: 55, resentment: 0, lastInteractionWeek: world.calendar.week };
      const partnerRelationshipId = allocateId(world, 'relationship');
      world.relationships[partnerRelationshipId] = { id: partnerRelationshipId, characterIds: [partner.id, id], kind: 'child', trust: 78, affection: 90, respect: 55, resentment: 0, lastInteractionWeek: world.calendar.week };
      world.dynasty.notableHistory.push(`${firstName} ${actor.lastName} joined the family in week ${world.calendar.week}.`);
      addFeed(world, 'family', 'A child joins the family', `${firstName} ${actor.lastName} becomes part of the continuing world.`, true);
      break;
    }
    case 'business.capacity': {
      const business = Object.values(world.businesses).find((item) => item.active && item.demand > item.capacity * 1.1);
      if (!business) break;
      if (choiceId === 'hire') {
        const hires = Math.max(1, Math.ceil(business.employees * 0.25));
        business.employees += hires;
        business.capacity += hires * 8;
        business.cashCents -= hires * 175_000;
      } else if (choiceId === 'raise-price') business.pricePosition = 'premium';
      else if (choiceId === 'reduce-marketing') business.marketingBps = Math.max(100, Math.round(business.marketingBps * 0.55));
      else business.delegated = true;
      break;
    }
    case 'property.condition': {
      const property = Object.values(world.properties).find((item) => item.ownerId === actor.id && item.condition < 50);
      if (!property) break;
      if (choiceId === 'repair') {
        const cost = Math.round(property.valueCents * 0.025);
        actor.cashCents -= cost;
        property.condition = clamp(property.condition + 38);
      } else if (choiceId === 'patch') {
        actor.cashCents -= Math.round(property.valueCents * 0.008);
        property.condition = clamp(property.condition + 12);
      } else {
        property.valueCents = Math.round(property.valueCents * 0.91);
      }
      break;
    }
    case 'relationship.reconnect': {
      const relationship = Object.values(world.relationships).find((item) => event.participantIds.every((id) => item.characterIds.includes(id)));
      if (relationship) {
        relationship.trust = clamp(relationship.trust + (choiceId === 'make-time' ? 8 : -5));
        relationship.affection = clamp(relationship.affection + (choiceId === 'make-time' ? 10 : -6));
        actor.mood = clamp(actor.mood + (choiceId === 'make-time' ? 3 : -1));
      }
      break;
    }
    case 'wealth.institutional': {
      if (choiceId === 'family-office') actor.cashCents -= 2_500_000;
      if (choiceId === 'philanthropy') {
        actor.cashCents -= 5_000_000;
        actor.reputation.public = clamp(actor.reputation.public + 8);
      }
      break;
    }
    case 'legal.investigation': {
      const legalCase = Object.values(world.legalCases).find((item) => item.characterId === actor.id && item.stage !== 'resolved');
      if (!legalCase) break;
      if (choiceId === 'hire-counsel') {
        const affordableQuality = clamp(Math.log10(Math.max(100, actor.cashCents / 100)) * 12, 35, 92);
        const cost = Math.min(actor.cashCents, Math.round(affordableQuality * 28_000));
        actor.cashCents -= cost;
        legalCase.counselQuality = affordableQuality;
        legalCase.risk = clamp(legalCase.risk - affordableQuality * 0.2);
      } else if (choiceId === 'cooperate') legalCase.risk = clamp(legalCase.risk - 12);
      else legalCase.risk = clamp(legalCase.risk + range(world, -6, 9));
      legalCase.stage = legalCase.risk > 58 ? 'charged' : 'resolved';
      if (legalCase.stage === 'resolved') legalCase.outcome = choiceId === 'cooperate' ? 'settled' : 'dismissed';
      break;
    }
    case 'politics.election': {
      const politics = world.politics[actor.id];
      if (!politics?.campaign) break;
      const winChance = clamp((politics.campaign.support - politics.campaign.opposition + actor.reputation.political) / 160, 0.08, 0.92);
      const won = roll(world) < winChance;
      if (won) {
        politics.office = politics.campaign.office;
        politics.officeLevel = politics.campaign.office.toLowerCase().includes('national') ? 'national' : 'local';
        politics.authority = politics.officeLevel === 'national' ? 72 : 38;
        politics.approval = 53;
        actor.reputation.political = clamp(actor.reputation.political + 12);
      } else actor.reputation.political = clamp(actor.reputation.political + 2);
      const electionExplanation = explain(won ? 'The campaign assembled enough support to win.' : 'The campaign did not assemble enough support to win.', [
        { label: 'Campaign support', impact: politics.campaign.support >= politics.campaign.opposition ? 'positive' : 'negative', detail: `Support ${Math.round(politics.campaign.support)} versus opposition ${Math.round(politics.campaign.opposition)}.` },
        { label: 'Political reputation', impact: actor.reputation.political >= 60 ? 'positive' : actor.reputation.political < 40 ? 'negative' : 'neutral', detail: `Political reputation was ${Math.round(actor.reputation.political)}.` },
        { label: 'Uncertainty', impact: 'neutral', detail: 'Elections retain uncertainty even with a strong coalition.' },
      ]);
      event.explanation = electionExplanation;
      addFeed(world, 'politics', won ? 'Election victory' : 'The campaign falls short', won ? `Voters chose ${actor.firstName} for ${politics.campaign.office}. Governing begins now.` : 'The coalition was not enough this time, but its relationships and reputation remain.', true, electionExplanation);
      politics.campaign = undefined;
      break;
    }
    case 'dynasty.succession': {
      const successorId = choiceId.startsWith('continue:') ? choiceId.slice('continue:'.length) : undefined;
      const successor = successorId ? world.characters[successorId] : undefined;
      if (successor?.isAlive) {
        const estateValue = netWorthCents(world, actor.id);
        const inheritedCash = actor.cashCents;
        actor.cashCents = 0;
        successor.cashCents = clampCents(successor.cashCents + inheritedCash);
        for (const property of Object.values(world.properties)) if (property.ownerId === actor.id) property.ownerId = successor.id;
        for (const holding of Object.values(world.holdings)) if (holding.ownerId === actor.id) holding.ownerId = successor.id;
        for (const liability of Object.values(world.liabilities)) if (liability.debtorId === actor.id) liability.debtorId = successor.id;
        for (const business of Object.values(world.businesses)) {
          if ((business.ownerId ?? business.founderId) !== actor.id || business.playerOwnershipBps <= 0) continue;
          business.ownerId = successor.id;
          const organization = world.organizations[business.organizationId];
          if (organization) {
            if (!organization.memberIds.includes(successor.id)) organization.memberIds.push(successor.id);
            if (organization.leaderId === actor.id) organization.leaderId = successor.id;
          }
        }
        addTransaction(world, 'inheritance', inheritedCash, `Estate of ${actor.firstName} ${actor.lastName}`, actor.id, successor.id);
        world.playerCharacterId = successor.id;
        world.dynasty.activeHeirId = successor.id;
        world.dynasty.generation += 1;
        world.metadata.generation = world.dynasty.generation;
        world.metadata.displayName = `${successor.firstName} ${successor.lastName} · Generation ${world.dynasty.generation}`;
        world.dynasty.notableHistory.push(`${actor.firstName} ${actor.lastName} died; ${successor.firstName} continued the legacy with an estate valued at ${(estateValue / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.`);
      }
      break;
    }
    default:
      break;
  }
  addFeed(world, event.domain, choice.label, delegated ? `Handled by standing policy: ${choice.detail}` : choice.detail, event.severity === 'S3' || event.severity === 'S4');
}

function createStarterBusiness(world: WorldState, actor: Character): Business {
  const capital = Math.max(0, Math.min(actor.cashCents, 500_000));
  actor.cashCents -= capital;
  const organizationId = allocateId(world, 'organization');
  const businessId = allocateId(world, 'business');
  world.organizations[organizationId] = {
    id: organizationId,
    kind: 'business',
    name: `${actor.lastName} Services`,
    resourcesCents: capital,
    influence: 12,
    stability: 48,
    memberIds: [actor.id],
    leaderId: actor.id,
    history: ['Founded with personal savings.'],
  };
  const business: Business = {
    id: businessId,
    organizationId,
    name: `${actor.lastName} Services`,
    sector: 'Local services',
    cityId: actor.cityId,
    founderId: actor.id,
    ownerId: actor.id,
    cashCents: capital,
    debtCents: 0,
    revenueWeeklyCents: 0,
    costWeeklyCents: 0,
    valuationCents: Math.max(250_000, capital),
    playerOwnershipBps: 10_000,
    votingControlBps: 10_000,
    employees: 1,
    capacity: 10,
    demand: 6,
    quality: 58,
    reputation: 38,
    marketingBps: 600,
    pricePosition: 'market',
    growthPosture: 'balanced',
    delegated: false,
    active: true,
  };
  world.businesses[businessId] = business;
  return business;
}

export function resolveEvent(source: WorldState, eventId: string, choiceId: string): WorldState {
  const world = cloneWorld(source);
  const event = world.events.find((item) => item.id === eventId && !item.resolved);
  if (!event) throw new Error('The event is no longer active.');
  resolveEventMutable(world, event, choiceId, false);
  world.metadata.updatedAt = new Date().toISOString();
  return world;
}

export function getActiveEvent(world: WorldState): GameEvent | undefined {
  return world.events.find((event) => !event.resolved);
}

export function activityLevel(world: WorldState, weeks: number): 'LOW' | 'MODERATE' | 'HIGH' {
  const actor = player(world);
  const activeBusinesses = Object.values(world.businesses).filter((business) => business.active && !business.delegated).length;
  const cases = Object.values(world.legalCases).filter((legalCase) => legalCase.stage !== 'resolved').length;
  const campaign = world.politics[actor.id]?.campaign ? 1 : 0;
  const workload = activeBusinesses * 2 + cases * 3 + campaign * 3 + (actor.stress > 70 ? 2 : 0) + (actor.health < 45 ? 3 : 0);
  const horizon = weeks >= 26 ? 2 : weeks >= 13 ? 1 : 0;
  return workload + horizon >= 5 ? 'HIGH' : workload + horizon >= 2 ? 'MODERATE' : 'LOW';
}
