import { gainCompetency } from './competencies';
import { allocateId, playerAgeYears } from './createWorld';
import { recordHistory } from './history';
import { getDeepTimeBudget } from './timeSystem';
import type { ActionResult, GameEvent, IntentAction, JourneyState, LifePlanId, PersonalProject, WorldState } from './types';

import { PERSONAL_PROJECTS, type ProjectDefinition } from '@/content/journeyCatalog';

const clamp = (value: number) => Math.max(0, Math.min(100, value));
const clone = (world: WorldState): WorldState => JSON.parse(JSON.stringify(world)) as WorldState;
const projectDefinition = (project: PersonalProject) => PERSONAL_PROJECTS.find((item) => item.id === project.catalogId);
const planKey = (world: WorldState, id: LifePlanId) => `${world.playerCharacterId}:${id}`;

function journal(world: WorldState): JourneyState {
  return world.journey ??= { projects: {}, activePlans: {}, completedPlans: {}, socialWeeks: {} };
}

export function personalProjects(world: WorldState): PersonalProject[] {
  return Object.values(world.journey?.projects ?? {}).filter((project) => project.characterId === world.playerCharacterId).sort((a, b) => b.startedWeek - a.startedWeek || a.id.localeCompare(b.id));
}

export function projectStartReason(world: WorldState, definition: ProjectDefinition): string | undefined {
  const actor = world.characters[world.playerCharacterId];
  if (!actor.isAlive) return 'Continue as an heir to make new plans.';
  if (playerAgeYears(world) < definition.minimumAge) return `Available from age ${definition.minimumAge}.`;
  if (world.events.some((event) => !event.resolved)) return 'Resolve the waiting decision first.';
  if (personalProjects(world).some((project) => project.status === 'active' || project.status === 'paused')) return 'Finish or leave your current project before starting another.';
  if (personalProjects(world).some((project) => project.catalogId === definition.id && world.calendar.week - (project.completedWeek ?? project.startedWeek) < 26)) return 'Give this experience time to settle. Try it again after 26 weeks, or choose something different.';
  if (actor.cashCents < definition.costCents) return `Set aside $${definition.costCents / 100} for materials first.`;
  if (definition.id === 'mentoring' && !Object.values(world.careers).some((career) => career.characterId === actor.id && career.weeksInRole >= 52)) return 'Build at least one year of experience in a role before mentoring.';
  return undefined;
}

export function socialCircle(world: WorldState) {
  const actor = world.characters[world.playerCharacterId];
  return Object.values(world.relationships)
    .filter((relationship) => relationship.characterIds.includes(actor.id) && ['parent', 'child', 'sibling', 'relative', 'friend', 'spouse', 'partner'].includes(relationship.kind))
    .filter((relationship) => relationship.characterIds.some((id) => id !== actor.id && world.characters[id]?.isAlive))
    .sort((a, b) => a.lastInteractionWeek - b.lastInteractionWeek || a.id.localeCompare(b.id))
    .filter((relationship, index, relationships) => relationships.findIndex((other) => other.characterIds.find((id) => id !== actor.id) === relationship.characterIds.find((id) => id !== actor.id)) === index)
    .slice(0, 5);
}

function result(world: WorldState, message: string, valid = true, requiresConfirmation = false): ActionResult {
  return { world, message, validation: { valid, requiresConfirmation, reason: valid ? undefined : message } };
}

