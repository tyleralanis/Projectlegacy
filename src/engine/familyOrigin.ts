import type { Character } from './types';

import { WORLD_CONTENT } from '@/content/worldContent';

export type FamilyWealthTier = 'strained' | 'working' | 'stable' | 'comfortable' | 'affluent';
export type FamilyClimate = 'close' | 'warm' | 'demanding' | 'complicated' | 'distant';

interface PersonSeed {
  firstName: string;
  cashCents: number;
  professionId?: string;
  overrides: Partial<Character>;
}

export interface FamilyOrigin {
  wealthTier: FamilyWealthTier;
  climate: FamilyClimate;
  label: string;
  detail: string;
  playerAdultCashCents: number;
  parentOne: PersonSeed;
  parentTwo: PersonSeed;
  sibling: PersonSeed & { ageGapYears: number };
  friend: PersonSeed & { lastName: string; ageGapYears: number };
  relationships: {
    parentOne: { trust: number; affection: number; respect: number; resentment: number };
    parentTwo: { trust: number; affection: number; respect: number; resentment: number };
    sibling: { trust: number; affection: number; respect: number; resentment: number };
    friend: { trust: number; affection: number; respect: number; resentment: number };
  };
}

const firstNames = ['Jonah', 'Elena', 'Marcus', 'Nia', 'Theo', 'Camila', 'Priya', 'Miles', 'Sofia', 'Darius', 'Mina', 'Quinn', 'Avery', 'Maya', 'Jordan', 'Noah', 'Leila', 'Andre', 'Grace', 'Elias'];
const siblingNames = ['Mara', 'Rowan', 'Casey', 'Jules', 'Noa', 'Sage', 'Tessa', 'Eli', 'Morgan', 'Parker', 'Remy', 'June'];
const friendFirstNames = ['Riley', 'Avery', 'Jordan', 'Nora', 'Cameron', 'Maya', 'Eli', 'Quinn', 'Sofia', 'Theo', 'Sam', 'Mina'];
const friendLastNames = ['Chen', 'Brooks', 'Patel', 'Nguyen', 'Rivera', 'Bennett', 'Okafor', 'Kim', 'Morgan', 'Price', 'Shah', 'Alvarez'];

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function unit(seed: string, key: string): number {
  return (hash(`${seed}:${key}`) % 1_000_003) / 1_000_003;
}

function pick<T>(items: readonly T[], seed: string, key: string): T {
  return items[Math.floor(unit(seed, key) * items.length) % items.length];
}

function between(seed: string, key: string, minimum: number, maximum: number): number {
  return minimum + unit(seed, key) * (maximum - minimum);
}

function trait(seed: string, key: string, center: number, spread = 18): number {
  return Math.max(18, Math.min(94, center + between(seed, key, -spread, spread)));
}

function professionPool() {
  const practical = WORLD_CONTENT.professions.filter((profession) => profession.minimumAge <= 25 && !/chief|vice president|vp|surgeon|director/i.test(profession.title));
  return practical.length > 0 ? practical : WORLD_CONTENT.professions;
}

function wealthTier(seed: string): FamilyWealthTier {
  const value = unit(seed, 'wealth-tier');
  if (value < 0.13) return 'strained';
  if (value < 0.37) return 'working';
  if (value < 0.72) return 'stable';
  if (value < 0.93) return 'comfortable';
  return 'affluent';
}

function climate(seed: string): FamilyClimate {
  const value = unit(seed, 'family-climate');
  if (value < 0.18) return 'close';
  if (value < 0.48) return 'warm';
  if (value < 0.68) return 'demanding';
  if (value < 0.88) return 'complicated';
  return 'distant';
}

function cashRange(tier: FamilyWealthTier): [number, number] {
  switch (tier) {
    case 'strained': return [120_000, 850_000];
    case 'working': return [650_000, 2_500_000];
    case 'stable': return [2_000_000, 7_500_000];
    case 'comfortable': return [6_000_000, 24_000_000];
    case 'affluent': return [20_000_000, 90_000_000];
  }
}

function adultCashRange(tier: FamilyWealthTier): [number, number] {
  switch (tier) {
    case 'strained': return [50_000, 350_000];
    case 'working': return [150_000, 850_000];
    case 'stable': return [500_000, 1_800_000];
    case 'comfortable': return [1_200_000, 4_500_000];
    case 'affluent': return [3_000_000, 12_000_000];
  }
}

function relationshipFor(seed: string, key: string, familyClimate: FamilyClimate, baseOffset = 0) {
  const centers: Record<FamilyClimate, [number, number, number, number]> = {
    close: [84, 88, 76, 4],
    warm: [74, 80, 70, 8],
    demanding: [65, 67, 72, 20],
    complicated: [57, 63, 58, 28],
    distant: [43, 48, 50, 34],
  };
  const [trust, affection, respect, resentment] = centers[familyClimate];
  return {
    trust: Math.max(20, Math.min(96, Math.round(trust + baseOffset + between(seed, `${key}:trust`, -8, 8)))),
    affection: Math.max(20, Math.min(98, Math.round(affection + baseOffset + between(seed, `${key}:affection`, -8, 8)))),
    respect: Math.max(20, Math.min(96, Math.round(respect + baseOffset + between(seed, `${key}:respect`, -9, 9)))),
    resentment: Math.max(0, Math.min(70, Math.round(resentment - baseOffset * 0.5 + between(seed, `${key}:resentment`, -5, 7)))),
  };
}

