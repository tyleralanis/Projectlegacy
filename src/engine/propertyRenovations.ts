import type { PropertyAsset } from './types';

export interface PropertyRenovationOption {
  id: string;
  label: string;
  detail: string;
  costCents: number;
  conditionGain: number;
  valueReturnBps: number;
}

function inferredKind(property: Pick<PropertyAsset, 'kind' | 'name'>): PropertyAsset['kind'] {
  const name = property.name.toLowerCase();
  if (/retail|strip|office|commercial|storefront/.test(name)) return 'commercial';
  if (/condo/.test(name)) return 'condo';
  if (/duplex|apartment|unit/.test(name)) return 'multifamily';
  if (/estate|manor/.test(name)) return 'estate';
  if (/house|home|three-bedroom|single/.test(name)) return 'single-family';
  if (/parcel|land|acre|lot/.test(name)) return 'land';
  return property.kind;
}

function scaled(property: Pick<PropertyAsset, 'valueCents'>, minimumCents: number, share: number): number {
  return Math.max(minimumCents, Math.round(property.valueCents * share));
}

export function renovationOptionsForProperty(property: PropertyAsset): PropertyRenovationOption[] {
  const kind = inferredKind(property);

  if (kind === 'commercial') return [
    { id: 'parking-lot', label: 'Resurface parking lot', detail: 'Fresh pavement, striping, and repairs.', costCents: 2_500_000, conditionGain: 7, valueReturnBps: 7000 },
    { id: 'facade', label: 'Refresh storefront & facade', detail: 'Exterior finishes, signage, and curb appeal.', costCents: scaled(property, 3_500_000, 0.015), conditionGain: 8, valueReturnBps: 7600 },
    { id: 'lighting-security', label: 'Upgrade lighting & security', detail: 'Parking, entrances, cameras, and exterior lighting.', costCents: 1_800_000, conditionGain: 5, valueReturnBps: 6200 },
    { id: 'commercial-mechanical', label: 'Upgrade HVAC & common systems', detail: 'Mechanical systems and shared building infrastructure.', costCents: scaled(property, 4_500_000, 0.018), conditionGain: 10, valueReturnBps: 6800 },
  ];

  if (kind === 'multifamily') return [
    { id: 'unit-refresh', label: 'Refresh units', detail: 'Flooring, paint, fixtures, and worn interiors.', costCents: scaled(property, 3_000_000, 0.018), conditionGain: 9, valueReturnBps: 7800 },
    { id: 'common-areas', label: 'Update common areas', detail: 'Hallways, entries, landscaping, and shared spaces.', costCents: 2_500_000, conditionGain: 6, valueReturnBps: 6800 },
    { id: 'laundry-security', label: 'Add laundry & security upgrades', detail: 'Resident amenities, access control, and cameras.', costCents: 1_800_000, conditionGain: 5, valueReturnBps: 7200 },
    { id: 'multifamily-mechanical', label: 'Replace major building systems', detail: 'Roof, plumbing, electrical, or HVAC work.', costCents: scaled(property, 4_000_000, 0.025), conditionGain: 13, valueReturnBps: 6400 },
  ];

  if (kind === 'land' || kind === 'development') return [
    { id: 'grading-drainage', label: 'Improve grading & drainage', detail: 'Site work that makes the parcel easier to use.', costCents: 1_500_000, conditionGain: 6, valueReturnBps: 6500 },
    { id: 'utilities-access', label: 'Bring in utilities & access', detail: 'Road access and utility preparation.', costCents: 4_000_000, conditionGain: 9, valueReturnBps: 7600 },
    { id: 'site-clearing', label: 'Clear & prepare the site', detail: 'Clearing, cleanup, and basic site preparation.', costCents: 2_000_000, conditionGain: 7, valueReturnBps: 6800 },
  ];

  if (kind === 'estate') return [
    { id: 'estate-pool', label: 'Add a pool & outdoor area', detail: 'Pool, hardscape, and upgraded backyard.', costCents: 5_000_000, conditionGain: 7, valueReturnBps: 7200 },
    { id: 'estate-landscape', label: 'Redo landscaping & grounds', detail: 'Trees, lighting, irrigation, and exterior spaces.', costCents: 3_000_000, conditionGain: 6, valueReturnBps: 6500 },
    { id: 'estate-kitchen', label: 'Remodel the kitchen', detail: 'Cabinetry, counters, appliances, and finishes.', costCents: scaled(property, 6_000_000, 0.018), conditionGain: 8, valueReturnBps: 7000 },
    { id: 'guest-house', label: 'Add a guest house', detail: 'A major residential addition.', costCents: 15_000_000, conditionGain: 10, valueReturnBps: 8000 },
  ];

  if (kind === 'condo') return [
    { id: 'condo-interior', label: 'Refresh floors & finishes', detail: 'Flooring, paint, lighting, and interior finishes.', costCents: 1_200_000, conditionGain: 7, valueReturnBps: 6900 },
    { id: 'condo-kitchen', label: 'Remodel the kitchen', detail: 'Cabinetry, counters, appliances, and finishes.', costCents: scaled(property, 1_800_000, 0.022), conditionGain: 8, valueReturnBps: 7200 },
    { id: 'condo-bath', label: 'Remodel the bathroom', detail: 'Fixtures, tile, plumbing trim, and finishes.', costCents: scaled(property, 1_200_000, 0.014), conditionGain: 6, valueReturnBps: 7000 },
  ];

  return [
    { id: 'house-kitchen', label: 'Remodel the kitchen', detail: 'Cabinetry, counters, appliances, and finishes.', costCents: scaled(property, 1_800_000, 0.022), conditionGain: 8, valueReturnBps: 7200 },
    { id: 'house-bath', label: 'Remodel a bathroom', detail: 'Fixtures, tile, plumbing trim, and finishes.', costCents: scaled(property, 1_200_000, 0.014), conditionGain: 6, valueReturnBps: 7000 },
    { id: 'house-pool', label: 'Add a backyard pool', detail: 'Pool, deck, and basic outdoor upgrades.', costCents: 5_000_000, conditionGain: 6, valueReturnBps: 6600 },
    { id: 'house-exterior', label: 'Upgrade exterior & landscaping', detail: 'Paint, landscaping, lighting, and curb appeal.', costCents: 1_500_000, conditionGain: 7, valueReturnBps: 6500 },
  ];
}