export function executeJourneyAction(source: WorldState, action: IntentAction, confirmed = false): ActionResult | null {
  if (!['life.choose_plan', 'life.clear_plan', 'life.project_start', 'life.project_pause', 'life.project_resume', 'life.project_leave', 'relationship.keep_in_touch'].includes(action.verb)) return null;
  const actor = source.characters[source.playerCharacterId];
  if (!actor.isAlive) return result(source, 'Continue as an heir to make new plans.', false);
  if (action.verb === 'life.choose_plan' || action.verb === 'life.clear_plan') {
    const plan = action.verb === 'life.choose_plan' ? lifePlans(source).find((item) => item.id === action.parameters.planId) : undefined;
    if (action.verb === 'life.choose_plan' && !plan) return result(source, 'That plan is not available at this stage of life.', false);
    const world = clone(source);
    if (plan) journal(world).activePlans[actor.id] = plan.id;
    else delete journal(world).activePlans[actor.id];
    checkLifePlan(world);
    return result(world, plan ? `Following “${plan.title}”. Your choices and progress will guide the next step.` : 'Your plan is set aside. Its recorded milestones remain.');
  }
  if (source.events.some((event) => !event.resolved)) return result(source, 'Resolve the waiting decision first.', false);
  if (action.verb === 'relationship.keep_in_touch') {
    if (playerAgeYears(source) < 8) return result(source, 'Caregivers handle your social plans until age 8.', false);
    if (source.journey?.socialWeeks[actor.id] === source.calendar.week) return result(source, 'You already caught up with your circle this week. Advance time before arranging another catch-up.', false);
    const circle = socialCircle(source);
    if (!circle.length) return result(source, 'There is nobody in your living family and friend circle to contact yet.', false);
    const world = clone(source);
    journal(world).socialWeeks[actor.id] = world.calendar.week;
    const names: string[] = [];
    for (const link of circle) {
      const relationship = world.relationships[link.id];
      const other = world.characters[link.characterIds.find((id) => id !== actor.id)!];
      names.push(other.firstName);
      relationship.lastInteractionWeek = world.calendar.week;
      relationship.affection = clamp(relationship.affection + 2);
      relationship.trust = clamp(relationship.trust + 1);
      other.lastMeaningfulWeek = world.calendar.week;
    }
    const detail = `You caught up with ${names.join(', ')}. Small contact keeps the connection alive; serious disagreements still need a personal conversation.`;
    recordHistory(world, 'relationship', 'Made time for your circle', detail, { subjectIds: [actor.id, ...circle.map((link) => link.characterIds.find((id) => id !== actor.id)!)] });
    return result(world, detail);
  }
  if (action.verb === 'life.project_start') {
    const definition = PERSONAL_PROJECTS.find((item) => item.id === action.parameters.projectId);
    if (!definition) return result(source, 'Choose a project from the available list.', false);
    const reason = projectStartReason(source, definition);
    if (reason) return result(source, reason, false);
    const world = clone(source);
    const id = allocateId(world, 'project');
    const state = journal(world);
    // Keep a bounded working journal; completed experiences remain in World History.
    const archived = Object.values(state.projects).filter((project) => ['completed', 'abandoned'].includes(project.status)).sort((a, b) => a.lastProcessedWeek - b.lastProcessedWeek);
    while (Object.keys(state.projects).length >= 120 && archived.length) delete state.projects[archived.shift()!.id];
    state.projects[id] = { id, characterId: actor.id, catalogId: definition.id, startedWeek: world.calendar.week, lastProcessedWeek: world.calendar.week, completedWeeks: 0, durationWeeks: definition.weeks, hoursPerWeek: definition.hours, status: 'active', approach: 'steady', checkpointHandled: false, update: 'The first step is scheduled. Advance time to begin.' };
    world.characters[actor.id].cashCents -= definition.costCents;
    if (definition.costCents) world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind: 'personal-project', amountCents: -definition.costCents, fromId: actor.id, memo: definition.title });
    recordHistory(world, definition.domain, `Started: ${definition.title}`, `${definition.hours} hours each week for ${definition.weeks} weeks. A halfway decision will let you change direction.`);
    return result(world, `${definition.title} is underway. It now takes ${definition.hours} hours of your week.`);
  }
  const project = source.journey?.projects[action.targetIds[0]];
  if (!project || project.characterId !== actor.id || !['active', 'paused'].includes(project.status)) return result(source, 'Choose one of your unfinished projects.', false);
  if (action.verb === 'life.project_leave' && !confirmed) return result(source, 'Leave this project? Materials already used are not refunded. Your other progress and memories stay.', false, true);
  if (action.verb === 'life.project_resume' && project.status !== 'paused') return result(source, 'This project is already active.', false);
  if (action.verb === 'life.project_pause' && project.status !== 'active') return result(source, 'This project is already paused.', false);
  const world = clone(source);
  const next = journal(world).projects[project.id];
  next.status = action.verb === 'life.project_leave' ? 'abandoned' : action.verb === 'life.project_resume' ? 'active' : 'paused';
  next.lastProcessedWeek = world.calendar.week;
  next.update = next.status === 'active' ? 'You made room to continue. Progress resumes next week.' : next.status === 'paused' ? 'Paused without losing progress. Its hours are free until you resume.' : 'You chose to move on. Your progress elsewhere is unchanged.';
  if (next.status === 'abandoned') recordHistory(world, 'life', 'A project set aside', projectDefinition(next)?.title ?? 'Personal project');
  return result(world, next.update);
}

export function resolveProjectCheckpoint(world: WorldState, event: GameEvent, choiceId: string): void {
  if (!event.templateId.startsWith('project.checkpoint:')) return;
  const project = world.journey?.projects[event.templateId.slice('project.checkpoint:'.length)];
  if (!project || project.characterId !== world.playerCharacterId || project.status !== 'active' || project.checkpointHandled) return;
  project.checkpointHandled = true;
  if (choiceId === 'stretch') {
    project.approach = 'stretch';
    project.durationWeeks += 4;
    project.hoursPerWeek += 2;
    project.update = 'A bigger version: four more weeks, two more hours each week, and more skill growth at completion.';
  } else if (choiceId === 'shared') {
    project.approach = 'shared';
    project.update = 'You are inviting others in. Completing the project will strengthen your living circle, with a smaller individual skill gain.';
  } else if (choiceId === 'pause') {
    project.status = 'paused';
    project.update = 'Paused at the halfway point. Resume when you have room.';
  } else project.update = 'You kept the original scope. A finished project is the goal.';
}

