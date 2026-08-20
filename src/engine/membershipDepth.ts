import { allocateId } from './createWorld';
import type { ActionResult, IntentAction, WorldState } from './types';

const GYM_COST_CENTS = 78_000;
const GYM_DURATION_WEEKS = 52;
const MARKER_PREFIX = 'gym-membership:';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function ok(world: WorldState, message: string): ActionResult {
  return { world, message, validation: { valid: true, requiresConfirmation: false } };
}

function membershipOrganization(world: WorldState) {
  const actor = world.characters[world.playerCharacterId];
  return Object.values(world.organizations).find((organization) => organization.kind === 'club' && organization.memberIds.includes(actor.id) && organization.history.some((entry) => entry.startsWith(MARKER_PREFIX)));
}

export function executeMembershipDepth(source: WorldState, action: IntentAction): ActionResult | null {
  if (action.verb !== 'health.cancel_gym_membership') return null;
  const organization = membershipOrganization(source);
  if (!organization) return { world: source, message: 'There is no active gym membership to cancel.', validation: { valid: false, reason: 'No active gym membership.', requiresConfirmation: false } };
  const world = clone(source);
  const next = world.organizations[organization.id];
  const markerIndex = next.history.findIndex((entry) => entry.startsWith(MARKER_PREFIX));
  if (markerIndex >= 0) next.history.splice(markerIndex, 1);
  next.history.push(`Gym auto-renewal canceled in week ${world.calendar.week}.`);
  return ok(world, 'The gym membership is canceled. Current access ends now and there will be no automatic renewal charge.');
}

/**
 * Gym membership is annual and auto-renewing while affordable. A long jump can
 * cross more than one service year, so every renewal boundary is charged rather
 * than collapsing several years into one fee. If cash is unavailable at a
 * boundary, membership lapses instead of driving personal cash negative.
 */
export function applyMembershipAdvance(before: WorldState, after: WorldState): WorldState {
  const weeks = Math.max(0, after.calendar.week - before.calendar.week);
  if (weeks <= 0) return after;
  const organization = membershipOrganization(after);
  if (!organization) return after;
  const world = clone(after);
  const actor = world.characters[world.playerCharacterId];
  const next = world.organizations[organization.id];
  const markerIndex = next.history.findIndex((entry) => entry.startsWith(MARKER_PREFIX));
  if (markerIndex < 0) return after;
  const parts = next.history[markerIndex].split(':');
  let serviceStart = Number(parts[1] ?? before.calendar.week);
  const duration = Math.max(1, Number(parts[2] ?? GYM_DURATION_WEEKS));
  if (!Number.isFinite(serviceStart)) serviceStart = before.calendar.week;
  let boundary = serviceStart + duration;
  let renewed = 0;

  while (boundary <= world.calendar.week) {
    if (actor.cashCents < GYM_COST_CENTS) {
      next.history.splice(markerIndex, 1);
      next.history.push(`Gym membership lapsed in week ${boundary} because the annual ${GYM_COST_CENTS / 100} dollar renewal was not affordable.`);
      return world;
    }
    actor.cashCents -= GYM_COST_CENTS;
    world.transactions.push({
      id: allocateId(world, 'transaction'),
      week: boundary,
      kind: 'wellness-membership',
      amountCents: -GYM_COST_CENTS,
      fromId: actor.id,
      toId: next.id,
      memo: 'Annual gym membership renewal',
    });
    next.resourcesCents += GYM_COST_CENTS;
    serviceStart = boundary;
    boundary += duration;
    renewed += 1;
  }

  if (renewed > 0) {
    next.history[markerIndex] = `${MARKER_PREFIX}${serviceStart}:${duration}`;
    next.history.push(`Gym membership renewed ${renewed} time${renewed === 1 ? '' : 's'} through week ${serviceStart + duration}.`);
  }
  return world;
}
