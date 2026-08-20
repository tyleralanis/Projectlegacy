import type { MoneyCents, WorldState } from './types';

export function toCents(amount: number): MoneyCents {
  if (!Number.isFinite(amount)) {
    throw new Error('Money amount must be finite.');
  }
  return Math.round(amount * 100);
}

export function clampCents(amount: number): MoneyCents {
  if (!Number.isFinite(amount)) return 0;
  return Math.max(-9_000_000_000_000_000, Math.min(9_000_000_000_000_000, Math.round(amount)));
}

export function formatMoney(amountCents: MoneyCents, compact = false): string {
  const amount = amountCents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(amount);
}

export function holdingValueCents(world: WorldState, ownerId: string): MoneyCents {
  return Object.values(world.holdings)
    .filter((holding) => holding.ownerId === ownerId)
    .reduce((total, holding) => {
      const security = world.securities[holding.securityId];
      return total + (security ? Math.round((holding.unitsMilli * security.priceCents) / 1000) : 0);
    }, 0);
}

export function netWorthCents(world: WorldState, characterId = world.playerCharacterId): MoneyCents {
  const character = world.characters[characterId];
  if (!character) return 0;
  const propertyEquity = Object.values(world.properties)
    .filter((property) => property.ownerId === characterId)
    .reduce((total, property) => total + property.valueCents - property.debtCents, 0);
  const businessEquity = Object.values(world.businesses)
    .filter((business) => (business.ownerId ?? business.founderId) === characterId && business.active)
    .reduce((total, business) => total + Math.round((business.valuationCents * business.playerOwnershipBps) / 10_000), 0);
  const liabilities = Object.values(world.liabilities)
    .filter((liability) => liability.debtorId === characterId && !liability.securedById)
    .reduce((total, liability) => total + liability.principalCents, 0);
  return clampCents(character.cashCents + propertyEquity + businessEquity + holdingValueCents(world, characterId) - liabilities);
}
