import { competency, effectiveBusinessCompetence } from './competencies';
import { getTimeBudget, type TimeBudget, type TimeCommitment } from './livingWorld';
import type { FocusArea, WorldState } from './types';

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function activeCareer(world: WorldState, characterId: string) {
  return Object.values(world.careers).find((career) => career.characterId === characterId && career.active);
}

function activeEducation(world: WorldState, characterId: string) {
  return Object.values(world.education).find((record) => record.characterId === characterId && ['school', 'higher', 'trade'].includes(record.status));
}

function activeEducationRecords(world: WorldState, characterId: string) {
  return Object.values(world.education).filter((record) => record.characterId === characterId && ['school', 'higher', 'trade'].includes(record.status));
}

function ageYears(world: WorldState): number {
  const actor = world.characters[world.playerCharacterId];
  return Math.max(0, Math.floor((world.calendar.week - actor.birthWeek) / 52));
}

function replaceCommitment(commitments: TimeCommitment[], id: string, next: TimeCommitment): void {
  const index = commitments.findIndex((item) => item.id === id);
  if (index >= 0) commitments[index] = next;
  else commitments.push(next);
}

function removeCommitment(commitments: TimeCommitment[], id: string): void {
  const index = commitments.findIndex((item) => item.id === id);
  if (index >= 0) commitments.splice(index, 1);
}

function hasFamilyOffice(world: WorldState): boolean {
  const actor = world.characters[world.playerCharacterId];
  return Object.values(world.organizations).some((organization) => organization.kind === 'professional' && organization.memberIds.includes(actor.id) && /family office/i.test(organization.name));
}

function activeAdvisors(world: WorldState): number {
  const direct = Object.values(world.advisors ?? {}).filter((advisor) => advisor.active).length;
  const actor = world.characters[world.playerCharacterId];
  const organizations = Object.values(world.organizations).filter((organization) => organization.kind === 'professional' && organization.memberIds.includes(actor.id)).length;
  return direct + organizations;
}

function otherSpouses(world: WorldState): number {
  const actor = world.characters[world.playerCharacterId];
  return Object.values(world.relationships).filter((relationship) => relationship.kind === 'spouse' && relationship.characterIds.includes(actor.id) && relationship.characterIds.some((id) => id !== actor.id && world.characters[id]?.isAlive)).length;
}

function wealthAdministrationHours(world: WorldState): number {
  const actor = world.characters[world.playerCharacterId];
  const holdings = Object.values(world.holdings).filter((holding) => holding.ownerId === actor.id).length;
  const properties = Object.values(world.properties).filter((property) => property.ownerId === actor.id).length;
  const ownedBusinesses = Object.values(world.businesses).filter((business) => business.active && (business.ownerId ?? business.founderId) === actor.id && business.playerOwnershipBps > 0).length;
  const grossComplexity = holdings * 0.4 + properties * 1.5 + ownedBusinesses * 2.2;
  const delegation = hasFamilyOffice(world) ? 0.22 : Math.max(0.48, 1 - activeAdvisors(world) * 0.08);
  return Math.max(0, Math.min(18, grossComplexity * delegation));
}

function baseCapacity(world: WorldState): number {
  const actor = world.characters[world.playerCharacterId];
  const age = ageYears(world);
  const ageCapacity = age < 5 ? 42 : age < 13 ? 58 : age < 18 ? 64 : age < 65 ? 72 : Math.max(52, 72 - (age - 64) * 0.65);
  const healthAdjustment = actor.health < 35 ? -12 : actor.health < 50 ? -7 : actor.health > 82 ? 2 : 0;
  const stressAdjustment = actor.stress >= 88 ? -8 : actor.stress >= 75 ? -4 : 0;
  return Math.max(36, Math.round(ageCapacity + healthAdjustment + stressAdjustment));
}

