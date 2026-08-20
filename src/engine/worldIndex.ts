import { allocateId } from './createWorld';
import type { FavoriteEntityType, WorldState } from './types';

export interface WorldSearchResult {
  type: FavoriteEntityType;
  id: string;
  title: string;
  subtitle: string;
  week?: number;
  pinned: boolean;
}

export function searchWorld(world: WorldState, rawQuery: string): WorldSearchResult[] {
  const query = rawQuery.trim().toLocaleLowerCase();
  const matches = (text: string) => !query || text.toLocaleLowerCase().includes(query);
  const pinned = new Set(world.favorites.map((favorite) => `${favorite.entityType}:${favorite.entityId}`));
  const results: WorldSearchResult[] = [];
  for (const character of Object.values(world.characters)) {
    const title = `${character.firstName} ${character.lastName}`;
    if (matches(title)) results.push({ type: 'character', id: character.id, title, subtitle: character.isAlive ? character.professionId?.replace('profession-', '') ?? 'Person' : 'Deceased', pinned: pinned.has(`character:${character.id}`) });
  }
  for (const business of Object.values(world.businesses)) if (matches(`${business.name} ${business.sector}`)) results.push({ type: 'business', id: business.id, title: business.name, subtitle: `${business.sector} · ${business.employees.toLocaleString()} employees`, pinned: pinned.has(`business:${business.id}`) });
  for (const property of Object.values(world.properties)) if (matches(`${property.name} ${property.kind}`)) results.push({ type: 'property', id: property.id, title: property.name, subtitle: property.kind, pinned: pinned.has(`property:${property.id}`) });
  for (const organization of Object.values(world.organizations)) if (matches(`${organization.name} ${organization.kind}`)) results.push({ type: 'organization', id: organization.id, title: organization.name, subtitle: organization.kind, pinned: pinned.has(`organization:${organization.id}`) });
  for (const country of Object.values(world.countries)) if (matches(country.name)) results.push({ type: 'country', id: country.id, title: country.name, subtitle: `${country.population.toLocaleString()} people`, pinned: pinned.has(`country:${country.id}`) });
  for (const event of world.timeline) if (matches(`${event.title} ${event.detail}`)) results.push({ type: 'event', id: event.id, title: event.title, subtitle: event.detail, week: event.week, pinned: pinned.has(`event:${event.id}`) });
  return results.sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.week ?? -1) - (a.week ?? -1)).slice(0, 200);
}

export function toggleFavorite(world: WorldState, entityType: FavoriteEntityType, entityId: string, label: string): boolean {
  const index = world.favorites.findIndex((favorite) => favorite.entityType === entityType && favorite.entityId === entityId);
  if (index >= 0) {
    world.favorites.splice(index, 1);
    return false;
  }
  world.favorites.unshift({ id: allocateId(world, 'favorite'), entityType, entityId, label, pinnedAtWeek: world.calendar.week });
  return true;
}
