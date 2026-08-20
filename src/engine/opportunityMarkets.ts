import { playerAgeYears } from './createWorld';
import type { Business, WorldState } from './types';

import { WORLD_CONTENT } from '@/content/worldContent';

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function unit(seed: string): number {
  return (hash(seed) % 1_000_003) / 1_000_003;
}

function actorSkill(world: WorldState, key: string): number {
  const actor = world.characters[world.playerCharacterId];
  switch (key) {
    case 'publicSpeaking': return actor.charisma * 0.68 + actor.knowledge * 0.32;
    case 'leadership': return actor.ambition * 0.52 + actor.charisma * 0.34 + actor.discipline * 0.14;
    case 'management': return actor.discipline * 0.52 + actor.knowledge * 0.34 + actor.charisma * 0.14;
    case 'finance': return actor.knowledge * 0.66 + actor.discipline * 0.34;
    case 'academics': return actor.knowledge;
    case 'social': return actor.charisma * 0.72 + actor.empathy * 0.28;
    case 'negotiation': return actor.charisma * 0.55 + actor.knowledge * 0.3 + actor.discipline * 0.15;
    default: return actor.knowledge;
  }
}

export function playerTimeLoad(world: WorldState): number {
  const actor = world.characters[world.playerCharacterId];
  let load = 0;
  if (Object.values(world.careers).some((career) => career.characterId === actor.id && career.active)) load += 44;
  if (Object.values(world.education).some((record) => record.characterId === actor.id && ['higher', 'trade'].includes(record.status))) load += 32;
  for (const business of Object.values(world.businesses)) {
    if (!business.active || (business.ownerId ?? business.founderId) !== actor.id || business.playerOwnershipBps <= 0) continue;
    const organization = world.organizations[business.organizationId];
    const outsideLeader = organization?.leaderId && organization.leaderId !== actor.id;
    load += outsideLeader ? 7 : business.delegated ? 16 : 38;
  }
  if (world.politics[actor.id]?.campaign) load += 24;
  if (world.politics[actor.id]?.office) load += 28;
  return Math.round(load);
}

export interface JobListing {
  id: string;
  professionId: string;
  employerId: string;
  employerName: string;
  title: string;
  sector: string;
  weeklySalaryCents: number;
  fitScore: number;
  eligible: boolean;
  missing: string[];
}

const EMPLOYERS = [
  'Bluebird Systems', 'Hearth & Harbor', 'Northstar Logistics', 'Juniper Health', 'Cedar Bank',
  'Tidewater Works', 'Brightline Legal', 'Foxglove Retail', 'Lantern Labs', 'Commonwealth Partners',
  'Mosaic Infrastructure', 'Goodwell Services', 'Pioneer Freight', 'Sunroom Media', 'Evergreen Holdings',
];

export function jobListings(world: WorldState): JobListing[] {
  const actor = world.characters[world.playerCharacterId];
  const age = playerAgeYears(world);
  const bucket = world.calendar.week;
  const completedHigher = Object.values(world.education).some((record) => record.characterId === actor.id && record.status === 'completed' && record.level !== 'Secondary diploma');
  const experienceWeeks = Object.values(world.careers).filter((career) => career.characterId === actor.id).reduce((total, career) => total + career.weeksInRole, 0);
  const shuffled = [...WORLD_CONTENT.professions].sort((left, right) => hash(`${world.metadata.worldSeed}:${bucket}:${left.id}`) - hash(`${world.metadata.worldSeed}:${bucket}:${right.id}`));
  return shuffled.slice(0, 8).map((profession, index) => {
    const requiredDegree = profession.requiredDegree;
    const skill = actorSkill(world, profession.skillKey);
    const missing: string[] = [];
    if (age < profession.minimumAge) missing.push(`Age ${profession.minimumAge}+`);
    if (requiredDegree && !completedHigher) missing.push('College or equivalent credential');
    if (actor.knowledge < profession.minKnowledge) missing.push(`Knowledge ${profession.minKnowledge}+`);
    if (experienceWeeks < profession.minExperienceWeeks) missing.push(`${Math.ceil(profession.minExperienceWeeks / 52)}y relevant experience`);
    if (actor.reputation.professional < profession.minReputation) missing.push(`Professional reputation ${profession.minReputation}+`);
    if (skill < profession.minSkill) missing.push(`${profession.skillKey.replace(/([A-Z])/g, ' $1')} ${profession.minSkill}+`);
    const fitScore = Math.max(0, Math.min(100,
      actor.knowledge * 0.26 + actor.reputation.professional * 0.23 + skill * 0.27 + Math.min(100, experienceWeeks / 4) * 0.18 + actor.charisma * 0.06,
    ));
    const employerName = EMPLOYERS[(hash(`${world.metadata.worldSeed}:${bucket}:employer:${index}`) + index) % EMPLOYERS.length];
    const salaryNoise = 0.93 + unit(`${world.metadata.worldSeed}:${bucket}:${profession.id}:salary`) * 0.18;
    return {
      id: `job-${bucket}-${profession.id}`,
      professionId: profession.id,
      employerId: `organization-employer-${hash(employerName).toString(36)}`,
      employerName,
      title: profession.title,
      sector: profession.sector,
      weeklySalaryCents: Math.round(profession.weeklySalaryCents * salaryNoise),
      fitScore: Math.round(fitScore),
      eligible: missing.length === 0,
      missing,
    };
  });
}