export function getDeepTimeBudget(world: WorldState): TimeBudget {
  const base = getTimeBudget(world);
  const actor = world.characters[world.playerCharacterId];
  const commitments = base.commitments.map((item) => ({ ...item }));
  const career = activeCareer(world, actor.id);
  const educations = activeEducationRecords(world, actor.id);

  if (career) {
    const hours = Math.max(8, Math.min(65, career.hoursPerWeek ?? 40));
    replaceCommitment(commitments, `career:${career.id}`, { id: `career:${career.id}`, label: career.title, hours, detail: hours > 44 ? 'The role consumes more than a standard workweek before commute, politics, and recovery.' : hours < 30 ? 'A reduced schedule leaves meaningful room for the rest of your life.' : 'Your regular job and the energy around it.' });
  }

  // The older budget only represented one education record. Rebuild education
  // commitments so dual enrollment has both a real high-school load and a
  // deliberately part-time college load until secondary school is complete.
  for (let index = commitments.length - 1; index >= 0; index -= 1) {
    if (commitments[index].id.startsWith('education:')) commitments.splice(index, 1);
  }
  const hasSecondarySchool = educations.some((education) => education.status === 'school');
  for (const education of educations) {
    const partTimePostsecondary = hasSecondarySchool && ['higher', 'trade'].includes(education.status);
    const baseHours = education.status === 'school' ? 34 : partTimePostsecondary ? 16 : education.status === 'trade' ? 38 : 30;
    const extraAcademic = education.status !== 'school' && education.minor ? (partTimePostsecondary ? 2 : 5) : 0;
    const research = education.status !== 'school' && Object.values(world.memories).some((memory) => memory.category === 'Education · Standout project' && memory.participantIds.includes(actor.id) && world.calendar.week - memory.week < 20) ? (partTimePostsecondary ? 1 : 3) : 0;
    const sport = education.sport ? (partTimePostsecondary ? 6 : 9) : 0;
    const label = education.status === 'school' ? 'School' : education.status === 'trade' ? (partTimePostsecondary ? 'Training · part-time' : 'Training') : education.major ? `College · ${education.major}${partTimePostsecondary ? ' · part-time' : ''}` : `College${partTimePostsecondary ? ' · part-time' : ''}`;
    replaceCommitment(commitments, `education:${education.id}`, {
      id: `education:${education.id}`,
      label,
      hours: baseHours + extraAcademic + research + sport,
      detail: partTimePostsecondary
        ? 'Secondary school is still active, so this postsecondary path is limited to a part-time dual-enrollment load.'
        : education.sport
          ? 'Classes, study, academic obligations, and a serious athletic schedule.'
          : 'Classes, assignments, studying, and ordinary attendance.',
    });
    if (education.sport) removeCommitment(commitments, 'focus:sport');
  }

  for (const business of Object.values(world.businesses).filter((item) => item.active && (item.ownerId ?? item.founderId) === actor.id && item.playerOwnershipBps > 0)) {
    const competence = effectiveBusinessCompetence(world, actor.id);
    const complexity = business.complexity ?? 20;
    const products = business.productLines?.filter((product) => product.active).length ?? 1;
    const locations = business.locations ?? 1;
    const skillRelief = Math.max(0, (competence - 50) / 9);
    const complexityHours = Math.max(0, complexity / 7 + (products - 1) * 1.5 + (locations - 1) * 1.5);
    const delegatedHours = Math.max(2, 4 + complexityHours * 0.22 - skillRelief * 0.2);
    const ownerHours = Math.max(18, 26 + complexityHours - skillRelief);
    const hours = Math.round(business.delegated ? delegatedHours : ownerHours);
    replaceCommitment(commitments, `business:${business.id}`, { id: `business:${business.id}`, label: business.name, hours, detail: business.delegated ? 'Professional management bought back most operating time, but ownership, capital allocation, and executive oversight still exist.' : 'Products, people, locations, customers, and problems are still landing on you personally.' });
  }

  const unmanagedProperties = Object.values(world.properties).filter((property) => property.ownerId === actor.id && !property.managed);
  const managedProperties = Object.values(world.properties).filter((property) => property.ownerId === actor.id && property.managed);
  if (unmanagedProperties.length > 0 || managedProperties.length > 0) {
    const hours = Math.round(Math.min(16, unmanagedProperties.length * 2.1 + managedProperties.length * 0.45));
    commitments.push({ id: 'property-portfolio', label: 'Property portfolio', hours, detail: unmanagedProperties.length > 0 ? `${unmanagedProperties.length} properties still depend on you for decisions, tenants, maintenance, and problems.` : 'Property managers handle most day-to-day work, leaving oversight and capital decisions.' });
  }

  const spouseCount = otherSpouses(world);
  if (spouseCount > 1) {
    replaceCommitment(commitments, 'partner', { id: 'partner', label: `${spouseCount} spouse relationships`, hours: Math.min(18, spouseCount * 5), detail: 'Multiple committed relationships create multiple independent needs, conflicts, memories, and expectations.' });
  }

  const ledOrganizations = Object.values(world.organizations).filter((organization) => organization.leaderId === actor.id && !Object.values(world.businesses).some((business) => business.organizationId === organization.id));
  for (const organization of ledOrganizations) {
    if (organization.kind === 'faction') commitments.push({ id: `organization:${organization.id}`, label: organization.name, hours: Math.round(5 + organization.influence / 12 + organization.memberIds.length / 10), detail: 'Followers, doctrine, resources, internal politics, and public attention create a recurring leadership burden.' });
    else if (organization.kind === 'charity' || organization.kind === 'party' || organization.kind === 'club' || organization.kind === 'professional') commitments.push({ id: `organization:${organization.id}`, label: organization.name, hours: Math.round(3 + organization.influence / 20), detail: 'Leading an institution takes recurring decisions even when nothing dramatic happens.' });
  }

  const wealthHours = wealthAdministrationHours(world);
  if (wealthHours >= 2) commitments.push({ id: 'wealth-admin', label: 'Managing the money', hours: Math.round(wealthHours), detail: hasFamilyOffice(world) ? 'A family office handles most paperwork and coordination, but you still make high-level capital decisions.' : 'Investments, properties, businesses, taxes, advisors, and liquidity create administrative work that scales with complexity.' });

  const capacityHours = baseCapacity(world);
  for (const project of Object.values(world.journey?.projects ?? {})) {
    if (project.characterId === actor.id && project.status === 'active') commitments.push({ id: `project:${project.id}`, label: 'Personal project', hours: project.hoursPerWeek, detail: 'A project you chose to make time for. You can pause it from Life plans.' });
  }
  const socialWeek = world.journey?.socialWeeks[actor.id];
  if (socialWeek !== undefined && world.calendar.week - socialWeek >= 0 && world.calendar.week - socialWeek <= 1) commitments.push({ id: 'social-catch-up', label: 'Catching up with your circle', hours: 2, detail: 'Time for a round of short calls and messages to family and friends.' });
  const committedHours = commitments.reduce((sum, item) => sum + item.hours, 0);
  const freeHours = Math.max(0, capacityHours - committedHours);
  const overloadHours = Math.max(0, committedHours - capacityHours);
  const loadRatio = committedHours / Math.max(1, capacityHours);
  const status = loadRatio > 1.28 ? 'unsustainable' : loadRatio > 1 ? 'overloaded' : loadRatio > 0.78 ? 'busy' : 'open';
  return { capacityHours, committedHours, freeHours, overloadHours, loadRatio, status, commitments: commitments.filter((item) => item.hours > 0).sort((left, right) => right.hours - left.hours) };
}

