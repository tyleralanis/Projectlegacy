import type { CareerState, Character, CompetencyKey, EducationState, WorldState } from './types';

export interface CompetencyDefinition {
  id: CompetencyKey;
  label: string;
  detail: string;
}

export const COMPETENCIES: CompetencyDefinition[] = [
  { id: 'academics', label: 'Academics', detail: 'Learning, analysis, study habits, research, and formal academic work.' },
  { id: 'communication', label: 'Communication', detail: 'Writing, speaking clearly, listening, presenting, and explaining complicated things.' },
  { id: 'leadership', label: 'Leadership', detail: 'Setting direction, building trust, motivating people, and making decisions under pressure.' },
  { id: 'management', label: 'Management', detail: 'Planning, delegation, staffing, operations, systems, and keeping organizations functional.' },
  { id: 'finance', label: 'Finance', detail: 'Accounting, cash flow, capital structure, budgeting, valuation, and financial judgment.' },
  { id: 'investing', label: 'Investing', detail: 'Security analysis, portfolio construction, risk, patience, and capital allocation.' },
  { id: 'sales', label: 'Sales', detail: 'Finding demand, persuading customers, closing deals, and understanding what people will pay for.' },
  { id: 'negotiation', label: 'Negotiation', detail: 'Bargaining, framing tradeoffs, reading leverage, and reaching favorable agreements.' },
  { id: 'technology', label: 'Technology', detail: 'Software, data, technical systems, engineering intuition, and digital problem solving.' },
  { id: 'trades', label: 'Trades', detail: 'Hands-on technical work, repair, fabrication, construction, and practical mechanical skill.' },
  { id: 'law', label: 'Law', detail: 'Legal reasoning, contracts, procedure, regulation, and institutional rules.' },
  { id: 'medicine', label: 'Medicine', detail: 'Clinical knowledge, health systems, care, diagnosis, and medical judgment.' },
  { id: 'athletics', label: 'Athletics', detail: 'Sport technique, physical preparation, competition, and performance under pressure.' },
  { id: 'media', label: 'Media', detail: 'Audience building, storytelling, press, content, reputation, and public attention.' },
  { id: 'politics', label: 'Politics', detail: 'Coalitions, institutions, campaigns, public opinion, governing, and political judgment.' },
  { id: 'parenting', label: 'Parenting', detail: 'Guidance, patience, boundaries, reliability, development, and family leadership.' },
];

const ids = COMPETENCIES.map((item) => item.id);

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function baseProfile(character: Character): Record<CompetencyKey, number> {
  return {
    academics: clamp(character.knowledge * 0.72 + character.discipline * 0.28),
    communication: clamp(character.charisma * 0.58 + character.empathy * 0.3 + character.knowledge * 0.12),
    leadership: clamp(character.charisma * 0.34 + character.ambition * 0.24 + character.discipline * 0.22 + character.empathy * 0.2),
    management: clamp(character.discipline * 0.42 + character.knowledge * 0.22 + character.ambition * 0.18 + character.empathy * 0.18),
    finance: clamp(character.knowledge * 0.55 + character.discipline * 0.28 + character.riskTolerance * 0.17),
    investing: clamp(character.knowledge * 0.44 + character.discipline * 0.22 + character.riskTolerance * 0.25 + character.ambition * 0.09),
    sales: clamp(character.charisma * 0.5 + character.empathy * 0.23 + character.ambition * 0.17 + character.riskTolerance * 0.1),
    negotiation: clamp(character.charisma * 0.34 + character.empathy * 0.23 + character.knowledge * 0.18 + character.riskTolerance * 0.13 + character.ethics * 0.12),
    technology: clamp(character.knowledge * 0.6 + character.discipline * 0.25 + character.ambition * 0.15),
    trades: clamp(character.discipline * 0.36 + character.knowledge * 0.28 + character.fitness * 0.2 + character.riskTolerance * 0.16),
    law: clamp(character.knowledge * 0.6 + character.discipline * 0.2 + character.communication * 0 + character.charisma * 0.08 + character.ethics * 0.12),
    medicine: clamp(character.knowledge * 0.58 + character.discipline * 0.22 + character.empathy * 0.2),
    athletics: clamp(character.fitness * 0.62 + character.discipline * 0.22 + character.riskTolerance * 0.16),
    media: clamp(character.charisma * 0.46 + character.communication * 0 + character.empathy * 0.18 + character.ambition * 0.18 + character.knowledge * 0.18),
    politics: clamp(character.charisma * 0.3 + character.empathy * 0.2 + character.knowledge * 0.22 + character.ambition * 0.16 + character.ethics * 0.12),
    parenting: clamp(character.empathy * 0.42 + character.discipline * 0.22 + character.ethics * 0.2 + character.knowledge * 0.08 + character.charisma * 0.08),
  };
}

