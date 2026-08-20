import { allocateId, playerAgeYears } from './createWorld';
import { recordHistory } from './history';
import type { Business, WorldState } from './types';

export type DeveloperCommand =
  | { kind: 'jump-age'; years: number }
  | { kind: 'inject-money'; amountCents: number }
  | { kind: 'create-company'; name?: string }
  | { kind: 'change-country'; countryId: string }
  | { kind: 'force-recession' }
  | { kind: 'trigger-divorce' }
  | { kind: 'kill-character'; characterId: string };

export interface DeveloperCommandResult {
  world: WorldState;
  message: string;
}

export function runDeveloperCommand(input: WorldState, command: DeveloperCommand): DeveloperCommandResult {
  const world = JSON.parse(JSON.stringify(input)) as WorldState;
  const actor = world.characters[world.playerCharacterId];
  switch (command.kind) {
    case 'jump-age': {
      const years = Math.max(1, Math.min(100, Math.round(command.years)));
      world.calendar.week += years * 52;
      recordHistory(world, 'life', 'Developer age jump', `QA advanced ${actor.firstName} from age ${playerAgeYears(input)} to ${playerAgeYears(world)}.`, { importance: 1 });
      return { world, message: `Jumped ${years} years.` };
    }
    case 'inject-money':
      actor.cashCents += Math.max(0, Math.round(command.amountCents));
      return { world, message: 'Injected test funds.' };
    case 'create-company': {
      const id = allocateId(world, 'business');
      const organizationId = allocateId(world, 'organization');
      world.organizations[organizationId] = { id: organizationId, kind: 'business', name: command.name ?? 'QA Company', resourcesCents: 5_000_000, influence: 10, stability: 60, memberIds: [actor.id], leaderId: actor.id, history: ['Created from the developer menu.'] };
      const business: Business = { id, organizationId, name: command.name ?? 'QA Company', sector: 'Professional Services', cityId: actor.cityId, founderId: actor.id, ownerId: actor.id, cashCents: 5_000_000, debtCents: 0, revenueWeeklyCents: 0, costWeeklyCents: 0, valuationCents: 5_000_000, playerOwnershipBps: 10_000, votingControlBps: 10_000, employees: 1, capacity: 24, demand: 12, quality: 55, reputation: 50, marketingBps: 300, pricePosition: 'market', growthPosture: 'balanced', delegated: false, active: true };
      world.businesses[id] = business;
      return { world, message: `${business.name} created.` };
    }
    case 'change-country':
      if (!world.countries[command.countryId]) throw new Error('Unknown test country.');
      world.activeCountryId = command.countryId;
      return { world, message: `Country changed to ${world.countries[command.countryId].name}.` };
    case 'force-recession':
      world.economy.growth = -0.055;
      world.economy.regime = 'recession';
      world.economy.unemployment = Math.max(world.economy.unemployment, 0.11);
      return { world, message: 'A recession is active.' };
    case 'trigger-divorce': {
      if (!actor.partnerId) throw new Error('The active character has no partner.');
      const partner = world.characters[actor.partnerId];
      delete partner.partnerId;
      delete actor.partnerId;
      recordHistory(world, 'family', 'Marriage ended', `${actor.firstName} and ${partner.firstName} divorced during a QA scenario.`, { important: true, category: 'relationship', subjectIds: [actor.id, partner.id] });
      return { world, message: 'Divorce triggered.' };
    }
    case 'kill-character': {
      const character = world.characters[command.characterId];
      if (!character) throw new Error('Unknown character.');
      character.isAlive = false;
      character.deathWeek = world.calendar.week;
      recordHistory(world, 'family', `${character.firstName} ${character.lastName} died`, 'The developer menu forced this outcome for QA.', { important: true, category: 'death', subjectIds: [character.id] });
      return { world, message: `${character.firstName} is now deceased.` };
    }
  }
}

export function inspectNpcMemory(world: WorldState, characterId: string): string[] {
  return Object.values(world.memories)
    .filter((memory) => memory.participantIds.includes(characterId))
    .sort((a, b) => b.week - a.week)
    .map((memory) => `Week ${memory.week}: ${memory.narrative}`);
}