export interface PropertyListing {
  id: string;
  name: string;
  cityId: string;
  cityName: string;
  kind: 'condo' | 'single-family' | 'multifamily' | 'commercial' | 'land';
  valueCents: number;
  downPaymentCents: number;
  weeklyRentCents: number;
  condition: number;
  capRate: number;
}

const PROPERTY_NAMES = ['Maple Court', 'Lantern House', 'Seabreeze Flats', 'Juniper Row', 'Foundry Lofts', 'Cedar Plaza', 'North Pier', 'Willow Offices', 'Market Street Shops', 'Meadow Parcel'];
const PROPERTY_KINDS: PropertyListing['kind'][] = ['condo', 'single-family', 'multifamily', 'commercial', 'land'];

export function propertyListings(world: WorldState): PropertyListing[] {
  const month = Math.floor(world.calendar.week / 4);
  const currentCity = world.characters[world.playerCharacterId].cityId;
  const cities = [...WORLD_CONTENT.cities].sort((a, b) => (a.id === currentCity ? -1 : b.id === currentCity ? 1 : hash(`${month}:${a.id}`) - hash(`${month}:${b.id}`))).slice(0, 4);
  return Array.from({ length: 10 }, (_, index) => {
    const city = cities[index % cities.length];
    const kind = PROPERTY_KINDS[(hash(`${world.metadata.worldSeed}:${month}:kind:${index}`) + index) % PROPERTY_KINDS.length];
    const base = kind === 'land' ? 9_000_000 : kind === 'condo' ? 18_000_000 : kind === 'single-family' ? 32_000_000 : kind === 'multifamily' ? 58_000_000 : 110_000_000;
    const sizeFactor = 0.72 + unit(`${world.metadata.worldSeed}:${month}:size:${index}`) * 1.45;
    const valueCents = Math.round(base * sizeFactor * city.housingIndex / 100 * world.economy.housingIndex / 100);
    const capRate = kind === 'commercial' ? 0.065 + unit(`${month}:cap:${index}`) * 0.035 : kind === 'multifamily' ? 0.05 + unit(`${month}:cap:${index}`) * 0.03 : 0.035 + unit(`${month}:cap:${index}`) * 0.025;
    const weeklyRentCents = kind === 'land' ? 0 : Math.round(valueCents * capRate / 52);
    return {
      id: `listing-${month}-${index}`,
      name: `${PROPERTY_NAMES[index % PROPERTY_NAMES.length]}${kind === 'commercial' ? ' Commercial' : ''}`,
      cityId: city.id,
      cityName: city.name,
      kind,
      valueCents,
      downPaymentCents: Math.round(valueCents * (kind === 'commercial' ? 0.3 : 0.2)),
      weeklyRentCents,
      condition: Math.round(55 + unit(`${month}:condition:${index}`) * 42),
      capRate,
    };
  });
}

export interface ExecutiveCandidate {
  id: string;
  firstName: string;
  lastName: string;
  salaryWeeklyCents: number;
  management: number;
  leadership: number;
  finance: number;
  sectorFit: number;
  fitScore: number;
}

const FIRST_NAMES = ['Avery', 'Jordan', 'Morgan', 'Nia', 'Theo', 'Camila', 'Priya', 'Miles', 'Sofia', 'Darius', 'Quinn', 'Mina'];
const LAST_NAMES = ['Bennett', 'Shah', 'Ortega', 'Kim', 'Wallace', 'Nguyen', 'Patel', 'Brooks', 'Alvarez', 'Foster', 'Okafor', 'Chen'];

export function executiveCandidates(world: WorldState, business: Business): ExecutiveCandidate[] {
  const bucket = world.calendar.week;
  return Array.from({ length: 5 }, (_, index) => {
    const management = Math.round(48 + unit(`${business.id}:${bucket}:m:${index}`) * 49);
    const leadership = Math.round(45 + unit(`${business.id}:${bucket}:l:${index}`) * 52);
    const finance = Math.round(38 + unit(`${business.id}:${bucket}:f:${index}`) * 58);
    const sectorFit = Math.round(35 + unit(`${business.sector}:${bucket}:s:${index}`) * 63);
    const fitScore = Math.round(management * 0.34 + leadership * 0.3 + finance * 0.14 + sectorFit * 0.22);
    const salaryWeeklyCents = Math.round((180_000 + fitScore * 5_300) * Math.max(1, Math.log10(Math.max(10, business.valuationCents / 100)) / 5));
    return {
      id: `exec-${business.id}-${bucket}-${index}`,
      firstName: FIRST_NAMES[(hash(`${bucket}:fn:${index}`) + index) % FIRST_NAMES.length],
      lastName: LAST_NAMES[(hash(`${business.id}:ln:${index}`) + index) % LAST_NAMES.length],
      salaryWeeklyCents,
      management,
      leadership,
      finance,
      sectorFit,
      fitScore,
    };
  }).sort((a, b) => b.fitScore - a.fitScore);
}