function ageYears(worldWeek: number, birthWeek: number): number {
  return Math.max(0, Math.floor((worldWeek - birthWeek) / 52));
}

function careerSkillPairs(career: CareerState): CompetencyKey[] {
  const text = `${career.title} ${career.sector}`.toLowerCase();
  const result = new Set<CompetencyKey>(['communication']);
  if (/chief|director|manager|lead|supervisor|executive|operations/.test(text)) { result.add('leadership'); result.add('management'); }
  if (/finance|bank|account|analyst|investment|wealth|insurance/.test(text)) { result.add('finance'); result.add('investing'); }
  if (/sales|retail|broker|real estate|business development/.test(text)) { result.add('sales'); result.add('negotiation'); }
  if (/software|developer|engineer|data|technology|it|cyber/.test(text)) result.add('technology');
  if (/mechanic|electric|plumb|weld|construction|technician|manufacturing/.test(text)) result.add('trades');
  if (/law|attorney|legal|judge/.test(text)) { result.add('law'); result.add('negotiation'); }
  if (/doctor|nurse|medical|health|surgeon|therap/.test(text)) result.add('medicine');
  if (/coach|athlete|sport/.test(text)) result.add('athletics');
  if (/media|creator|journal|marketing|public relations|press/.test(text)) result.add('media');
  if (/politic|government|policy|mayor|governor|president|campaign/.test(text)) result.add('politics');
  return [...result];
}

function educationSkillPairs(record: EducationState): CompetencyKey[] {
  const text = `${record.level} ${record.major ?? ''} ${record.minor ?? ''}`.toLowerCase();
  const result = new Set<CompetencyKey>(['academics', 'communication']);
  if (/business|management|operations|mba/.test(text)) { result.add('management'); result.add('finance'); }
  if (/finance|account|econom/.test(text)) { result.add('finance'); result.add('investing'); }
  if (/computer|software|engineering|technology|data/.test(text)) result.add('technology');
  if (/law|legal|political science/.test(text)) { result.add('law'); result.add('politics'); }
  if (/medicine|nurs|biology|health/.test(text)) result.add('medicine');
  if (/communication|journal|media|marketing/.test(text)) { result.add('media'); result.add('sales'); }
  if (/trade|weld|mechanic|electric|construction/.test(text)) result.add('trades');
  if (record.sport) result.add('athletics');
  return [...result];
}

export function ensureCompetencies(character: Character): Record<CompetencyKey, number> {
  const defaults = baseProfile(character);
  if (!character.competencies) character.competencies = {};
  for (const id of ids) {
    if (typeof character.competencies[id] !== 'number' || !Number.isFinite(character.competencies[id])) character.competencies[id] = defaults[id];
    character.competencies[id] = clamp(character.competencies[id]!);
  }
  return character.competencies as Record<CompetencyKey, number>;
}

export function normalizeCompetencies(world: WorldState): WorldState {
  for (const character of Object.values(world.characters)) ensureCompetencies(character);
  return world;
}

export function competency(world: WorldState, characterId: string, key: CompetencyKey): number {
  const character = world.characters[characterId];
  if (!character) return 0;
  return ensureCompetencies(character)[key];
}

export function gainCompetency(character: Character, key: CompetencyKey, amount: number): number {
  const profile = ensureCompetencies(character);
  const current = profile[key];
  const diminishing = Math.max(0.16, 1 - current / 118);
  const gained = Math.max(0, amount) * diminishing;
  profile[key] = clamp(current + gained);
  return profile[key];
}

export function loseCompetency(character: Character, key: CompetencyKey, amount: number): number {
  const profile = ensureCompetencies(character);
  profile[key] = clamp(profile[key] - Math.max(0, amount));
  return profile[key];
}

