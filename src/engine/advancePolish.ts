import { normalizeDelegatedWorld } from './delegationNormalize';
import { recordHistory } from './history';
import { netWorthCents } from './money';
import { advanceWorld } from './simulation';
import type { AdvanceResult, GameEvent, Organization, WorldState } from './types';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function capacityBusiness(world: WorldState, event: GameEvent) {
  return Object.values(world.businesses).find((business) => business.active && event.participantIds.includes(business.organizationId));
}

function snoozePrefix(businessId: string): string {
  return `capacity-warning-snooze:${businessId}:`;
}

function snoozeUntil(org: Organization | undefined, businessId: string): number {
  const prefix = snoozePrefix(businessId);
  const raw = org?.history.find((entry) => entry.startsWith(prefix))?.slice(prefix.length);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function setSnooze(org: Organization | undefined, businessId: string, week: number): void {
  if (!org) return;
  const prefix = snoozePrefix(businessId);
  const index = org.history.findIndex((entry) => entry.startsWith(prefix));
  const value = `${prefix}${week}`;
  if (index >= 0) org.history[index] = value;
  else org.history.push(value);
}

function isRoutineCapacityEvent(event: GameEvent | undefined): event is GameEvent {
  return event?.templateId === 'business.capacity';
}

function capacityWarningIsSnoozed(world: WorldState, event: GameEvent): boolean {
  const business = capacityBusiness(world, event);
  if (!business) return false;
  return world.calendar.week < snoozeUntil(world.organizations[business.organizationId], business.id);
}

function ignoreCapacityWarning(source: WorldState, eventId: string, snooze = false): { world: WorldState; businessName?: string } {
  const world = clone(source);
  const event = world.events.find((item) => item.id === eventId && !item.resolved);
  if (!event || event.templateId !== 'business.capacity') return { world };
  const business = capacityBusiness(world, event);
  event.resolved = true;
  event.selectedChoiceId = 'ignore';
  if (!business) return { world };

  // The base weekly business model already caps fulfilled demand at capacity and
  // erodes quality/reputation while overloaded. Skipping the decision adds a
  // small extra service-recovery penalty, but never silently delegates control.
  const overload = business.demand / Math.max(1, business.capacity);
  const pressure = Math.max(0, overload - 1);
  business.quality = clamp(business.quality - Math.min(1.8, 0.2 + pressure * 1.35));
  business.reputation = clamp(business.reputation - Math.min(1.1, 0.1 + pressure * 0.8));
  if (snooze) setSnooze(world.organizations[business.organizationId], business.id, world.calendar.week + 4);
  return { world, businessName: business.name };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/**
 * Capacity pressure is important enough to surface, but it is not a modal wall.
 * The first warning can interrupt normally. If the player presses Advance again
 * instead of choosing a response, that is itself a decision: keep operating,
 * accept the service/quality damage, and suppress repeat warnings for four weeks.
 * Delegated companies are normalized before simulation so a real CEO never hands
 * routine capacity work back to the owner.
 */
export function advanceWorldWithOptionalCapacityDecisions(source: WorldState, requestedWeeks: number): AdvanceResult {
  const requested = Math.max(0, Math.round(requestedWeeks));
  const startWeek = source.calendar.week;
  const startingCash = source.characters[source.playerCharacterId].cashCents;
  const startingWorth = netWorthCents(source);
  let world = normalizeDelegatedWorld(source);
  let skipCapacityForThisAdvance = false;
  const ignoredCounts = new Map<string, number>();
  const highlights: string[] = [];
  const delegatedDecisions: string[] = [];
  const missedOpportunities: string[] = [];
  const consequences: string[] = [];
  let explanation: AdvanceResult['summary']['explanation'];
  let interruptedByEventId: string | undefined;

  const existing = world.events.find((event) => !event.resolved);
  if (isRoutineCapacityEvent(existing)) {
    const ignored = ignoreCapacityWarning(world, existing.id, true);
    world = ignored.world;
    skipCapacityForThisAdvance = true;
    if (ignored.businessName) ignoredCounts.set(ignored.businessName, 1);
  }

  let safety = 0;
  while (world.calendar.week - startWeek < requested && safety < requested + 80) {
    safety += 1;
    const remaining = requested - (world.calendar.week - startWeek);
    const result = advanceWorld(world, remaining, { interrupt: true, autoResolveEvents: true });
    world = result.world;
    highlights.push(...result.summary.highlights);
    delegatedDecisions.push(...result.summary.delegatedDecisions);
    missedOpportunities.push(...result.summary.missedOpportunities.filter((item) => !item.includes('remaining time was not advanced') && !item.includes('Time is paused')));
    consequences.push(...result.summary.consequences);
    explanation = result.summary.explanation ?? explanation;

    const interruptionId = result.summary.interruptedByEventId;
    if (!interruptionId) break;
    const event = world.events.find((item) => item.id === interruptionId && !item.resolved);
    if (!isRoutineCapacityEvent(event)) {
      interruptedByEventId = interruptionId;
      break;
    }

    const snoozed = capacityWarningIsSnoozed(world, event);
    if (!skipCapacityForThisAdvance && !snoozed) {
      // Surface the first unsnoozed capacity warning. Pressing Advance again is
      // how the player explicitly chooses to ignore it and keep time moving.
      interruptedByEventId = interruptionId;
      break;
    }

    const ignored = ignoreCapacityWarning(world, event.id, skipCapacityForThisAdvance);
    world = ignored.world;
    if (ignored.businessName) ignoredCounts.set(ignored.businessName, (ignoredCounts.get(ignored.businessName) ?? 0) + 1);
  }

  for (const [businessName, count] of ignoredCounts) {
    consequences.push(`${businessName} operated through ${count} unresolved capacity warning${count === 1 ? '' : 's'}. Unfilled demand and service strain reduced quality and reputation.`);
    const business = Object.values(world.businesses).find((item) => item.name === businessName && item.active);
    if (business) {
      recordHistory(world, 'business', `${businessName} kept operating through capacity pressure`, `You advanced time without making the routine capacity decision. The company kept operating, absorbed service strain, and will not interrupt again for the same pressure for several weeks.`, { subjectIds: [business.id], importance: count >= 4 ? 3 : 2 });
    }
  }

  const advancedWeeks = Math.max(0, world.calendar.week - startWeek);
  if (advancedWeeks > 0 && !interruptedByEventId) highlights.push(`The world advanced ${advancedWeeks} week${advancedWeeks === 1 ? '' : 's'} without forcing a routine capacity decision.`);

  return {
    world,
    summary: {
      requestedWeeks: requested,
      advancedWeeks,
      startWeek,
      endWeek: world.calendar.week,
      cashDeltaCents: world.characters[world.playerCharacterId].cashCents - startingCash,
      netWorthDeltaCents: netWorthCents(world) - startingWorth,
      highlights: unique(highlights).slice(0, 12),
      delegatedDecisions: unique(delegatedDecisions).slice(0, 12),
      missedOpportunities: unique(missedOpportunities).slice(0, 12),
      consequences: unique(consequences).slice(0, 12),
      explanation,
      interruptedByEventId,
    },
  };
}