export interface OpportunityCostReport {
  protectedAreas: FocusArea[];
  exposedAreas: string[];
  headline: string;
  detail: string;
}

export function opportunityCostReport(world: WorldState): OpportunityCostReport {
  const actor = world.characters[world.playerCharacterId];
  const budget = getDeepTimeBudget(world);
  const exposed: string[] = [];
  if (activeCareer(world, actor.id) && !actor.focuses.includes('Job')) exposed.push('career performance');
  if (activeEducation(world, actor.id) && !actor.focuses.includes('Academics')) exposed.push('grades');
  if (Object.values(world.businesses).some((business) => business.active && (business.ownerId ?? business.founderId) === actor.id && !business.delegated) && !actor.focuses.includes('Startup')) exposed.push('company execution');
  if (actor.childIds.some((id) => world.characters[id]?.isAlive) && !actor.focuses.includes('Family')) exposed.push('family time');
  if (actor.partnerId && !actor.focuses.includes('Partner')) exposed.push('partner relationship');
  if (!actor.focuses.includes('Health')) exposed.push('recovery and health');
  if (budget.overloadHours <= 0) return { protectedAreas: actor.focuses, exposedAreas: exposed, headline: 'The week still fits', detail: `${budget.freeHours} sustainable hours remain unclaimed. There is room for surprises, new opportunities, and recovery.` };
  return { protectedAreas: actor.focuses, exposedAreas: exposed, headline: `${budget.overloadHours} hours have nowhere to go`, detail: `Your standing priorities protect ${actor.focuses.join(', ') || 'nothing in particular'}. When the schedule is overloaded, the game pushes consequences first into ${exposed.slice(0, 4).join(', ') || 'whatever is least protected'}.` };
}

export function timeEfficiencyFor(world: WorldState, domain: 'career' | 'business' | 'education' | 'investing' | 'politics' | 'sport'): number {
  const actor = world.characters[world.playerCharacterId];
  const key = domain === 'career' ? 'management' : domain === 'business' ? 'management' : domain === 'education' ? 'academics' : domain === 'investing' ? 'investing' : domain === 'politics' ? 'politics' : 'athletics';
  const skill = competency(world, actor.id, key);
  return clamp(0.72 + skill / 250, 0.72, 1.12);
}