/** Runs inside each authoritative weekly tick, before event interruption. */
export function tickLifeJourney(world: WorldState): void {
  if (!world.journey) return;
  const actor = world.characters[world.playerCharacterId];
  for (const project of Object.values(world.journey.projects)) {
    if (!['active', 'paused'].includes(project.status)) continue;
    if (!world.characters[project.characterId]?.isAlive || project.characterId !== actor.id) {
      project.status = 'abandoned';
      project.update = 'This unfinished project belongs to an earlier life. Its history remains.';
      continue;
    }
    if (project.status !== 'active' || project.lastProcessedWeek >= world.calendar.week) continue;
    const definition = projectDefinition(project);
    if (!definition) { project.status = 'paused'; project.update = 'This project needs a compatible content version.'; continue; }
    project.lastProcessedWeek = world.calendar.week;
    if (world.events.some((event) => !event.resolved && event.templateId === `project.checkpoint:${project.id}`)) continue;
    if (getDeepTimeBudget(world).status === 'unsustainable' || actor.health < 25) {
      project.update = 'No progress this week: your schedule or health needs room to recover. Pause the project or reduce other commitments.';
      continue;
    }
    project.completedWeeks += 1;
    project.update = `${project.completedWeeks} of ${project.durationWeeks} weeks completed. Small steps are adding up.`;
    if (!project.checkpointHandled && project.completedWeeks >= Math.ceil(definition.weeks / 2)) {
      world.events.push({ id: allocateId(world, 'event'), templateId: `project.checkpoint:${project.id}`, domain: definition.domain, severity: 'S3', week: world.calendar.week, title: `${definition.title}: choose your direction`, narrative: definition.checkpoint, participantIds: [actor.id], resolved: false, otherActionFamilies: [], choices: [
        { id: 'steady', label: 'Keep the original plan', detail: `Stay with ${project.hoursPerWeek} hours each week and finish in ${project.durationWeeks - project.completedWeeks} more weeks.` },
        { id: 'stretch', label: 'Make it more ambitious', detail: `Add four weeks and two hours per week for more skill growth. Your other commitments still matter.` },
        { id: 'shared', label: 'Make it a shared experience', detail: 'Keep the schedule; trade some individual skill growth for stronger connections with your living family and friends.' },
        { id: 'pause', label: 'Put it on hold', detail: 'Keep your progress and free up the time. Resume from Life plans whenever you are ready.' },
      ] });
    } else if (project.completedWeeks >= project.durationWeeks) {
      project.status = 'completed';
      project.completedWeek = world.calendar.week;
      project.update = definition.outcome;
      gainCompetency(actor, definition.skill, project.approach === 'stretch' ? 9 : project.approach === 'shared' ? 3 : 6);
      actor.mood = clamp(actor.mood + 4);
      if (definition.id === 'practical') actor.discipline = clamp(actor.discipline + 2);
      if (definition.id === 'family-stories') actor.reputation.family = clamp(actor.reputation.family + 4);
      if (definition.id === 'community') actor.reputation.public = clamp(actor.reputation.public + 4);
      if (definition.id === 'mentoring') actor.reputation.professional = clamp(actor.reputation.professional + 4);
      if (project.approach === 'shared') for (const relationship of socialCircle(world)) {
        relationship.affection = clamp(relationship.affection + 5);
        relationship.trust = clamp(relationship.trust + 3);
        relationship.lastInteractionWeek = world.calendar.week;
      }
      recordHistory(world, definition.domain, `Completed: ${definition.title}`, `${definition.outcome} You chose the ${project.approach === 'stretch' ? 'ambitious' : project.approach} approach.`, { important: true, importance: 4 });
    }
  }
  checkLifePlan(world);
}

export interface PlanStep { label: string; done: boolean; route: string; hint: string; }
export interface LifePlan { id: LifePlanId; title: string; detail: string; steps: PlanStep[]; completed: boolean; }

