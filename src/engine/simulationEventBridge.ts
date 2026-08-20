import { resolveEvent as resolveBaseEvent } from './simulation';
import type { WorldState } from './types';

/**
 * Small OTA-safe event consequence bridge. The core reconnect event already
 * adjusts trust and affection; this makes the interaction itself authoritative
 * too so the same neglected relationship cannot immediately create another
 * reach-out after the player has just answered it.
 */
export function resolveEvent(source: WorldState, eventId: string, choiceId: string): WorldState {
  const event = source.events.find((item) => item.id === eventId && !item.resolved);
  const world = resolveBaseEvent(source, eventId, choiceId);
  if (event?.templateId === 'relationship.reconnect') {
    const relationship = Object.values(world.relationships).find((item) => event.participantIds.every((id) => item.characterIds.includes(id)));
    if (relationship) relationship.lastInteractionWeek = world.calendar.week;
  }
  return world;
}