export function careerCompetencies(career: CareerState): CompetencyKey[] {
  return careerSkillPairs(career);
}

export function educationCompetencies(record: EducationState): CompetencyKey[] {
  return educationSkillPairs(record);
}

export function effectiveCareerCompetence(world: WorldState, career: CareerState): number {
  const character = world.characters[career.characterId];
  if (!character) return 0;
  const skills = careerSkillPairs(career);
  const values = skills.map((key) => competency(world, character.id, key));
  const skillMean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  return clamp(skillMean * 0.58 + character.discipline * 0.16 + character.knowledge * 0.12 + character.reputation.professional * 0.14);
}

export function effectiveBusinessCompetence(world: WorldState, characterId: string): number {
  const character = world.characters[characterId];
  if (!character) return 0;
  return clamp(
    competency(world, characterId, 'management') * 0.25
    + competency(world, characterId, 'finance') * 0.18
    + competency(world, characterId, 'sales') * 0.15
    + competency(world, characterId, 'leadership') * 0.16
    + competency(world, characterId, 'negotiation') * 0.1
    + character.discipline * 0.08
    + character.ambition * 0.08,
  );
}

export function effectiveInvestingCompetence(world: WorldState, characterId: string): number {
  const character = world.characters[characterId];
  if (!character) return 0;
  return clamp(competency(world, characterId, 'investing') * 0.52 + competency(world, characterId, 'finance') * 0.24 + character.discipline * 0.12 + character.riskTolerance * 0.12);
}

export function topCompetencies(world: WorldState, characterId: string, count = 5): { key: CompetencyKey; label: string; value: number }[] {
  const character = world.characters[characterId];
  if (!character) return [];
  const profile = ensureCompetencies(character);
  return COMPETENCIES
    .map((definition) => ({ key: definition.id, label: definition.label, value: profile[definition.id] }))
    .sort((left, right) => right.value - left.value)
    .slice(0, Math.max(1, count));
}

export function competencyLabel(key: CompetencyKey): string {
  return COMPETENCIES.find((item) => item.id === key)?.label ?? key;
}

export function practiceFromCareer(world: WorldState, career: CareerState, weeks: number): void {
  const character = world.characters[career.characterId];
  if (!character?.isAlive) return;
  const intensity = Math.min(2.5, Math.max(0.1, weeks / 24));
  for (const key of careerSkillPairs(career)) gainCompetency(character, key, intensity * (career.performance >= 70 ? 1.15 : 0.85));
}

export function practiceFromEducation(world: WorldState, record: EducationState, weeks: number): void {
  const character = world.characters[record.characterId];
  if (!character?.isAlive) return;
  const gradeFactor = 0.65 + record.recordedGrade / 180;
  const intensity = Math.min(2.6, Math.max(0.08, weeks / 20)) * gradeFactor;
  for (const key of educationSkillPairs(record)) gainCompetency(character, key, intensity);
}

export function experienceYears(world: WorldState, characterId: string): number {
  const weeks = Object.values(world.careers).filter((career) => career.characterId === characterId).reduce((sum, career) => sum + career.weeksInRole, 0);
  return weeks / 52;
}

export function competencyPotential(character: Character, key: CompetencyKey): number {
  const base = key === 'athletics'
    ? character.fitness * 0.35 + character.discipline * 0.25 + character.ambition * 0.2 + character.riskTolerance * 0.2
    : key === 'parenting'
      ? character.empathy * 0.35 + character.ethics * 0.25 + character.discipline * 0.2 + character.knowledge * 0.2
      : character.discipline * 0.26 + character.ambition * 0.22 + character.knowledge * 0.24 + character.charisma * 0.14 + character.empathy * 0.14;
  return clamp(45 + base * 0.55);
}

export function annualSkillDecay(world: WorldState, character: Character, practiced: Set<CompetencyKey>): void {
  if (!character.isAlive) return;
  const profile = ensureCompetencies(character);
  const age = ageYears(world.calendar.week, character.birthWeek);
  for (const key of ids) {
    if (practiced.has(key) || profile[key] < 62) continue;
    const ageFactor = age > 65 ? 1.35 : 1;
    profile[key] = clamp(profile[key] - 0.18 * ageFactor);
  }
}