/** Selectors do not change state, advance randomness, or grant rewards. */
export function lifePlans(world: WorldState): LifePlan[] {
  const actor = world.characters[world.playerCharacterId];
  const age = playerAgeYears(world);
  const completed = personalProjects(world).filter((project) => project.status === 'completed');
  const finished = (id: string) => completed.some((project) => project.catalogId === id);
  const career = Object.values(world.careers).find((item) => item.characterId === actor.id && item.active);
  const relations = Object.values(world.relationships).filter((link) => link.characterIds.includes(actor.id) && link.characterIds.every((id) => world.characters[id]?.isAlive));
  const ownedBusiness = Object.values(world.businesses).some((item) => item.active && (item.ownerId ?? item.founderId) === actor.id && item.playerOwnershipBps > 0 && item.revenueWeeklyCents > item.costWeeklyCents);
  const step = (label: string, done: boolean, route: string, hint: string): PlanStep => ({ label, done, route, hint });
  const candidates: (Omit<LifePlan, 'completed'> & { age: number })[] = [
    { id: 'connections', age: 8, title: 'A life with good people', detail: 'Measure a rich life in the people who are part of it.', steps: [step('Catch up with your circle', world.journey?.socialWeeks[actor.id] !== undefined, '/people', 'Use Keep in touch to reach up to five family members and friends.'), step('Build three strong connections', relations.filter((link) => link.trust >= 60 && link.affection >= 60).length >= 3, '/people', 'Spend time together and address what each relationship needs.'), step('Preserve a family story', finished('family-stories'), '/plans', 'Complete the family stories project below.')] },
    { id: 'craft', age: 14, title: 'Make something that lasts', detail: 'Explore a skill, finish real work, and then stretch yourself.', steps: [step('Complete a practical project', finished('practical'), '/plans', 'Start Build a practical skill and make room for its weekly hours.'), step('Finish a creative project', finished('creative'), '/plans', 'Take an idea through a first draft and a finished piece.'), step('Finish an ambitious project', completed.some((item) => item.approach === 'stretch'), '/plans', 'Choose the ambitious direction at a project’s halfway decision.')] },
    { id: 'independence', age: 18, title: 'Build your independence', detail: 'Steady income, a cushion, and a place of your own.', steps: [step('Earn from work or a profitable business', Boolean(career) || ownedBusiness, '/jobs', 'Apply for a role that fits your experience, or build a profitable company.'), step('Keep $10,000 in cash', actor.cashCents >= 1_000_000, '/money', 'Watch spending and debt payments. Cash is different from net worth.'), step('Own a place to live', Object.values(world.properties).some((item) => item.ownerId === actor.id && item.occupancy === 'owner'), '/property', 'Compare the purchase cost with the ongoing cost before choosing a home.')] },
    { id: 'career', age: 14, title: 'Find your footing at work', detail: 'A satisfying career grows through experience and sustainable effort.', steps: [step('Land a job', Boolean(career), '/jobs', 'Openings explain the age, skill, education, and experience they need.'), step('Build six months in your role', Boolean(career && career.weeksInRole >= 26), '/work', 'Protect time for your work and let experience build.'), step('Reach strong performance', Boolean(career && career.performance >= 70), '/work', 'Develop relevant skills and avoid an overloaded schedule.')] },
    { id: 'community', age: 12, title: 'Make your corner better', detail: 'Help your neighborhood and bring other people into the effort.', steps: [step('Complete a neighborhood project', finished('community'), '/plans', 'Help your neighborhood over eight weeks.'), step('Build a trusted public reputation', actor.reputation.public >= 60, '/plans', 'Consistent community work matters; a single gesture is only a start.'), step('Bring your circle into a project', completed.some((item) => item.approach === 'shared'), '/plans', 'Choose the shared direction at a project’s halfway decision, then see it through.')] },
    { id: 'legacy', age: 25, title: 'Leave more than money', detail: 'Pass on stories, experience, and a considered succession plan.', steps: [step('Preserve your family stories', finished('family-stories'), '/plans', 'Complete a family stories project to leave a keepsake.'), step('Mentor the next generation', finished('mentoring'), '/plans', 'Share experience from a role you held for at least a year.'), step('Choose a successor', Boolean(world.dynasty.activeHeirId && world.characters[world.dynasty.activeHeirId]?.isAlive), '/dynasty', 'Review the living heirs and set your succession preference.')] },
  ];
  return candidates.filter((plan) => age >= plan.age).map(({ age: _age, ...plan }) => ({ ...plan, completed: world.journey?.completedPlans[planKey(world, plan.id)] !== undefined }));
}

export function checkLifePlan(world: WorldState): void {
  const id = world.journey?.activePlans[world.playerCharacterId];
  if (!id || !world.characters[world.playerCharacterId].isAlive) return;
  const plan = lifePlans(world).find((item) => item.id === id);
  if (!plan || plan.completed || !plan.steps.every((step) => step.done)) return;
  journal(world).completedPlans[planKey(world, id)] = world.calendar.week;
  recordHistory(world, 'life', `Life milestone: ${plan.title}`, 'You reached every part of this personal goal. Choose a new direction whenever you want; this milestone stays in your history.', { important: true, importance: 4 });
}