export interface PoliticalOfficeOption {
  office: string;
  level: 'local' | 'regional' | 'national';
  minimumAge: number;
  minimumPoliticalReputation: number;
  minimumApproval: number;
  requiresPriorOffice: boolean;
  eligible: boolean;
  missing: string[];
}

export function politicalOffices(world: WorldState): PoliticalOfficeOption[] {
  const actor = world.characters[world.playerCharacterId];
  const age = playerAgeYears(world);
  const politics = world.politics[actor.id];
  const hasPriorOffice = Boolean(politics?.office) || world.timeline.some((entry) => entry.category === 'politics' && /office|election/i.test(entry.title));
  const options: Omit<PoliticalOfficeOption, 'eligible' | 'missing'>[] = [
    { office: 'Harborview Council', level: 'local', minimumAge: 18, minimumPoliticalReputation: 15, minimumApproval: 0, requiresPriorOffice: false },
    { office: 'Mayor of Harborview', level: 'local', minimumAge: 21, minimumPoliticalReputation: 35, minimumApproval: 0, requiresPriorOffice: false },
    { office: 'Regional Assembly', level: 'regional', minimumAge: 25, minimumPoliticalReputation: 45, minimumApproval: 0, requiresPriorOffice: true },
    { office: 'Governor', level: 'regional', minimumAge: 30, minimumPoliticalReputation: 55, minimumApproval: 0, requiresPriorOffice: true },
    { office: 'National Assembly', level: 'national', minimumAge: 25, minimumPoliticalReputation: 58, minimumApproval: 0, requiresPriorOffice: true },
    { office: 'President', level: 'national', minimumAge: 35, minimumPoliticalReputation: 72, minimumApproval: 45, requiresPriorOffice: true },
  ];
  return options.map((option) => {
    const missing: string[] = [];
    if (age < option.minimumAge) missing.push(`Age ${option.minimumAge}+`);
    if (actor.reputation.political < option.minimumPoliticalReputation) missing.push(`Political reputation ${option.minimumPoliticalReputation}+`);
    if ((politics?.approval ?? 50) < option.minimumApproval) missing.push(`Approval ${option.minimumApproval}+`);
    if (option.requiresPriorOffice && !hasPriorOffice) missing.push('Prior elected-office experience');
    return { ...option, eligible: missing.length === 0, missing };
  });
}

export const ADVISOR_OFFERINGS = [
  { type: 'wealth-manager', title: 'Wealth manager', emoji: '📈', weeklyCostCents: 145_000, quality: 76, description: 'Coordinates investments, liquidity, and long-term allocation.' },
  { type: 'attorney', title: 'Private attorney', emoji: '⚖️', weeklyCostCents: 115_000, quality: 78, description: 'Keeps counsel available before a legal problem becomes a crisis.' },
  { type: 'accountant', title: 'Accountant', emoji: '🧾', weeklyCostCents: 72_000, quality: 72, description: 'Improves bookkeeping and lawful tax planning.' },
  { type: 'property-manager', title: 'Property manager', emoji: '🔑', weeklyCostCents: 86_000, quality: 74, description: 'Handles routine tenant and property administration.' },
  { type: 'personal-assistant', title: 'Personal assistant', emoji: '🗓️', weeklyCostCents: 92_000, quality: 70, description: 'Buys back personal time and reduces scheduling pressure.' },
  { type: 'security', title: 'Personal security', emoji: '🛡️', weeklyCostCents: 180_000, quality: 82, description: 'Reduces exposure around a highly visible lifestyle.' },
] as const;

export function serviceOrganization(world: WorldState, type: string) {
  const actor = world.characters[world.playerCharacterId];
  return Object.values(world.organizations).find((organization) => organization.kind === 'professional' && organization.memberIds.includes(actor.id) && organization.history.some((item) => item.startsWith(`service:${type}:`)));
}

export function cityById(id: string) {
  return WORLD_CONTENT.cities.find((city) => city.id === id);
}

export function politicalSkill(world: WorldState, activity: string): number {
  const actor = world.characters[world.playerCharacterId];
  if (activity === 'press-conference') return actorSkill(world, 'publicSpeaking');
  if (activity === 'town-hall') return actor.charisma * 0.46 + actor.empathy * 0.42 + actor.knowledge * 0.12;
  if (activity === 'fundraiser') return actor.charisma * 0.48 + actor.reputation.business * 0.35 + actor.reputation.political * 0.17;
  if (activity === 'policy-briefing') return actor.knowledge * 0.62 + actor.discipline * 0.25 + actor.charisma * 0.13;
  if (activity === 'constituent-service') return actor.empathy * 0.55 + actor.discipline * 0.25 + actor.reputation.public * 0.2;
  return actor.charisma * 0.5 + actor.knowledge * 0.5;
}
