import { allocateId } from './createWorld';
import { recordHistory } from './history';
import type { WorldState } from './types';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/**
 * Existing TestFlight saves can already contain a capacity or maintenance
 * interruption created before delegation became authoritative. Normalize those
 * saves on load so a CEO/property manager starts doing their job immediately
 * instead of requiring the player to clear one last obsolete routine event.
 */
export function normalizeDelegatedWorld(source: WorldState): WorldState {
  const world = clone(source);
  const actor = world.characters[world.playerCharacterId];
  if (!actor) return world;

  const ownedProperties = Object.values(world.properties).filter((property) => property.ownerId === actor.id);
  if (ownedProperties.some((property) => property.managed)) ownedProperties.forEach((property) => { property.managed = true; });

  // Some older saves retained the hired executive metadata and active CEO career
  // but lost the delegated boolean. Reconstruct that authoritative state instead
  // of making the owner handle routine operating decisions again. A deliberate
  // CEO firing deletes the manager metadata, so it is not accidentally undone.
  for (const business of Object.values(world.businesses)) {
    if (!business.active || business.delegated || (business.ownerId ?? business.founderId) !== actor.id) continue;
    if (!business.managerName || !business.managerQuality) continue;
    const organization = world.organizations[business.organizationId];
    const executiveId = organization?.leaderId;
    const activeExecutiveCareer = executiveId
      ? Object.values(world.careers).some((career) => career.active && career.characterId === executiveId && career.employerId === business.organizationId && /ceo|chief executive/i.test(career.title))
      : false;
    if (!executiveId || executiveId === actor.id || !activeExecutiveCareer) continue;
    business.delegated = true;
    recordHistory(world, 'business', `${business.managerName} resumed operating authority`, 'The save still contained a hired CEO and active executive role, so day-to-day delegation was restored instead of routing routine company decisions back to the owner.', { subjectIds: [business.id, executiveId], importance: 1 });
  }

  for (const event of world.events.filter((item) => !item.resolved)) {
    if (event.templateId === 'business.capacity') {
      const business = Object.values(world.businesses).find((item) => item.active && item.delegated && event.participantIds.includes(item.organizationId));
      if (!business) continue;
      event.resolved = true;
      event.selectedChoiceId = 'delegate';
      business.capacity = Math.max(business.capacity, Math.ceil(business.demand * (business.managerQuality && business.managerQuality >= 80 ? 1.2 : 1.08)));
      recordHistory(world, 'business', `${business.managerName ?? 'The CEO'} took the operating decision`, 'An existing routine capacity interruption was handed back to management. Future staffing and capacity work belongs to the CEO while delegation remains active.', { subjectIds: [business.id], importance: 1 });
    }

    if (event.templateId === 'property.condition') {
      const property = event.participantIds.map((id) => world.properties[id]).find((item) => item?.ownerId === actor.id && item.managed);
      if (!property) continue;
      const budget = Math.max(0, Math.min(actor.cashCents, Math.round(property.valueCents * 0.006)));
      if (budget > 0) {
        actor.cashCents -= budget;
        property.condition = clamp(property.condition + 16);
        world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'property-repair', amountCents: -budget, fromId: actor.id, toId: property.id, memo: `Manager-arranged maintenance at ${property.name}` });
      }
      event.resolved = true;
      event.selectedChoiceId = budget > 0 ? 'patch' : 'manager-reviewed';
      recordHistory(world, 'property', `Management reviewed ${property.name}`, budget > 0 ? `The portfolio manager arranged ${Math.round(budget / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} of maintenance without asking you to clear a routine event.` : 'The property manager cleared the routine interruption, but the asset still needs funding before condition can materially improve.', { subjectIds: [property.id], importance: budget > 0 ? 1 : 2 });
    }
  }

  return world;
}