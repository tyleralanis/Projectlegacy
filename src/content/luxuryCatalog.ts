import type { LicenseKind, PersonalAssetCategory } from '@/engine/types';

export interface LuxuryCatalogItem {
  id: string;
  category: PersonalAssetCategory;
  name: string;
  priceCents: number;
  weeklyUpkeepCents: number;
  annualChangeBps: number;
  minimumAge: number;
  requiredLicense?: LicenseKind;
  pilotAnnualCostCents?: number;
  note: string;
}

export const LUXURY_CATALOG: LuxuryCatalogItem[] = [
  { id: 'car-used-sedan', category: 'car', name: 'Used sedan', priceCents: 1_800_000, weeklyUpkeepCents: 3_500, annualChangeBps: -1_500, minimumAge: 16, requiredLicense: 'driver', note: 'Cheap transportation. Still needs insurance, fuel, and upkeep.' },
  { id: 'car-luxury-sedan', category: 'car', name: 'Luxury sedan', priceCents: 9_500_000, weeklyUpkeepCents: 16_000, annualChangeBps: -1_000, minimumAge: 16, requiredLicense: 'driver', note: 'Comfortable, expensive, and not an investment.' },
  { id: 'car-sports', category: 'car', name: 'Sports car', priceCents: 18_000_000, weeklyUpkeepCents: 25_000, annualChangeBps: -1_200, minimumAge: 16, requiredLicense: 'driver', note: 'Fast, loud, and costly to keep around.' },
  { id: 'car-supercar', category: 'car', name: 'Exotic supercar', priceCents: 45_000_000, weeklyUpkeepCents: 60_000, annualChangeBps: -900, minimumAge: 18, requiredLicense: 'driver', note: 'A serious status purchase with serious upkeep.' },

  { id: 'aircraft-piston', category: 'aircraft', name: 'Single-engine aircraft', priceCents: 45_000_000, weeklyUpkeepCents: 85_000, annualChangeBps: -500, minimumAge: 18, requiredLicense: 'private-pilot', pilotAnnualCostCents: 12_000_000, note: 'Fly it yourself with a pilot license or hire a pilot.' },
  { id: 'aircraft-turboprop', category: 'aircraft', name: 'Executive turboprop', priceCents: 450_000_000, weeklyUpkeepCents: 400_000, annualChangeBps: -400, minimumAge: 18, requiredLicense: 'private-pilot', pilotAnnualCostCents: 18_000_000, note: 'Fast regional travel with meaningful operating costs.' },
  { id: 'aircraft-light-jet', category: 'aircraft', name: 'Light jet', priceCents: 900_000_000, weeklyUpkeepCents: 1_000_000, annualChangeBps: -600, minimumAge: 18, requiredLicense: 'private-pilot', pilotAnnualCostCents: 22_000_000, note: 'Private jet convenience without long-range jet scale.' },
  { id: 'aircraft-long-range', category: 'aircraft', name: 'Long-range jet', priceCents: 7_000_000_000, weeklyUpkeepCents: 5_000_000, annualChangeBps: -500, minimumAge: 18, requiredLicense: 'private-pilot', pilotAnnualCostCents: 30_000_000, note: 'Global range. The carrying cost is part of the purchase.' },

  { id: 'collectible-watch', category: 'collectible', name: 'Vintage watch', priceCents: 2_500_000, weeklyUpkeepCents: 500, annualChangeBps: 100, minimumAge: 18, note: 'Collectible value can hold up, but nothing is guaranteed.' },
  { id: 'collectible-art', category: 'collectible', name: 'Fine art piece', priceCents: 7_500_000, weeklyUpkeepCents: 1_500, annualChangeBps: 200, minimumAge: 18, note: 'A collectible with storage, insurance, and market risk.' },
  { id: 'collectible-books', category: 'collectible', name: 'Rare book collection', priceCents: 4_000_000, weeklyUpkeepCents: 600, annualChangeBps: 50, minimumAge: 18, note: 'Quiet status. Value depends on the collector market.' },
  { id: 'collectible-memorabilia', category: 'collectible', name: 'Historic memorabilia collection', priceCents: 12_000_000, weeklyUpkeepCents: 1_500, annualChangeBps: 150, minimumAge: 18, note: 'Scarcity can help value, but buyers are not always easy to find.' },

  { id: 'jewelry-watch', category: 'jewelry', name: 'Fine watch', priceCents: 1_500_000, weeklyUpkeepCents: 200, annualChangeBps: -200, minimumAge: 18, note: 'Mostly a personal purchase.' },
  { id: 'jewelry-diamond', category: 'jewelry', name: 'Diamond jewelry', priceCents: 5_000_000, weeklyUpkeepCents: 500, annualChangeBps: -300, minimumAge: 18, note: 'High purchase price does not mean high resale value.' },
  { id: 'jewelry-high', category: 'jewelry', name: 'High jewelry piece', priceCents: 25_000_000, weeklyUpkeepCents: 1_000, annualChangeBps: -100, minimumAge: 18, note: 'A major luxury purchase with insurance and storage costs.' },
];

export function luxuryItem(id: string): LuxuryCatalogItem | undefined {
  return LUXURY_CATALOG.find((item) => item.id === id);
}
