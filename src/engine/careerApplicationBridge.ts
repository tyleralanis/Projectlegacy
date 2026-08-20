import { competency, competencyLabel } from './competencies';
import { allocateId, playerAgeYears } from './createWorld';
import { recordHistory } from './history';
import { nextRandom } from './random';
import type { ActionResult, CompetencyKey, IntentAction, WorldState } from './types';

import { WORLD_CONTENT } from '@/content/worldContent';

type Profession = typeof WORLD_CONTENT.professions[number];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function roll(world: WorldState): number {
  const next = nextRandom(world.rngState);
  world.rngState = next.state;
  return next.value;
}

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function blocked(source: WorldState, message: string): ActionResult {
  return { world: source, message, validation: { valid: false, reason: message, requiresConfirmation: false } };
}

function ok(world: WorldState, message: string): ActionResult {
  return { world, message, validation: { valid: true, requiresConfirmation: false } };
}

function hasHigherEducation(world: WorldState, actorId: string): boolean {
  return Object.values(world.education).some((record) => record.characterId === actorId && record.status === 'completed' && record.level !== 'Secondary diploma');
}

function totalExperience(world: WorldState, actorId: string): number {
  return Object.values(world.careers).filter((career) => career.characterId === actorId).reduce((sum, career) => sum + career.weeksInRole, 0);
}

export function professionCompetencyKey(profession: Profession): CompetencyKey {
  if (profession.skillKey === 'social') return profession.sector === 'Sales' ? 'sales' : 'communication';
  if (profession.skillKey === 'publicSpeaking') return profession.sector === 'Government' ? 'politics' : profession.sector === 'Legal' ? 'law' : 'communication';
  if (profession.skillKey === 'management') return profession.sector === 'Construction' || profession.sector === 'Skilled Trades' ? 'trades' : 'management';
  if (profession.skillKey === 'leadership') return 'leadership';
  if (profession.skillKey === 'finance') return 'finance';
  if (profession.skillKey === 'academics') {
    if (profession.sector === 'Skilled Trades' || profession.sector === 'Construction') return 'trades';
    if (profession.sector === 'Technology' || profession.sector === 'Engineering') return 'technology';
    if (profession.sector === 'Healthcare') return 'medicine';
    return 'academics';
  }
  return 'academics';
}

export function professionSkillSnapshot(world: WorldState, characterId: string, profession: Profession): { key: CompetencyKey; label: string; value: number; minimum: number } {
  const key = professionCompetencyKey(profession);
  return { key, label: competencyLabel(key), value: competency(world, characterId, key), minimum: profession.minSkill };
}

const EMPLOYERS: Record<string, string[]> = {
  Hospitality: ['Harbor Table Group', 'Lantern Hospitality', 'North Pier Kitchens'],
  Retail: ['Cedar & Main', 'Harbor Market Co.', 'Brightline Retail'],
  Construction: ['Ironline Builders', 'Stonebridge Construction', 'Harbor Civil Works'],
  'Skilled Trades': ['ForgeWorks Services', 'Beacon Trade Group', 'Ironridge Technical'],
  Logistics: ['Northstar Logistics', 'Bluewater Freight', 'Atlas Distribution'],
  Sales: ['Crescent Commercial', 'Beacon Revenue Partners', 'Harbor Sales Group'],
  Technology: ['Signal Harbor Labs', 'Northline Systems', 'Kestrel Software'],
  Finance: ['Harbor Republic Bank', 'Northport Capital', 'Civic Commercial Bank'],
  Healthcare: ['Harborview Health', 'Starlight Medical Group', 'Cedar Regional Care'],
  Legal: ['Bennett Shah & Vale', 'Harborview Legal Group', 'Civic Counsel LLP'],
  Engineering: ['Northline Engineering', 'Ironridge Design Group', 'Harbor Infrastructure Partners'],
  Government: ['Harborview Civil Service', 'Regional Administration', 'Harbor Republic Public Service'],
  Business: ['Crescent Holdings', 'Harbor Operations Group', 'Northstar Enterprises'],
};

export function employerNameForProfession(world: WorldState, profession: Profession): string {
  const options = EMPLOYERS[profession.sector] ?? [`${profession.sector} Partners`, `${profession.sector} Group`, `Harbor ${profession.sector}`];
  const quarter = Math.floor(world.calendar.week / 13);
  return options[hash(`${world.metadata.worldSeed}:${profession.id}:${quarter}:employer`) % options.length];
}

function employerIdForProfession(world: WorldState, profession: Profession, name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 34);
  return `organization-employer-${slug}-${(hash(`${world.metadata.worldSeed}:${profession.id}:${Math.floor(world.calendar.week / 13)}`) % 4096).toString(36)}`;
}

function inferCareerLevel(profession: Profession): number {
  const title = profession.title.toLowerCase();
  if (/chief|surgeon/.test(title)) return 6;
  if (/vp|vice president|director/.test(title)) return 5;
  if (/manager/.test(title)) return 4;
  if (/attorney|banker|engineer|developer|accountant|nurse|electrician/.test(title)) return 3;
  if (/helper|clerk|associate|apprentice/.test(title)) return 1;
  return 2;
}

