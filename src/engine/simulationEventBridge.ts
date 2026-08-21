import { resolveNarrativeEvent } from './narrativeDepth';
import { resolveEvent as resolveBaseEvent } from './simulation';
import type { WorldState } from './types';

/**
 * OTA-safe event consequence bridge. The core simulator owns generic event
 * resolution; this bridge layers on newer continuity behavior without forcing
 * a native release or duplicating the original event engine.
 */
export function resolveEvent(source: WorldState, eventId: string, choiceId: string): WorldState {
  const event = source.events.find((item) => item.id === eventId && !item.resolved);
  const world = resolveBaseEvent(source, eventId, choiceId);
  if (!event) return world;

  if (event.templateId === 'relationship.reconnect') {
    const relationship = Object.values(world.relationships).find((item) => event.participantIds.every((id) => item.characterIds.includes(id)));
    if (relationship) relationship.lastInteractionWeek = world.calendar.week;
  }

  if (event.templateId.startsWith('story.')) resolveNarrativeEvent(world, event, choiceId, false);
  return world;
}
