import {
  competency,
  effectiveBusinessCompetence,
  effectiveCareerCompetence,
  ensureCompetencies,
  gainCompetency,
} from './competencies';
import { allocateId } from './createWorld';
import { recordHistory } from './history';
import { nextRandom } from './random';
import type { ActionResult, Business, CareerState, CompetencyKey, EducationState, IntentAction, WorldState } from './types';

const DEEP_VERBS = new Set([
  'skills.practice',
  'career.find_mentor',
  'career.take_lead',
  'career.build_alliance',
  'education.add_minor',
  'education.research_project',
  'education.find_mentor',
  'sports.choose_sport',
  'sports.practice',
  'sports.compete',
  'sports.seek_agent',
  'business.add_product',
  'business.improve_product',
  'business.retire_product',
  'business.acquire_company',
  'markets.private_deal',
  'dynasty.family_council',
  'dynasty.train_heir',
  'politics.build_coalition',
  'politics.recruit_staff',
]);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function roll(world: WorldState): number {
  const next = nextRandom(world.rngState);
  world.rngState = next.state;
  return next.value;
}

function ok(world: WorldState, message: string): ActionResult {
  return { world, message, validation: { valid: true, requiresConfirmation: false } };
}

function blocked(source: WorldState, message: string): ActionResult {
  return { world: source, message, validation: { valid: false, reason: message, requiresConfirmation: false } };
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function amount(action: IntentAction, fallback: number): number {
  const value = action.parameters.amountCents;
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;
}

function activeCareer(world: WorldState, characterId: string): CareerState | undefined {
  return Object.values(world.careers).find((career) => career.characterId === characterId && career.active);
}

function activeEducation(world: WorldState, characterId: string): EducationState | undefined {
  return Object.values(world.education).find((record) => record.characterId === characterId && ['school', 'higher', 'trade'].includes(record.status));
}

function ownedBusiness(world: WorldState, targetIds: string[]): Business | undefined {
  const actor = world.characters[world.playerCharacterId];
  return targetIds.map((id) => world.businesses[id]).find((business) => business?.active && (business.ownerId ?? business.founderId) === actor.id && business.playerOwnershipBps > 0)
    ?? Object.values(world.businesses).find((business) => business.active && (business.ownerId ?? business.founderId) === actor.id && business.playerOwnershipBps > 0);
}

function professionalCoworkers(world: WorldState, career: CareerState) {
  const actor = world.characters[world.playerCharacterId];
  return Object.values(world.relationships)
    .filter((relationship) => relationship.kind === 'professional' && relationship.characterIds.includes(actor.id))
    .map((relationship) => ({ relationship, person: world.characters[relationship.characterIds.find((id) => id !== actor.id)!] }))
    .filter(({ person }) => person?.isAlive && activeCareer(world, person.id)?.employerId === career.employerId);
}

function createMemory(world: WorldState, category: string, participantIds: string[], narrative: string, importance: number, unresolved = false): void {
  const id = allocateId(world, 'memory');
  world.memories[id] = { id, participantIds, category, week: world.calendar.week, valence: 0.25, importance, permanent: importance >= 78, unresolved, visibility: 'shared', narrative };
}

function practiceSkill(source: WorldState, action: IntentAction): ActionResult {
  const actor = source.characters[source.playerCharacterId];
  const skill = typeof action.parameters.skill === 'string' ? action.parameters.skill as CompetencyKey : undefined;
  const allowed: CompetencyKey[] = ['academics', 'communication', 'leadership', 'management', 'finance', 'investing', 'sales', 'negotiation', 'technology', 'trades', 'law', 'medicine', 'athletics', 'media', 'politics', 'parenting'];
  if (!skill || !allowed.includes(skill)) return blocked(source, 'Choose a real competency to practice.');
  const world = clone(source);
  const nextActor = world.characters[world.playerCharacterId];
  ensureCompetencies(nextActor);
  gainCompetency(nextActor, skill, 2.8 + nextActor.discipline / 80);
  nextActor.stress = clamp(nextActor.stress + 1.4);
  nextActor.mood = clamp(nextActor.mood + (nextActor.ambition >= 60 ? 0.8 : -0.2));
  return ok(world, `You deliberately practiced ${skill}. The skill improved, and the session used time and attention instead of granting a free stat bump.`);
}

function careerAction(source: WorldState, action: IntentAction): ActionResult {
  const actor = source.characters[source.playerCharacterId];
  const career = activeCareer(source, actor.id);
  if (!career) return blocked(source, 'You need an active job for that move.');

  if (action.verb === 'career.find_mentor') {
    const candidates = professionalCoworkers(source, career).sort((left, right) => {
      const leftCareer = activeCareer(source, left.person.id);
      const rightCareer = activeCareer(source, right.person.id);
      return ((rightCareer?.level ?? 2) * 20 + right.person.reputation.professional) - ((leftCareer?.level ?? 2) * 20 + left.person.reputation.professional);
    });
    const candidate = candidates[0];
    if (!candidate) return blocked(source, 'There is nobody around your job who is positioned to mentor you yet.');
    const world = clone(source);
    const nextCareer = world.careers[career.id];
    const nextRelationship = world.relationships[candidate.relationship.id];
    const mentor = world.characters[candidate.person.id];
    const willingness = nextRelationship.respect * 0.34 + nextRelationship.trust * 0.24 + actor.reputation.professional * 0.18 + actor.charisma * 0.12 + mentor.empathy * 0.12;
    if (willingness + roll(world) * 28 < 56) {
      nextRelationship.respect = clamp(nextRelationship.respect + 1);
      return ok(world, `${mentor.firstName} was friendly but did not really take you on. You made the ask without damaging the relationship.`);
    }
    nextCareer.managerId = mentor.id;
    nextCareer.organizationStanding = clamp((nextCareer.organizationStanding ?? 48) + 6);
    nextCareer.promotionProgress = clamp((nextCareer.promotionProgress ?? 0) + 7);
    nextRelationship.trust = clamp(nextRelationship.trust + 5);
    nextRelationship.respect = clamp(nextRelationship.respect + 4);
    gainCompetency(world.characters[actor.id], 'communication', 1.1);
    gainCompetency(world.characters[actor.id], 'leadership', 0.7);
    createMemory(world, 'Career · Mentor', [actor.id, mentor.id], `${mentor.firstName} began actively mentoring ${actor.firstName}. Advice, sponsorship, and future disagreements now have a real relationship to travel through.`, 74, true);
    return ok(world, `${mentor.firstName} agreed to mentor you. Internal standing and promotion leverage improved, but the relationship now matters to the career.`);
  }

  if (action.verb === 'career.take_lead') {
    const world = clone(source);
    const nextCareer = world.careers[career.id];
    const nextActor = world.characters[actor.id];
    const competence = effectiveCareerCompetence(world, nextCareer);
    const success = competence * 0.45 + competency(world, actor.id, 'leadership') * 0.3 + nextCareer.performance * 0.25 + roll(world) * 22 >= 63;
    nextActor.stress = clamp(nextActor.stress + 3.2);
    gainCompetency(nextActor, 'leadership', 1.7);
    gainCompetency(nextActor, 'management', 1.1);
    if (success) {
      nextCareer.performance = clamp(nextCareer.performance + 4.5);
      nextCareer.promotionProgress = clamp((nextCareer.promotionProgress ?? 0) + 9);
      nextCareer.organizationStanding = clamp((nextCareer.organizationStanding ?? 48) + 5);
      nextActor.reputation.employee = clamp(nextActor.reputation.employee + 2.5);
      return ok(world, 'You took ownership of a visible piece of work and delivered. The stress was real, but so was the increase in internal leverage.');
    }
    nextCareer.performance = clamp(nextCareer.performance - 2.5);
    nextCareer.promotionProgress = clamp((nextCareer.promotionProgress ?? 0) - 3);
    return ok(world, 'You stepped up before you were fully ready. Leadership skill still grew, but the result did not help your immediate promotion case.');
  }

  const coworkers = professionalCoworkers(source, career);
  const targetId = action.targetIds[0] ?? coworkers[0]?.person.id;
  const target = source.characters[targetId];
  const relationship = coworkers.find((item) => item.person.id === targetId)?.relationship;
  if (!target || !relationship) return blocked(source, 'Choose someone around your job to build an alliance with.');
  const world = clone(source);
  const nextRelationship = world.relationships[relationship.id];
  const nextCareer = world.careers[career.id];
  const fit = actor.empathy * 0.25 + actor.charisma * 0.2 + competency(world, actor.id, 'communication') * 0.24 + nextRelationship.respect * 0.18 + nextRelationship.trust * 0.13;
  if (fit + roll(world) * 30 >= 55) {
    nextRelationship.trust = clamp(nextRelationship.trust + 6);
    nextRelationship.respect = clamp(nextRelationship.respect + 5);
    nextCareer.organizationStanding = clamp((nextCareer.organizationStanding ?? 48) + 4);
    gainCompetency(world.characters[actor.id], 'communication', 0.8);
    createMemory(world, 'Career · Alliance', [actor.id, target.id], `${actor.firstName} and ${target.firstName} became more deliberate allies inside the organization. That can help both careers, but coworkers can also notice coalitions forming.`, 58);
    return ok(world, `${target.firstName} became a stronger internal ally. Your standing improved because organizations are made of people, not only performance scores.`);
  }
  nextRelationship.resentment = clamp(nextRelationship.resentment + 3);
  nextCareer.organizationStanding = clamp((nextCareer.organizationStanding ?? 48) - 1);
  return ok(world, `You tried to build a closer work alliance with ${target.firstName}, but it felt transactional. They will remember the awkwardness.`);
}

function educationAction(source: WorldState, action: IntentAction): ActionResult {
  const actor = source.characters[source.playerCharacterId];
  const education = activeEducation(source, actor.id);
  if (!education) return blocked(source, 'You need an active school, college, or training path.');

  if (action.verb === 'education.add_minor') {
    if (education.status !== 'higher') return blocked(source, 'A formal minor is tied to an active college program.');
    const minor = typeof action.parameters.minor === 'string' && action.parameters.minor.trim() ? action.parameters.minor.trim().slice(0, 40) : 'Economics';
    const world = clone(source);
    const next = world.education[education.id];
    next.minor = minor;
    world.characters[actor.id].stress = clamp(world.characters[actor.id].stress + 1.8);
    createMemory(world, 'Education · Minor', [actor.id, education.id], `${actor.firstName} added a ${minor} minor. The extra specialization expands future skill combinations while making the academic week less forgiving.`, 52);
    return ok(world, `You added a ${minor} minor. It creates a second academic direction and a little more workload.`);
  }

  if (action.verb === 'education.research_project') {
    const world = clone(source);
    const next = world.education[education.id];
    const nextActor = world.characters[actor.id];
    const academic = competency(world, actor.id, 'academics');
    const quality = academic * 0.42 + nextActor.discipline * 0.24 + next.recordedGrade * 0.2 + next.network * 0.14 + roll(world) * 20;
    nextActor.stress = clamp(nextActor.stress + 3.5);
    gainCompetency(nextActor, 'academics', 1.8);
    gainCompetency(nextActor, 'communication', 0.8);
    if (quality >= 70) {
      next.recordedGrade = clamp(next.recordedGrade + 2.8);
      next.network = clamp(next.network + 3);
      nextActor.reputation.professional = clamp(nextActor.reputation.professional + 2);
      createMemory(world, 'Education · Standout project', [actor.id, education.id], 'A serious project became one of the pieces of work professors and future interviewers can actually remember. It is more useful than a generic grade bump because it connects school to reputation.', 68, false);
      return ok(world, 'The project turned out strong. Grades, academic skill, faculty visibility, and professional reputation all moved together.');
    }
    next.recordedGrade = clamp(next.recordedGrade + 0.8);
    return ok(world, 'The project was respectable rather than remarkable. You still learned more from doing difficult work than from simply attending class.');
  }

  const world = clone(source);
  const next = world.education[education.id];
  const organization = world.organizations[next.institutionId];
  if (!organization) return blocked(source, 'Your school does not currently have enough institutional detail for a mentor.');
  const existing = next.mentorId ? world.characters[next.mentorId] : undefined;
  if (existing?.isAlive) return blocked(source, `${existing.firstName} is already your academic mentor.`);
  const mentorId = allocateId(world, 'character');
  const mentor = {
    id: mentorId,
    firstName: ['Dr. Avery', 'Professor Nia', 'Dr. Theo', 'Professor Maya'][Math.floor(roll(world) * 4)],
    lastName: ['Bennett', 'Shah', 'Kim', 'Rivera'][Math.floor(roll(world) * 4)],
    birthWeek: world.calendar.week - (38 + Math.floor(roll(world) * 24)) * 52,
    isAlive: true,
    cityId: actor.cityId,
    householdId: `household-${mentorId}`,
    parentIds: [] as string[],
    childIds: [] as string[],
    cashCents: 6_500_000,
    health: 78,
    mood: 66,
    stress: 38,
    discipline: 78,
    ambition: 66,
    empathy: 67,
    riskTolerance: 35,
    ethics: 76,
    knowledge: 88,
    charisma: 64,
    fitness: 48,
    focuses: ['Job', 'Networking', 'Health'] as const,
    reputation: { public: 48, business: 42, employee: 66, political: 42, professional: 82, family: 55, faction: 12 },
    detailTier: 'standard' as const,
    lastMeaningfulWeek: world.calendar.week,
  };
  world.characters[mentorId] = mentor;
  ensureCompetencies(world.characters[mentorId]);
  next.mentorId = mentorId;
  next.network = clamp(next.network + 5);
  const relationshipId = allocateId(world, 'relationship');
  world.relationships[relationshipId] = { id: relationshipId, characterIds: [actor.id, mentorId], kind: 'professional', trust: 46, affection: 28, respect: 68, resentment: 0, lastInteractionWeek: world.calendar.week };
  createMemory(world, 'Education · Mentor', [actor.id, mentorId], `${mentor.firstName} ${mentor.lastName} became more than a name attached to a course. They can now matter later as a recommender, critic, professional connection, or source of opportunity.`, 72, true);
  return ok(world, `${mentor.firstName} ${mentor.lastName} is now a real mentor in your world, with a persistent relationship that can outlive school.`);
}

function sportsAction(source: WorldState, action: IntentAction): ActionResult {
  const actor = source.characters[source.playerCharacterId];
  const education = activeEducation(source, actor.id);
  if (!education && !activeCareer(source, actor.id)?.title.toLowerCase().includes('athlete')) return blocked(source, 'You need an active school athletics path or professional sports career.');
  const world = clone(source);
  const nextActor = world.characters[actor.id];
  const nextEducation = education ? world.education[education.id] : undefined;

  if (action.verb === 'sports.choose_sport') {
    if (!nextEducation) return blocked(source, 'Choose a school or college sport while you are enrolled.');
    const sport = typeof action.parameters.sport === 'string' && action.parameters.sport.trim() ? action.parameters.sport.trim().slice(0, 30) : 'Basketball';
    nextEducation.sport = sport;
    nextEducation.athleticLevel = Math.max(nextEducation.athleticLevel ?? 0, competency(world, actor.id, 'athletics') * 0.55);
    nextActor.focuses = ['Sport', ...nextActor.focuses.filter((focus) => focus !== 'Sport')].slice(0, 3);
    createMemory(world, 'Athletics · Chosen sport', [actor.id, nextEducation.id], `${actor.firstName} committed to ${sport}. Training, competition, recruiting, health, school, and time now have a shared storyline.`, 58);
    return ok(world, `${sport} is now your main competitive sport and Sport became a standing priority.`);
  }

  if (action.verb === 'sports.practice') {
    gainCompetency(nextActor, 'athletics', 2.7 + nextActor.discipline / 95);
    nextActor.fitness = clamp(nextActor.fitness + 2.3);
    nextActor.stress = clamp(nextActor.stress + 1.8);
    if (nextEducation) nextEducation.athleticLevel = clamp((nextEducation.athleticLevel ?? 15) + 3.2);
    return ok(world, 'You trained like the sport mattered. Athletic skill and fitness improved, and the rest of the week got a little tighter.');
  }

  if (action.verb === 'sports.compete') {
    const level = nextEducation?.athleticLevel ?? competency(world, actor.id, 'athletics');
    const readiness = level * 0.42 + competency(world, actor.id, 'athletics') * 0.3 + nextActor.fitness * 0.16 + nextActor.health * 0.12;
    const outcome = readiness + roll(world) * 30;
    const recognition = outcome >= 90 ? 8 : outcome >= 76 ? 4 : outcome >= 60 ? 1.5 : -0.5;
    if (nextEducation) nextEducation.athleticRecognition = clamp((nextEducation.athleticRecognition ?? 0) + recognition);
    nextActor.reputation.public = clamp(nextActor.reputation.public + Math.max(-1, recognition * 0.45));
    nextActor.stress = clamp(nextActor.stress + 2.4);
    gainCompetency(nextActor, 'athletics', 1.1);
    const description = outcome >= 90 ? 'a standout performance people will remember' : outcome >= 76 ? 'a strong result' : outcome >= 60 ? 'a respectable result' : 'a rough outing';
    recordHistory(world, 'education', `Athletics: ${description}`, `Competition is now part of the athletic record. Results affect recognition, confidence, reputation, and eventually recruiting or professional interest.`, { importance: outcome >= 90 ? 4 : 2 });
    return ok(world, `You had ${description}. The result changed your athletic recognition instead of only your fitness stat.`);
  }

  const recognition = nextEducation?.athleticRecognition ?? 0;
  const level = nextEducation?.athleticLevel ?? competency(world, actor.id, 'athletics');
  if (level < 84 || recognition < 65 || actor.reputation.public < 55) return blocked(source, 'Your athletic level, competitive recognition, and public profile are not strong enough for a serious professional push yet.');
  const chance = clamp((level * 0.42 + recognition * 0.28 + competency(world, actor.id, 'athletics') * 0.2 + actor.charisma * 0.1 - 55) / 55, 0.12, 0.86);
  if (roll(world) > chance) {
    createMemory(world, 'Athletics · Pro interest missed', [actor.id], 'You tested the professional market and did not get a real offer. The level is close enough that another season, more recognition, or better health could change the answer.', 62, true);
    return ok(world, 'You explored professional representation, but there was not enough market interest for a real offer yet.');
  }
  Object.values(world.careers).forEach((career) => { if (career.characterId === actor.id) career.active = false; });
  const careerId = allocateId(world, 'career');
  const sport = nextEducation?.sport ?? 'Professional sport';
  world.careers[careerId] = { id: careerId, characterId: actor.id, employerId: 'organization-pro-sports', title: `Professional ${sport} athlete`, sector: 'Sports', weeklySalaryCents: Math.round(140_000 + recognition * 7_500 + level * 5_500), performance: clamp(level * 0.7 + recognition * 0.3), satisfaction: 82, weeksInRole: 0, active: true, hoursPerWeek: 46, level: 4, department: sport, promotionProgress: 0, organizationStanding: 58 };
  if (!world.organizations['organization-pro-sports']) world.organizations['organization-pro-sports'] = { id: 'organization-pro-sports', kind: 'professional', name: 'National Sports Association', resourcesCents: 500_000_000_00, influence: 72, stability: 78, memberIds: [], history: ['A national professional sports institution.'] };
  world.organizations['organization-pro-sports'].memberIds.push(actor.id);
  recordHistory(world, 'career', 'Turned professional', `${actor.firstName} signed a professional ${sport} contract. The sport is now a career with money, performance pressure, injuries, fame, and a clock on the body.`, { important: true, importance: 5 });
  return ok(world, `You signed a professional ${sport} contract. Athletics has become your career rather than an extracurricular.`);
}

function businessAction(source: WorldState, action: IntentAction): ActionResult {
  const actor = source.characters[source.playerCharacterId];
  const business = ownedBusiness(source, action.targetIds);
  if (!business) return blocked(source, 'Choose an active business you own.');
  const productId = typeof action.parameters.productId === 'string' ? action.parameters.productId : action.targetIds.find((id) => business.productLines?.some((product) => product.id === id));

  if (action.verb === 'business.add_product') {
    const cost = amount(action, 2_000_000);
    if (business.cashCents < cost) return blocked(source, `${business.name} needs ${money(cost)} in company cash to develop another offering.`);
    if ((business.productLines?.filter((product) => product.active).length ?? 0) >= 6) return blocked(source, 'The company already has enough active product lines that another one would create more clutter than depth.');
    const world = clone(source);
    const next = world.businesses[business.id];
    next.productLines = next.productLines ?? [];
    next.cashCents -= cost;
    const id = allocateId(world, 'product');
    const name = typeof action.parameters.name === 'string' && action.parameters.name.trim() ? action.parameters.name.trim().slice(0, 40) : `New ${next.sector} offering`;
    const quality = clamp(42 + effectiveBusinessCompetence(world, actor.id) * 0.25 + competency(world, actor.id, 'sales') * 0.12);
    next.productLines.push({ id, name, priceCents: 10_000, unitCostCents: 4_800, quality, demand: Math.max(5, next.demand * 0.12), reputation: Math.max(28, next.reputation * 0.65), maturity: 'new', active: true });
    next.complexity = clamp((next.complexity ?? 20) + 7);
    gainCompetency(world.characters[actor.id], 'management', 0.8);
    gainCompetency(world.characters[actor.id], 'sales', 0.8);
    createMemory(world, `Business · ${next.id} product`, [actor.id, next.id], `${next.name} launched ${name}. The product now has its own quality, demand, reputation, cost, maturity, and lifecycle instead of disappearing into one company-wide number.`, 64, true);
    return ok(world, `${next.name} spent ${money(cost)} launching ${name}. You now have another product to grow—or eventually kill.`);
  }

  const product = business.productLines?.find((item) => item.id === productId) ?? business.productLines?.find((item) => item.active);
  if (!product) return blocked(source, 'Choose an active product line first.');

  if (action.verb === 'business.improve_product') {
    const cost = amount(action, 1_200_000);
    if (business.cashCents < cost) return blocked(source, `${business.name} needs ${money(cost)} in company cash for that product investment.`);
    const world = clone(source);
    const next = world.businesses[business.id];
    const nextProduct = next.productLines!.find((item) => item.id === product.id)!;
    next.cashCents -= cost;
    const skill = effectiveBusinessCompetence(world, actor.id);
    nextProduct.quality = clamp(nextProduct.quality + 4 + skill / 18);
    nextProduct.reputation = clamp(nextProduct.reputation + 2.5 + competency(world, actor.id, 'sales') / 45);
    nextProduct.demand = Math.max(1, nextProduct.demand * (1.03 + nextProduct.quality / 2500));
    gainCompetency(world.characters[actor.id], 'management', 0.6);
    return ok(world, `${product.name} got a real product investment. Quality, reputation, and demand improved, while the company cash left immediately.`);
  }

  if (action.verb === 'business.retire_product') {
    const world = clone(source);
    const next = world.businesses[business.id];
    const nextProduct = next.productLines!.find((item) => item.id === product.id)!;
    if (next.productLines!.filter((item) => item.active).length <= 1) return blocked(source, 'A business needs at least one active offering.');
    nextProduct.active = false;
    nextProduct.maturity = 'declining';
    next.complexity = clamp((next.complexity ?? 20) - 5);
    recordHistory(world, 'business', `${next.name} retired ${nextProduct.name}`, 'The company deliberately stopped carrying an offering that no longer deserved the time, capital, and management attention.', { subjectIds: [next.id], importance: 2 });
    return ok(world, `${nextProduct.name} is retired. Revenue may shrink, but management complexity falls too.`);
  }

  const targets = Object.values(source.businesses).filter((candidate) => candidate.active && candidate.id !== business.id && (candidate.ownerId ?? candidate.founderId) !== actor.id && candidate.valuationCents > 0).sort((left, right) => left.valuationCents - right.valuationCents);
  const target = action.targetIds.map((id) => source.businesses[id]).find((candidate) => targets.some((item) => item.id === candidate?.id)) ?? targets[0];
  if (!target) return blocked(source, 'There is no operating acquisition target in the current world.');
  const price = Math.round(target.valuationCents * (1.08 + target.reputation / 800));
  if (business.cashCents < price) return blocked(source, `${business.name} would need about ${money(price)} in company cash to buy ${target.name}.`);
  const world = clone(source);
  const buyer = world.businesses[business.id];
  const acquired = world.businesses[target.id];
  buyer.cashCents -= price;
  buyer.employees += acquired.employees;
  buyer.capacity += acquired.capacity;
  buyer.demand += acquired.demand * 0.72;
  buyer.valuationCents = Math.round(buyer.valuationCents + acquired.valuationCents * 0.85);
  buyer.productLines = [...(buyer.productLines ?? []), ...(acquired.productLines ?? []).map((line) => ({ ...line, id: `${buyer.id}-${line.id}` }))];
  buyer.locations = (buyer.locations ?? 1) + (acquired.locations ?? 1);
  buyer.complexity = clamp((buyer.complexity ?? 20) + 14 + (acquired.complexity ?? 20) * 0.22);
  acquired.active = false;
  world.organizations[acquired.organizationId].history.push(`Acquired by ${buyer.name} in week ${world.calendar.week}.`);
  gainCompetency(world.characters[actor.id], 'finance', 1.4);
  gainCompetency(world.characters[actor.id], 'negotiation', 1.3);
  gainCompetency(world.characters[actor.id], 'management', 1.1);
  recordHistory(world, 'business', `${buyer.name} acquired ${acquired.name}`, `You paid ${money(price)} for an operating company. Customers, employees, products, and complexity came with the deal; the purchase price was only the first consequence.`, { important: true, subjectIds: [buyer.id, acquired.id], importance: 4 });
  return ok(world, `${buyer.name} acquired ${acquired.name} for about ${money(price)}. The company is larger and materially harder to run.`);
}

function privateDeal(source: WorldState, action: IntentAction): ActionResult {
  const actor = source.characters[source.playerCharacterId];
  const dealMemory = Object.values(source.memories).find((memory) => memory.category === 'Opportunity · Private deal flow' && memory.participantIds.includes(actor.id) && memory.unresolved);
  if (!dealMemory) return blocked(source, 'You do not currently have private deal access. Strong capital, reputation, and trusted financial relationships can create it.');
  const minimum = 2_500_000;
  const investment = amount(action, minimum);
  if (investment < minimum || actor.cashCents < investment) return blocked(source, `Private deals currently require at least ${money(minimum)} in available cash.`);
  const world = clone(source);
  const nextActor = world.characters[actor.id];
  const quality = clamp(44 + competency(world, actor.id, 'investing') * 0.28 + roll(world) * 25);
  const volatility = clamp(38 + roll(world) * 45);
  const securityId = allocateId(world, 'security');
  world.securities[securityId] = { id: securityId, symbol: `PVT${world.metadata.nextSequence.toString(36).toUpperCase()}`, name: 'Private Growth Partnership', sector: 'Private Markets', priceCents: 10_000, quality, volatility, dividendYieldBps: 0 };
  const holdingId = allocateId(world, 'holding');
  world.holdings[holdingId] = { id: holdingId, ownerId: actor.id, securityId, unitsMilli: Math.floor(investment * 1000 / 10_000), costBasisCents: investment };
  nextActor.cashCents -= investment;
  gainCompetency(nextActor, 'investing', 1.7);
  gainCompetency(nextActor, 'finance', 0.8);
  dealMemory.unresolved = false;
  dealMemory.narrative = `${dealMemory.narrative} You eventually committed ${money(investment)} to a private deal introduced through the relationship.`;
  recordHistory(world, 'wealth', 'Entered a private deal', `Public markets were no longer the whole investing universe. Relationship access turned into an illiquid private position with its own quality and risk.`, { importance: 3 });
  return ok(world, `You invested ${money(investment)} in a private deal. It is now a real holding, not a flavor event.`);
}

function dynastyAction(source: WorldState, action: IntentAction): ActionResult {
  const actor = source.characters[source.playerCharacterId];
  const livingFamily = Object.values(source.relationships)
    .filter((relationship) => relationship.characterIds.includes(actor.id) && ['child', 'sibling', 'relative', 'spouse', 'partner'].includes(relationship.kind))
    .map((relationship) => ({ relationship, person: source.characters[relationship.characterIds.find((id) => id !== actor.id)!] }))
    .filter((item) => item.person?.isAlive);
  if (livingFamily.length === 0) return blocked(source, 'There is not enough living family around you for that dynasty action.');

  if (action.verb === 'dynasty.family_council') {
    const world = clone(source);
    const participants = [actor.id];
    let totalResentment = 0;
    for (const { relationship, person } of livingFamily.slice(0, 8)) {
      const next = world.relationships[relationship.id];
      next.trust = clamp(next.trust + 2.5);
      next.respect = clamp(next.respect + 2);
      next.resentment = clamp(next.resentment - 1.5);
      next.lastInteractionWeek = world.calendar.week;
      totalResentment += next.resentment;
      participants.push(person.id);
    }
    createMemory(world, 'Dynasty · Family council', participants, 'The family talked about money, expectations, ownership, care, and succession in the same room. Nobody had to agree for ambiguity to become smaller.', 76, true);
    return ok(world, `You held a family council with ${participants.length - 1} relatives. Trust improved a little, and future succession conflict now has more shared context.`);
  }

  const targetId = action.targetIds[0] ?? source.dynasty.activeHeirId ?? livingFamily.find((item) => item.relationship.kind === 'child')?.person.id;
  const target = source.characters[targetId];
  if (!target?.isAlive) return blocked(source, 'Choose a living family member to develop as an heir.');
  const relationship = Object.values(source.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(target.id));
  if (!relationship) return blocked(source, 'The chosen heir needs an actual relationship with you.');
  const world = clone(source);
  const nextTarget = world.characters[target.id];
  const nextRelationship = world.relationships[relationship.id];
  for (const skill of ['leadership', 'management', 'finance', 'negotiation'] as CompetencyKey[]) gainCompetency(nextTarget, skill, 1.6 + actor.knowledge / 120);
  nextTarget.knowledge = clamp(nextTarget.knowledge + 0.8);
  nextRelationship.respect = clamp(nextRelationship.respect + 4);
  nextRelationship.trust = clamp(nextRelationship.trust + 3);
  nextRelationship.lastInteractionWeek = world.calendar.week;
  createMemory(world, 'Dynasty · Heir development', [actor.id, target.id], `${actor.firstName} deliberately began preparing ${target.firstName} for responsibility instead of assuming inheritance would create competence after the fact.`, 78, true);
  return ok(world, `${target.firstName} gained leadership, management, finance, and negotiation experience. Being the heir can now become a developed role rather than a label at death.`);
}

function politicsAction(source: WorldState, action: IntentAction): ActionResult {
  const actor = source.characters[source.playerCharacterId];
  const politics = source.politics[actor.id];
  if (!politics?.campaign && !politics?.office) return blocked(source, 'You need an active campaign or political office first.');
  const world = clone(source);
  const nextActor = world.characters[actor.id];
  const nextPolitics = world.politics[actor.id];

  if (action.verb === 'politics.build_coalition') {
    const skill = competency(world, actor.id, 'politics') * 0.42 + competency(world, actor.id, 'negotiation') * 0.28 + nextActor.charisma * 0.18 + nextActor.empathy * 0.12;
    const success = skill + roll(world) * 26 >= 58;
    gainCompetency(nextActor, 'politics', 1.2);
    gainCompetency(nextActor, 'negotiation', 0.8);
    if (nextPolitics.campaign) nextPolitics.campaign.support = clamp(nextPolitics.campaign.support + (success ? 5 : -1.5));
    else nextPolitics.approval = clamp(nextPolitics.approval + (success ? 3.5 : -1));
    nextActor.reputation.political = clamp(nextActor.reputation.political + (success ? 2 : 0.3));
    createMemory(world, 'Politics · Coalition', [actor.id], success ? 'You built a working coalition across people who did not all want the same thing. The support is real because it came from negotiation, not a flat approval bonus.' : 'You tried to build a broader coalition and discovered that being visible is not the same as being trusted across factions.', success ? 58 : 52, !success);
    return ok(world, success ? 'The coalition held. Support and political reputation improved.' : 'The coalition effort mostly stalled. You gained experience, but not much support.');
  }

  const cost = amount(action, 350_000);
  if (actor.cashCents < cost) return blocked(source, `You need ${money(cost)} to recruit serious political staff.`);
  nextActor.cashCents -= cost;
  const staffId = allocateId(world, 'character');
  world.characters[staffId] = { id: staffId, firstName: 'Morgan', lastName: 'Reed', birthWeek: world.calendar.week - 37 * 52, isAlive: true, cityId: actor.cityId, householdId: `household-${staffId}`, parentIds: [], childIds: [], cashCents: 4_000_000, health: 76, mood: 64, stress: 46, discipline: 82, ambition: 79, empathy: 61, riskTolerance: 48, ethics: 68, knowledge: 78, charisma: 74, fitness: 49, focuses: ['Campaign', 'Networking', 'Job'], reputation: { public: 48, business: 44, employee: 68, political: 78, professional: 75, family: 50, faction: 25 }, detailTier: 'standard', lastMeaningfulWeek: world.calendar.week };
  ensureCompetencies(world.characters[staffId]);
  world.characters[staffId].competencies!.politics = 82;
  world.characters[staffId].competencies!.communication = 78;
  world.characters[staffId].competencies!.management = 75;
  const relationshipId = allocateId(world, 'relationship');
  world.relationships[relationshipId] = { id: relationshipId, characterIds: [actor.id, staffId], kind: 'professional', trust: 48, affection: 25, respect: 68, resentment: 0, lastInteractionWeek: world.calendar.week };
  nextActor.reputation.political = clamp(nextActor.reputation.political + 2);
  if (nextPolitics.campaign) nextPolitics.campaign.support = clamp(nextPolitics.campaign.support + 3);
  createMemory(world, 'Politics · Senior staff', [actor.id, staffId], 'A capable political operator joined your orbit. Staff can become loyal, ambitious, indispensable, resentful, or eventually powerful in their own right.', 72, true);
  return ok(world, `You spent ${money(cost)} recruiting Morgan Reed as serious political staff. Politics now has another persistent person inside it.`);
}

export function executeDeepSimulationAction(source: WorldState, action: IntentAction): ActionResult | null {
  if (!DEEP_VERBS.has(action.verb)) return null;
  if (action.verb === 'skills.practice') return practiceSkill(source, action);
  if (action.verb.startsWith('career.')) return careerAction(source, action);
  if (action.verb.startsWith('education.')) return educationAction(source, action);
  if (action.verb.startsWith('sports.')) return sportsAction(source, action);
  if (action.verb.startsWith('business.')) return businessAction(source, action);
  if (action.verb === 'markets.private_deal') return privateDeal(source, action);
  if (action.verb.startsWith('dynasty.')) return dynastyAction(source, action);
  if (action.verb.startsWith('politics.')) return politicsAction(source, action);
  return null;
}