/**
 * Replaces the legacy stat-proxy hiring path. Job requirements now use the
 * same persistent competency system that practice, school, careers, business,
 * and aging use everywhere else, while successful applications create a
 * sector-appropriate employer instead of routing every career through one firm.
 */
export function executeCareerApplication(source: WorldState, action: IntentAction): ActionResult | null {
  if (action.verb !== 'career.apply' || typeof action.parameters.professionId !== 'string') return null;
  const profession = WORLD_CONTENT.professions.find((item) => item.id === action.parameters.professionId);
  if (!profession) return blocked(source, 'That opening is no longer available.');
  const actor = source.characters[source.playerCharacterId];
  const age = playerAgeYears(source);
  const experience = totalExperience(source, actor.id);
  const skill = professionSkillSnapshot(source, actor.id, profession);

  if (age < profession.minimumAge) return blocked(source, `This role requires age ${profession.minimumAge} or older.`);
  if (profession.requiredDegree && !hasHigherEducation(source, actor.id)) return blocked(source, 'This role requires a completed college or professional degree.');
  if (actor.knowledge < profession.minKnowledge) return blocked(source, `Your resume is light for this opening. Knowledge ${Math.round(actor.knowledge)}/${profession.minKnowledge} required.`);
  if (experience < profession.minExperienceWeeks) return blocked(source, `This role expects about ${Math.ceil(profession.minExperienceWeeks / 52)} years of prior experience.`);
  if (actor.reputation.professional < profession.minReputation) return blocked(source, `Professional reputation ${Math.round(actor.reputation.professional)}/${profession.minReputation} is below the hiring bar.`);
  if (skill.value < skill.minimum) return blocked(source, `${skill.label} ${Math.round(skill.value)}/${skill.minimum} is below the hiring bar for ${profession.title}.`);

  const world = clone(source);
  const nextActor = world.characters[world.playerCharacterId];
  const experienceFit = clamp(experience / Math.max(52, profession.minExperienceWeeks || 52), 0, 3);
  const chance = clamp(
    0.12
      + nextActor.knowledge / 430
      + nextActor.reputation.professional / 430
      + skill.value / 320
      + experienceFit * 0.045
      - world.economy.unemployment * 0.65,
    0.12,
    0.93,
  );
  const employerName = employerNameForProfession(world, profession);
  if (roll(world) > chance) {
    recordHistory(world, 'career', `${employerName} chose another applicant`, `You were qualified for ${profession.title}, but qualified does not mean guaranteed. The application leaves your skills and reputation intact for another opening.`, { subjectIds: [nextActor.id], importance: 2 });
    return ok(world, `You met the requirements for ${profession.title}, but ${employerName} chose another applicant this time.`);
  }

  Object.values(world.careers).forEach((career) => { if (career.characterId === nextActor.id) career.active = false; });
  const employerId = employerIdForProfession(world, profession, employerName);
  if (!world.organizations[employerId]) {
    world.organizations[employerId] = {
      id: employerId,
      kind: profession.sector === 'Government' ? 'other' : 'business',
      name: employerName,
      resourcesCents: Math.round(80_000_000_00 + roll(world) * 950_000_000_00),
      influence: Math.round(38 + roll(world) * 46),
      stability: Math.round(48 + roll(world) * 38),
      memberIds: [],
      history: [`A ${profession.sector.toLowerCase()} employer operating in the player's wider world.`],
    };
  }
  const employer = world.organizations[employerId];
  if (!employer.memberIds.includes(nextActor.id)) employer.memberIds.push(nextActor.id);

  const marketMultiplier = 0.94 + roll(world) * 0.14;
  const salary = Math.round(profession.weeklySalaryCents * marketMultiplier);
  const careerId = allocateId(world, 'career');
  world.careers[careerId] = {
    id: careerId,
    characterId: nextActor.id,
    employerId,
    title: profession.title,
    sector: profession.sector,
    weeklySalaryCents: salary,
    performance: clamp(46 + (skill.value - skill.minimum) * 0.3 + roll(world) * 10, 42, 68),
    satisfaction: Math.round(54 + roll(world) * 22),
    weeksInRole: 0,
    active: true,
    hoursPerWeek: /chief|surgeon|director|vp/i.test(profession.title) ? 48 : 40,
    level: inferCareerLevel(profession),
    department: profession.sector,
    promotionProgress: 0,
    organizationStanding: clamp(40 + nextActor.reputation.professional * 0.16 + roll(world) * 8, 38, 66),
  };
  nextActor.professionId = profession.id;
  recordHistory(world, 'career', `Joined ${employerName}`, `${nextActor.firstName} became a ${profession.title} at ${employerName}. The role starts with ${skill.label.toLowerCase()} as a real underlying competency, not a hidden charisma or knowledge proxy.`, { important: true, subjectIds: [nextActor.id, employerId, careerId], importance: 3 });
  return ok(world, `You landed the ${profession.title} role at ${employerName} for ${(salary * 52 / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} per year.`);
}