function parent(seed: string, key: string, name: string, tier: FamilyWealthTier, professionId: string, personality: 'steady' | 'driven'): PersonSeed {
  const [minimumCash, maximumCash] = cashRange(tier);
  const driven = personality === 'driven';
  return {
    firstName: name,
    cashCents: Math.round(between(seed, `${key}:cash`, minimumCash, maximumCash)),
    professionId,
    overrides: {
      discipline: trait(seed, `${key}:discipline`, driven ? 67 : 61),
      ambition: trait(seed, `${key}:ambition`, driven ? 70 : 55),
      empathy: trait(seed, `${key}:empathy`, driven ? 56 : 69),
      riskTolerance: trait(seed, `${key}:risk`, driven ? 55 : 42),
      ethics: trait(seed, `${key}:ethics`, 69),
      knowledge: trait(seed, `${key}:knowledge`, tier === 'affluent' || tier === 'comfortable' ? 66 : 55),
      charisma: trait(seed, `${key}:charisma`, 57),
      fitness: trait(seed, `${key}:fitness`, 57),
      health: trait(seed, `${key}:health`, 78, 10),
      mood: trait(seed, `${key}:mood`, 65, 12),
      stress: trait(seed, `${key}:stress`, tier === 'strained' ? 52 : 34, 14),
      focuses: driven ? ['Job', 'Family', 'Health'] : ['Family', 'Health', 'Job'],
      professionId,
    },
  };
}

export function generateFamilyOrigin(seed: string): FamilyOrigin {
  const tier = wealthTier(seed);
  const familyClimate = climate(seed);
  const pool = professionPool();
  const professionOne = pick(pool, seed, 'parent-one-profession');
  let professionTwo = pick(pool, seed, 'parent-two-profession');
  if (professionTwo.id === professionOne.id && pool.length > 1) professionTwo = pool[(pool.indexOf(professionTwo) + 1) % pool.length];

  const parentOneName = pick(firstNames, seed, 'parent-one-name');
  let parentTwoName = pick(firstNames, seed, 'parent-two-name');
  if (parentTwoName === parentOneName) parentTwoName = firstNames[(firstNames.indexOf(parentTwoName) + 3) % firstNames.length];
  const siblingName = pick(siblingNames, seed, 'sibling-name');
  const friendName = pick(friendFirstNames, seed, 'friend-name');
  const friendLast = pick(friendLastNames, seed, 'friend-last');
  const [adultMinimum, adultMaximum] = adultCashRange(tier);

  const labels: Record<FamilyWealthTier, string> = {
    strained: 'A household watching every dollar',
    working: 'A working household with little slack',
    stable: 'A stable middle-income household',
    comfortable: 'A comfortable household with options',
    affluent: 'An affluent household with early advantages',
  };
  const climateDetails: Record<FamilyClimate, string> = {
    close: 'The family is unusually close and reliable, which creates support as well as expectations.',
    warm: 'The family is broadly supportive without being frictionless.',
    demanding: 'Love and pressure live in the same house; achievement carries emotional weight.',
    complicated: 'There is real affection, but old friction and inconsistent trust are already part of the family story.',
    distant: 'The household functions, but emotional distance means support cannot be assumed.',
  };

  return {
    wealthTier: tier,
    climate: familyClimate,
    label: labels[tier],
    detail: `${labels[tier]}. ${climateDetails[familyClimate]} ${parentOneName} works as ${professionOne.title.toLowerCase()}, while ${parentTwoName} works as ${professionTwo.title.toLowerCase()}.`,
    playerAdultCashCents: Math.round(between(seed, 'adult-starting-cash', adultMinimum, adultMaximum)),
    parentOne: parent(seed, 'parent-one', parentOneName, tier, professionOne.id, unit(seed, 'parent-one-drive') > 0.5 ? 'driven' : 'steady'),
    parentTwo: parent(seed, 'parent-two', parentTwoName, tier, professionTwo.id, unit(seed, 'parent-two-drive') > 0.5 ? 'driven' : 'steady'),
    sibling: {
      firstName: siblingName,
      cashCents: Math.round(between(seed, 'sibling-cash', 0, Math.max(250_000, cashRange(tier)[1] * 0.08))),
      professionId: undefined,
      ageGapYears: 1 + Math.floor(unit(seed, 'sibling-gap') * 7),
      overrides: {
        discipline: trait(seed, 'sibling-discipline', 54),
        ambition: trait(seed, 'sibling-ambition', 62),
        empathy: trait(seed, 'sibling-empathy', 60),
        riskTolerance: trait(seed, 'sibling-risk', 52),
        knowledge: trait(seed, 'sibling-knowledge', 46),
        charisma: trait(seed, 'sibling-charisma', 57),
        fitness: trait(seed, 'sibling-fitness', 58),
      },
    },
    friend: {
      firstName: friendName,
      lastName: friendLast,
      cashCents: Math.round(between(seed, 'friend-cash', 80_000, 1_800_000)),
      professionId: undefined,
      ageGapYears: 1 + Math.floor(unit(seed, 'friend-gap') * 5),
      overrides: {
        ambition: trait(seed, 'friend-ambition', 60),
        empathy: trait(seed, 'friend-empathy', 64),
        knowledge: trait(seed, 'friend-knowledge', 52),
        charisma: trait(seed, 'friend-charisma', 62),
        riskTolerance: trait(seed, 'friend-risk', 52),
        focuses: ['Creative Work', 'Networking', 'Health'],
      },
    },
    relationships: {
      parentOne: relationshipFor(seed, 'relationship-parent-one', familyClimate, 0),
      parentTwo: relationshipFor(seed, 'relationship-parent-two', familyClimate, 2),
      sibling: relationshipFor(seed, 'relationship-sibling', familyClimate, -7),
      friend: relationshipFor(seed, 'relationship-friend', familyClimate === 'distant' ? 'warm' : familyClimate, -6),
    },
  };
}
