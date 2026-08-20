import { allocateId, playerAgeYears } from './createWorld';
import { recordHistory } from './history';
import { nextRandom } from './random';
import type { ActionResult, Character, IntentAction, MemoryRecord, Relationship, WorldState } from './types';

const RELATIONSHIP_DEPTH_VERBS = new Set([
  'relationship.prioritize',
  'relationship.deep_talk',
  'relationship.check_in',
  'relationship.apologize',
  'relationship.forgive',
  'relationship.celebrate',
  'relationship.gift',
  'relationship.date_night',
  'relationship.weekend_away',
  'relationship.support_goal',
  'relationship.ask_favor',
  'relationship.lend_money',
  'relationship.collect_loan',
  'relationship.set_boundary',
  'relationship.one_on_one',
  'relationship.reminisce',
  'relationship.plan_future',
  'relationship.introduce_network',
  'family.family_dinner',
  'family.help_school',
  'family.teach_money',
  'family.attend_event',
  'family.caregiving',
  'family.set_expectations',
  'family.invite_business',
  'family.discuss_inheritance',
]);

function clone(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world)) as WorldState;
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
  return { world, validation: { valid: true, requiresConfirmation: false }, message };
}

function blocked(source: WorldState, message: string): ActionResult {
  return { world: source, validation: { valid: false, reason: message, requiresConfirmation: false }, message };
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function numberParam(action: IntentAction, key: string, fallback = 0): number {
  const value = action.parameters[key];
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;
}

function actorAndTarget(source: WorldState, action: IntentAction): { actor: Character; target: Character; relationship: Relationship } | undefined {
  const actor = source.characters[source.playerCharacterId];
  const target = source.characters[action.targetIds[0]];
  if (!actor?.isAlive || !target?.isAlive || actor.id === target.id) return undefined;
  const relationship = Object.values(source.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(target.id));
  return relationship ? { actor, target, relationship } : undefined;
}

function roleFor(world: WorldState, targetId: string, relationship: Relationship): string {
  const actor = world.characters[world.playerCharacterId];
  if (actor.parentIds.includes(targetId)) return 'parent';
  if (actor.childIds.includes(targetId)) return 'child';
  return relationship.kind;
}

function isFamilyRole(role: string): boolean {
  return ['parent', 'child', 'sibling', 'relative', 'partner', 'spouse'].includes(role);
}

function recentSharedMemories(world: WorldState, leftId: string, rightId: string): MemoryRecord[] {
  return Object.values(world.memories)
    .filter((memory) => memory.participantIds.includes(leftId) && memory.participantIds.includes(rightId))
    .sort((left, right) => right.week - left.week);
}

function upsertMemory(
  world: WorldState,
  category: string,
  participantIds: string[],
  narrative: string,
  importance: number,
  options: Partial<Pick<MemoryRecord, 'valence' | 'permanent' | 'unresolved' | 'visibility'>> = {},
): MemoryRecord {
  const existing = Object.values(world.memories)
    .filter((memory) => memory.category === category && participantIds.every((id) => memory.participantIds.includes(id)))
    .sort((left, right) => right.week - left.week)[0];
  if (existing && world.calendar.week - existing.week <= 26) {
    existing.narrative = narrative;
    existing.importance = Math.max(existing.importance, importance);
    existing.valence = options.valence ?? existing.valence;
    existing.permanent = options.permanent ?? existing.permanent;
    existing.unresolved = options.unresolved ?? existing.unresolved;
    existing.visibility = options.visibility ?? existing.visibility;
    return existing;
  }
  const id = allocateId(world, 'memory');
  const memory: MemoryRecord = {
    id,
    participantIds,
    category,
    week: world.calendar.week,
    valence: options.valence ?? 0,
    importance,
    permanent: options.permanent ?? false,
    unresolved: options.unresolved ?? false,
    visibility: options.visibility ?? 'shared',
    narrative,
  };
  world.memories[id] = memory;
  return memory;
}

function addTransaction(world: WorldState, kind: string, amountCents: number, memo: string, fromId?: string, toId?: string): void {
  world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind, amountCents, memo, fromId, toId });
  if (world.transactions.length > 1_200) world.transactions.splice(0, world.transactions.length - 1_200);
}

function activeCareer(world: WorldState, characterId: string) {
  return Object.values(world.careers).find((career) => career.characterId === characterId && career.active);
}

function activeEducation(world: WorldState, characterId: string) {
  return Object.values(world.education).find((record) => record.characterId === characterId && ['school', 'higher', 'trade'].includes(record.status));
}

function setPriorityFocus(world: WorldState, targetId: string, relationship: Relationship): string {
  const actor = world.characters[world.playerCharacterId];
  const role = roleFor(world, targetId, relationship);
  const focus = ['partner', 'spouse'].includes(role) ? 'Partner' : isFamilyRole(role) ? 'Family' : 'Networking';
  actor.focuses = [focus as typeof actor.focuses[number], ...actor.focuses.filter((item) => item !== focus)].slice(0, 3);
  return focus;
}

function markOneConflictResolved(world: WorldState, actorId: string, targetId: string, resolution: string): void {
  const memory = recentSharedMemories(world, actorId, targetId).find((item) => item.unresolved && item.valence < 0 && !item.category.startsWith('Thread ·'));
  if (!memory) return;
  memory.unresolved = false;
  memory.narrative = `${memory.narrative} ${resolution}`;
}

export function relationshipLoanBalance(world: WorldState, personId: string): number {
  const actorId = world.playerCharacterId;
  const lent = world.transactions
    .filter((transaction) => transaction.kind === 'relationship-loan' && transaction.fromId === actorId && transaction.toId === personId)
    .reduce((sum, transaction) => sum + Math.abs(transaction.amountCents), 0);
  const repaid = world.transactions
    .filter((transaction) => transaction.kind === 'relationship-loan-repayment' && transaction.fromId === personId && transaction.toId === actorId)
    .reduce((sum, transaction) => sum + Math.abs(transaction.amountCents), 0);
  return Math.max(0, lent - repaid);
}

export function relationshipNeed(world: WorldState, personId: string): { title: string; detail: string; tone: 'success' | 'warning' | 'danger' | 'accent' | 'neutral' } {
  const actor = world.characters[world.playerCharacterId];
  const relationship = Object.values(world.relationships).find((item) => item.characterIds.includes(actor.id) && item.characterIds.includes(personId));
  const person = world.characters[personId];
  if (!relationship || !person) return { title: 'Still mostly unknown', detail: 'There is not enough shared history yet to know what this relationship needs.', tone: 'neutral' };
  const staleWeeks = world.calendar.week - relationship.lastInteractionWeek;
  const role = roleFor(world, personId, relationship);
  const unresolved = recentSharedMemories(world, actor.id, personId).filter((memory) => memory.unresolved && memory.valence < 0);
  const loan = relationshipLoanBalance(world, personId);

  if (relationship.resentment >= 58 || unresolved.length >= 2) return { title: 'Repair before adding more history', detail: `${person.firstName} is carrying enough resentment or unresolved history that another pleasant hangout probably will not fix the actual problem.`, tone: 'danger' };
  if (loan > 0) return { title: 'Money is part of the relationship now', detail: `${money(loan)} is still outstanding between you. Even strong relationships can become strange when money stays unresolved.`, tone: 'warning' };
  if (staleWeeks >= 20) return { title: 'Attention', detail: `It has been ${staleWeeks} weeks since a real interaction. The relationship needs presence more than a grand gesture.`, tone: 'warning' };
  if (['partner', 'spouse'].includes(role) && relationship.affection >= 68 && relationship.trust >= 62) return { title: 'Build shared life, not just good stats', detail: `Things with ${person.firstName} are strong enough that planning, shared experiences, and future decisions matter more than basic reassurance.`, tone: 'accent' };
  if (role === 'child') {
    const age = Math.max(0, Math.floor((world.calendar.week - person.birthWeek) / 52));
    return { title: age < 18 ? 'Show up while this version of them still exists' : 'Treat the adult relationship like its own thing', detail: age < 18 ? 'One-on-one time, school support, events, boundaries, and ordinary reliability will compound into the adult relationship.' : 'Advice lands differently now. Respect, practical support, and letting them have their own life matter more.', tone: 'accent' };
  }
  if (relationship.trust < 50) return { title: 'Trust', detail: 'Consistency, honesty, and lower-stakes follow-through will do more than a dramatic gesture right now.', tone: 'warning' };
  if (relationship.affection < 48) return { title: 'Warmth', detail: 'There is enough respect to keep the relationship, but not enough recent warmth to make it feel close.', tone: 'neutral' };
  return { title: 'Keep doing ordinary things', detail: 'This relationship is healthy enough that the main risk is assuming it will maintain itself forever.', tone: 'success' };
}

export function executeRelationshipDepth(source: WorldState, action: IntentAction, confirmed = false): ActionResult | null {
  if (!RELATIONSHIP_DEPTH_VERBS.has(action.verb)) return null;
  const found = actorAndTarget(source, action);
  if (!found) return blocked(source, 'Choose a living person you already know.');
  const { actor, target, relationship } = found;
  const role = roleFor(source, target.id, relationship);
  const actorAge = playerAgeYears(source);
  const targetAge = Math.max(0, Math.floor((source.calendar.week - target.birthWeek) / 52));

  if (action.verb === 'relationship.prioritize') {
    const world = clone(source);
    const nextRelationship = world.relationships[relationship.id];
    const focus = setPriorityFocus(world, target.id, nextRelationship);
    nextRelationship.lastInteractionWeek = world.calendar.week;
    upsertMemory(world, 'Relationship · Priority', [actor.id, target.id], `${actor.firstName} made a deliberate decision to protect time for ${target.firstName}. The standing ${focus.toLowerCase()} priority will now compete with work, school, business, health, and everything else asking for the same week.`, 68, { valence: 0.65, unresolved: false, permanent: false });
    recordHistory(world, 'relationship', `${target.firstName} became a priority`, `You chose to make the relationship part of how the calendar gets allocated, not just something you remember when nothing else is happening.`, { subjectIds: [actor.id, target.id], importance: 3 });
    return ok(world, `${target.firstName} is now reflected in your standing priorities. That will help, but it still competes with the rest of your life.`);
  }

  if (action.verb === 'relationship.deep_talk') {
    const world = clone(source);
    const nextActor = world.characters[actor.id];
    const nextTarget = world.characters[target.id];
    const nextRelationship = world.relationships[relationship.id];
    const readiness = nextActor.empathy * 0.3 + nextActor.charisma * 0.08 + nextTarget.empathy * 0.2 + nextRelationship.trust * 0.28 + nextRelationship.respect * 0.14 - nextRelationship.resentment * 0.3;
    const wentWell = readiness + roll(world) * 35 >= 58;
    nextRelationship.lastInteractionWeek = world.calendar.week;
    if (wentWell) {
      nextRelationship.trust = clamp(nextRelationship.trust + 6);
      nextRelationship.affection = clamp(nextRelationship.affection + 3.5);
      nextRelationship.respect = clamp(nextRelationship.respect + 2.5);
      nextRelationship.resentment = clamp(nextRelationship.resentment - 3.5);
      nextActor.mood = clamp(nextActor.mood + 2);
      nextTarget.mood = clamp(nextTarget.mood + 2);
      markOneConflictResolved(world, actor.id, target.id, 'A later honest conversation took some of the heat out of it.');
      upsertMemory(world, 'Relationship · Honest conversation', [actor.id, target.id], `You and ${target.firstName} had the kind of conversation that changed what each of you understood about the other. It did not solve every future problem; it gave future problems more trust to work with.`, 72, { valence: 0.75 });
      return ok(world, `The conversation with ${target.firstName} went somewhere real. Trust improved more than affection because you actually understood each other better.`);
    }
    nextRelationship.trust = clamp(nextRelationship.trust - 1.5);
    nextRelationship.resentment = clamp(nextRelationship.resentment + 2.5);
    upsertMemory(world, 'Relationship · Conversation missed', [actor.id, target.id], `You tried to go deeper with ${target.firstName}, but timing, defensiveness, or old history got in the way. The attempt is now part of the relationship too.`, 48, { valence: -0.35, unresolved: true });
    return ok(world, `You tried to have a real conversation with ${target.firstName}, but it landed badly. The relationship needs a different approach before forcing the same conversation again.`);
  }

  if (action.verb === 'relationship.check_in') {
    const world = clone(source);
    const nextTarget = world.characters[target.id];
    const nextRelationship = world.relationships[relationship.id];
    const career = activeCareer(world, target.id);
    const education = activeEducation(world, target.id);
    const pressure = nextTarget.stress >= 70 ? 'They admitted they have been carrying more stress than they let on.'
      : nextTarget.health < 58 ? 'Their health has been taking more attention than usual.'
        : career && career.satisfaction < 45 ? `Work as ${career.title} has been getting under their skin.`
          : education && education.recordedGrade < 62 ? 'School has felt shakier than they wanted to admit.'
            : nextTarget.cashCents < 0 ? 'Money has been tighter than they were saying out loud.'
              : 'Nothing is on fire; they mostly appreciated being asked without an agenda.';
    nextRelationship.trust = clamp(nextRelationship.trust + 3.5);
    nextRelationship.affection = clamp(nextRelationship.affection + 1.5);
    nextRelationship.lastInteractionWeek = world.calendar.week;
    upsertMemory(world, 'Relationship · What they told you', [actor.id, target.id], `${target.firstName} let you a little further into their life. ${pressure}`, 54, { valence: 0.35 });
    return ok(world, `${pressure} ${target.firstName} noticed that you asked about their life instead of immediately talking about yours.`);
  }

  if (action.verb === 'relationship.apologize') {
    const shared = recentSharedMemories(source, actor.id, target.id);
    if (relationship.resentment < 5 && !shared.some((memory) => memory.unresolved && memory.valence < 0)) return blocked(source, `There is not much active hurt with ${target.firstName} to apologize for right now.`);
    const world = clone(source);
    const nextActor = world.characters[actor.id];
    const nextTarget = world.characters[target.id];
    const nextRelationship = world.relationships[relationship.id];
    const sincerity = nextActor.empathy * 0.32 + nextActor.ethics * 0.26 + nextRelationship.trust * 0.18 + nextTarget.empathy * 0.14 + nextRelationship.respect * 0.1;
    const accepted = sincerity + roll(world) * 32 >= 52;
    nextRelationship.lastInteractionWeek = world.calendar.week;
    if (accepted) {
      const reduction = 7 + sincerity / 10;
      nextRelationship.resentment = clamp(nextRelationship.resentment - reduction);
      nextRelationship.trust = clamp(nextRelationship.trust + 4);
      nextRelationship.respect = clamp(nextRelationship.respect + 2);
      markOneConflictResolved(world, actor.id, target.id, 'You later apologized without trying to erase what happened.');
      upsertMemory(world, 'Relationship · Apology', [actor.id, target.id], `${actor.firstName} apologized to ${target.firstName} and took responsibility without demanding instant forgiveness. The apology did not erase the memory; it changed what the memory means going forward.`, 70, { valence: 0.55, permanent: relationship.resentment >= 40 });
      return ok(world, `${target.firstName} accepted the apology. The hurt did not vanish, but the relationship has room to move again.`);
    }
    nextRelationship.resentment = clamp(nextRelationship.resentment + 2);
    nextRelationship.respect = clamp(nextRelationship.respect - 1);
    upsertMemory(world, 'Relationship · Apology landed badly', [actor.id, target.id], `${target.firstName} did not experience the apology as repair. Whether it was timing, wording, or old history, trying to force closure made the room colder.`, 58, { valence: -0.5, unresolved: true });
    return ok(world, `${target.firstName} was not ready to accept the apology. Pushing harder right now would probably make it worse.`);
  }

  if (action.verb === 'relationship.forgive') {
    const world = clone(source);
    const nextRelationship = world.relationships[relationship.id];
    const grievance = recentSharedMemories(world, actor.id, target.id).find((memory) => memory.unresolved && memory.valence < 0);
    if (!grievance && nextRelationship.resentment < 8) return blocked(source, `There is no major unresolved grievance with ${target.firstName} to forgive.`);
    nextRelationship.resentment = clamp(nextRelationship.resentment - 10);
    nextRelationship.trust = clamp(nextRelationship.trust + (nextRelationship.trust < 45 ? 1 : 2));
    nextRelationship.lastInteractionWeek = world.calendar.week;
    if (grievance) {
      grievance.unresolved = false;
      grievance.narrative = `${grievance.narrative} You eventually chose to stop making the old injury pay rent in every future interaction.`;
    }
    upsertMemory(world, 'Relationship · Forgiveness', [actor.id, target.id], `You chose to forgive ${target.firstName}. Forgiveness lowered the active resentment without pretending trust instantly returned to where it was before.`, 66, { valence: 0.45 });
    return ok(world, `You let some of the resentment toward ${target.firstName} go. Trust still has to be rebuilt through behavior.`);
  }

  if (action.verb === 'relationship.celebrate' || action.verb === 'relationship.gift') {
    const defaultCost = action.verb === 'relationship.gift' ? 20_000 : 7_500;
    const cost = numberParam(action, 'amountCents', defaultCost);
    if (actor.cashCents < cost) return blocked(source, `You need ${money(cost)} in cash for that gesture.`);
    const world = clone(source);
    const nextActor = world.characters[actor.id];
    const nextTarget = world.characters[target.id];
    const nextRelationship = world.relationships[relationship.id];
    nextActor.cashCents -= cost;
    nextTarget.mood = clamp(nextTarget.mood + (action.verb === 'relationship.gift' ? 2 : 3));
    const warmth = action.verb === 'relationship.gift' && cost > Math.max(100_000, nextActor.cashCents * 0.04) && nextRelationship.affection < 45 ? 1 : 4;
    nextRelationship.affection = clamp(nextRelationship.affection + warmth);
    nextRelationship.trust = clamp(nextRelationship.trust + 1);
    nextRelationship.lastInteractionWeek = world.calendar.week;
    addTransaction(world, action.verb === 'relationship.gift' ? 'relationship-gift' : 'relationship-celebration', -cost, `${action.verb === 'relationship.gift' ? 'Gift for' : 'Celebration with'} ${target.firstName} ${target.lastName}`, actor.id, target.id);
    const positive = recentSharedMemories(world, actor.id, target.id).find((memory) => memory.valence > 0.4);
    const context = positive ? ` It naturally pulled an older good memory back into the room: ${positive.narrative}` : '';
    upsertMemory(world, action.verb === 'relationship.gift' ? 'Relationship · Gift' : 'Relationship · Celebration', [actor.id, target.id], `${actor.firstName} made a point of celebrating ${target.firstName} instead of treating their life as background.${context}`, 48 + Math.min(20, cost / 20_000), { valence: 0.55 });
    return ok(world, `You spent ${money(cost)} making ${target.firstName} feel noticed. ${warmth <= 1 ? 'The size of the gesture was a little ahead of the closeness of the relationship.' : 'It landed well.'}`);
  }

  if (action.verb === 'relationship.date_night' || action.verb === 'relationship.weekend_away') {
    if (!['partner', 'spouse'].includes(role) || actor.partnerId !== target.id) return blocked(source, 'That activity is for an active partner or spouse.');
    if (actorAge < 16 || targetAge < 16) return blocked(source, 'Both people need to be old enough for dating activities.');
    if (action.verb === 'relationship.weekend_away' && (actorAge < 18 || targetAge < 18)) return blocked(source, 'A weekend away is limited to adult partners.');
    const cost = numberParam(action, 'amountCents', action.verb === 'relationship.weekend_away' ? 95_000 : 12_000);
    if (actor.cashCents < cost) return blocked(source, `You need ${money(cost)} in cash for that plan.`);
    const world = clone(source);
    const nextActor = world.characters[actor.id];
    const nextTarget = world.characters[target.id];
    const nextRelationship = world.relationships[relationship.id];
    nextActor.cashCents -= cost;
    addTransaction(world, 'relationship-experience', -cost, `${action.verb === 'relationship.weekend_away' ? 'Weekend away' : 'Date night'} with ${target.firstName}`, actor.id, target.id);
    const scale = action.verb === 'relationship.weekend_away' ? 1.55 : 1;
    nextRelationship.affection = clamp(nextRelationship.affection + 6 * scale);
    nextRelationship.trust = clamp(nextRelationship.trust + 3 * scale);
    nextRelationship.resentment = clamp(nextRelationship.resentment - 3.5 * scale);
    nextRelationship.lastInteractionWeek = world.calendar.week;
    nextActor.mood = clamp(nextActor.mood + 3 * scale);
    nextActor.stress = clamp(nextActor.stress - 2.5 * scale);
    nextTarget.mood = clamp(nextTarget.mood + 3 * scale);
    upsertMemory(world, action.verb === 'relationship.weekend_away' ? 'Relationship · Trip together' : 'Relationship · Date night', [actor.id, target.id], action.verb === 'relationship.weekend_away' ? `You and ${target.firstName} got out of the normal routine long enough to remember why the relationship exists outside chores, work, children, and schedules.` : `You and ${target.firstName} made a night belong to the relationship instead of letting whatever was loudest take it.`, action.verb === 'relationship.weekend_away' ? 76 : 52, { valence: 0.8, permanent: action.verb === 'relationship.weekend_away' && relationship.affection >= 65 });
    return ok(world, `${action.verb === 'relationship.weekend_away' ? 'The weekend away' : 'Date night'} with ${target.firstName} gave the relationship some actual shared life, not just maintenance.`);
  }

  if (action.verb === 'relationship.support_goal') {
    const world = clone(source);
    const nextTarget = world.characters[target.id];
    const nextRelationship = world.relationships[relationship.id];
    nextRelationship.trust = clamp(nextRelationship.trust + 4.5);
    nextRelationship.respect = clamp(nextRelationship.respect + 3);
    nextRelationship.affection = clamp(nextRelationship.affection + 2);
    nextRelationship.lastInteractionWeek = world.calendar.week;
    nextTarget.mood = clamp(nextTarget.mood + 3);
    nextTarget.ambition = clamp(nextTarget.ambition + 0.7);
    const career = activeCareer(world, target.id);
    if (career) career.performance = clamp(career.performance + 1.2);
    const education = activeEducation(world, target.id);
    if (education) education.recordedGrade = clamp(education.recordedGrade + 1.2);
    upsertMemory(world, 'Relationship · Backed their goal', [actor.id, target.id], `When ${target.firstName} was trying to move something in their own life forward, you acted like their goal mattered even though it was not yours.`, 62, { valence: 0.7 });
    return ok(world, `You backed ${target.firstName}'s goal instead of making the relationship revolve around your own plans.`);
  }

  if (action.verb === 'relationship.ask_favor') {
    const world = clone(source);
    const nextActor = world.characters[actor.id];
    const nextRelationship = world.relationships[relationship.id];
    const willingness = nextRelationship.trust * 0.42 + nextRelationship.respect * 0.28 + nextRelationship.affection * 0.18 + target.empathy * 0.12 - nextRelationship.resentment * 0.5;
    const accepted = willingness + roll(world) * 34 >= 58;
    nextRelationship.lastInteractionWeek = world.calendar.week;
    if (!accepted) {
      nextRelationship.respect = clamp(nextRelationship.respect - 1);
      nextRelationship.resentment = clamp(nextRelationship.resentment + 1.5);
      return ok(world, `${target.firstName} said no. The relationship was not strong enough—or the timing was not good enough—for that ask.`);
    }
    nextActor.stress = clamp(nextActor.stress - 3);
    nextRelationship.trust = clamp(nextRelationship.trust + 1);
    upsertMemory(world, 'Obligation · Favor', [actor.id, target.id], `${target.firstName} came through when ${actor.firstName} asked for help. The practical problem got easier; the relationship now carries a favor that may eventually be remembered from the other direction.`, 64, { valence: 0.25, unresolved: true, permanent: false });
    recordHistory(world, 'relationship', `${target.firstName} came through`, `You asked for a favor and ${target.firstName} helped. That kind of thing can become trust—or debt—depending on what happens later.`, { subjectIds: [actor.id, target.id], importance: 3 });
    return ok(world, `${target.firstName} helped. The favor is now part of the relationship's memory.`);
  }

  if (action.verb === 'relationship.lend_money') {
    const amount = numberParam(action, 'amountCents', 100_000);
    if (amount <= 0) return blocked(source, 'Choose a positive loan amount.');
    if (actor.cashCents < amount) return blocked(source, `You need ${money(amount)} in liquid cash to lend that much.`);
    const world = clone(source);
    const nextActor = world.characters[actor.id];
    const nextTarget = world.characters[target.id];
    const nextRelationship = world.relationships[relationship.id];
    nextActor.cashCents -= amount;
    nextTarget.cashCents += amount;
    nextRelationship.trust = clamp(nextRelationship.trust + 2.5);
    nextRelationship.affection = clamp(nextRelationship.affection + 1.5);
    nextRelationship.lastInteractionWeek = world.calendar.week;
    addTransaction(world, 'relationship-loan', -amount, `Personal loan to ${target.firstName} ${target.lastName}`, actor.id, target.id);
    upsertMemory(world, 'Obligation · Loan', [actor.id, target.id], `${actor.firstName} lent ${target.firstName} ${money(amount)}. The money helped immediately, but repayment, expectations, and future requests now have a place in the relationship.`, 62 + Math.min(25, Math.log10(Math.max(10, amount / 100)) * 4), { valence: 0.1, unresolved: true, permanent: amount >= 500_000 });
    return ok(world, `You lent ${target.firstName} ${money(amount)}. The game will remember that this is a loan, not a gift.`);
  }

  if (action.verb === 'relationship.collect_loan') {
    const outstanding = relationshipLoanBalance(source, target.id);
    if (outstanding <= 0) return blocked(source, `${target.firstName} does not owe you money.`);
    const requested = Math.min(outstanding, numberParam(action, 'amountCents', outstanding));
    const world = clone(source);
    const nextActor = world.characters[actor.id];
    const nextTarget = world.characters[target.id];
    const nextRelationship = world.relationships[relationship.id];
    const affordable = Math.max(0, Math.min(requested, nextTarget.cashCents));
    const willingness = nextRelationship.trust * 0.38 + nextRelationship.respect * 0.26 + nextTarget.discipline * 0.18 + nextTarget.ethics * 0.18 - nextRelationship.resentment * 0.45;
    if (affordable <= 0 || willingness + roll(world) * 35 < 54) {
      nextRelationship.resentment = clamp(nextRelationship.resentment + 5);
      nextRelationship.trust = clamp(nextRelationship.trust - 3);
      nextRelationship.lastInteractionWeek = world.calendar.week;
      upsertMemory(world, 'Relationship · Loan friction', [actor.id, target.id], `You asked ${target.firstName} to repay money they owe you. They could not—or would not—settle it. The loan has stopped being background bookkeeping and become relationship history.`, 76, { valence: -0.7, unresolved: true, permanent: true });
      return ok(world, `${target.firstName} did not repay you. The money problem is now actively hurting the relationship.`);
    }
    nextTarget.cashCents -= affordable;
    nextActor.cashCents += affordable;
    nextRelationship.respect = clamp(nextRelationship.respect + 2);
    nextRelationship.trust = clamp(nextRelationship.trust + 2);
    nextRelationship.lastInteractionWeek = world.calendar.week;
    addTransaction(world, 'relationship-loan-repayment', affordable, `Repayment from ${target.firstName} ${target.lastName}`, target.id, actor.id);
    const remaining = relationshipLoanBalance(world, target.id);
    if (remaining <= 0) {
      const memory = recentSharedMemories(world, actor.id, target.id).find((item) => item.category === 'Obligation · Loan' && item.unresolved);
      if (memory) {
        memory.unresolved = false;
        memory.narrative = `${memory.narrative} ${target.firstName} eventually repaid the loan in full.`;
      }
    }
    return ok(world, `${target.firstName} repaid ${money(affordable)}${remaining > 0 ? `; ${money(remaining)} remains.` : '. The loan is settled.'}`);
  }

  if (action.verb === 'relationship.set_boundary') {
    const world = clone(source);
    const nextRelationship = world.relationships[relationship.id];
    const understood = target.empathy + nextRelationship.respect + roll(world) * 60 >= 115;
    nextRelationship.lastInteractionWeek = world.calendar.week;
    nextRelationship.affection = clamp(nextRelationship.affection - 1.5);
    if (understood) {
      nextRelationship.trust = clamp(nextRelationship.trust + 3);
      nextRelationship.resentment = clamp(nextRelationship.resentment - 3);
    } else {
      nextRelationship.trust = clamp(nextRelationship.trust - 1);
      nextRelationship.resentment = clamp(nextRelationship.resentment + 4);
    }
    upsertMemory(world, 'Relationship · Boundary', [actor.id, target.id], understood ? `You told ${target.firstName} where a line needed to be. They did not necessarily love it, but they understood that the boundary was meant to protect the relationship rather than punish them.` : `You tried to set a boundary with ${target.firstName}. They experienced it as distance or rejection, which means the boundary may still be right even though the immediate reaction was rough.`, understood ? 58 : 68, { valence: understood ? 0.25 : -0.35, unresolved: !understood });
    return ok(world, understood ? `${target.firstName} understood the boundary. The conversation cost a little warmth but added clarity.` : `${target.firstName} reacted badly to the boundary. That does not automatically mean the boundary was wrong.`);
  }

  if (action.verb === 'relationship.one_on_one') {
    const cost = numberParam(action, 'amountCents', 2_500);
    if (actor.cashCents < cost) return blocked(source, `You need ${money(cost)} for that plan.`);
    const world = clone(source);
    const nextActor = world.characters[actor.id];
    const nextTarget = world.characters[target.id];
    const nextRelationship = world.relationships[relationship.id];
    nextActor.cashCents -= cost;
    nextRelationship.trust = clamp(nextRelationship.trust + 5);
    nextRelationship.affection = clamp(nextRelationship.affection + 6);
    nextRelationship.resentment = clamp(nextRelationship.resentment - 2);
    nextRelationship.lastInteractionWeek = world.calendar.week;
    nextActor.mood = clamp(nextActor.mood + 2.5);
    nextTarget.mood = clamp(nextTarget.mood + 3);
    addTransaction(world, 'relationship-time', -cost, `One-on-one time with ${target.firstName}`, actor.id, target.id);
    upsertMemory(world, 'Relationship · One-on-one time', [actor.id, target.id], `You gave ${target.firstName} time that was not shared with work, the rest of the family, a group chat, or a dozen other priorities.`, 50, { valence: 0.65 });
    return ok(world, `You spent one-on-one time with ${target.firstName}. It was ordinary in the way relationships are mostly built from ordinary things.`);
  }

  if (action.verb === 'relationship.reminisce') {
    const memory = [...recentSharedMemories(source, actor.id, target.id)].reverse().find((item) => item.valence > 0.2 || item.permanent);
    if (!memory) return blocked(source, `You and ${target.firstName} do not have enough recorded shared history to reminisce about yet.`);
    const world = clone(source);
    const nextRelationship = world.relationships[relationship.id];
    nextRelationship.affection = clamp(nextRelationship.affection + 4);
    nextRelationship.trust = clamp(nextRelationship.trust + 1.5);
    nextRelationship.lastInteractionWeek = world.calendar.week;
    world.characters[actor.id].mood = clamp(world.characters[actor.id].mood + 2);
    world.characters[target.id].mood = clamp(world.characters[target.id].mood + 2);
    recordHistory(world, 'relationship', `You and ${target.firstName} remembered an older version of yourselves`, memory.narrative, { subjectIds: [actor.id, target.id], importance: 2 });
    return ok(world, `You and ${target.firstName} talked about old history. Sometimes remembering why a relationship exists changes how the present feels.`);
  }

  if (action.verb === 'relationship.plan_future') {
    if (!['partner', 'spouse'].includes(role) || actor.partnerId !== target.id) return blocked(source, 'Future-planning is currently available for an active partner or spouse.');
    const world = clone(source);
    const nextRelationship = world.relationships[relationship.id];
    nextRelationship.trust = clamp(nextRelationship.trust + 4);
    nextRelationship.affection = clamp(nextRelationship.affection + 3);
    nextRelationship.lastInteractionWeek = world.calendar.week;
    upsertMemory(world, 'Promise · Future', [actor.id, target.id], `You and ${target.firstName} talked seriously about what the next few years are supposed to look like. Nothing became guaranteed, but both of you now have expectations that future choices can honor—or contradict.`, 74, { valence: 0.5, unresolved: true, permanent: true });
    return ok(world, `You and ${target.firstName} made the future part of the relationship. The game will remember that expectations were discussed.`);
  }

  if (action.verb === 'relationship.introduce_network') {
    const contactRelationship = Object.values(source.relationships).find((item) => item.kind === 'professional' && item.characterIds.includes(actor.id) && !item.characterIds.includes(target.id));
    if (!contactRelationship) return blocked(source, 'You do not have a professional connection strong enough to make an introduction yet.');
    const contactId = contactRelationship.characterIds.find((id) => id !== actor.id)!;
    const contact = source.characters[contactId];
    if (!contact?.isAlive) return blocked(source, 'Your available professional connection is no longer active.');
    const alreadyKnow = Object.values(source.relationships).some((item) => item.characterIds.includes(contact.id) && item.characterIds.includes(target.id));
    const world = clone(source);
    const nextRelationship = world.relationships[relationship.id];
    nextRelationship.respect = clamp(nextRelationship.respect + 4);
    nextRelationship.trust = clamp(nextRelationship.trust + 2);
    nextRelationship.lastInteractionWeek = world.calendar.week;
    world.characters[target.id].reputation.professional = clamp(world.characters[target.id].reputation.professional + 2.5);
    if (!alreadyKnow) {
      const id = allocateId(world, 'relationship');
      world.relationships[id] = { id, characterIds: [target.id, contact.id], kind: 'professional', trust: 30, affection: 18, respect: 42, resentment: 0, lastInteractionWeek: world.calendar.week };
    }
    upsertMemory(world, 'Relationship · Opened a door', [actor.id, target.id, contact.id], `You introduced ${target.firstName} to ${contact.firstName}. The introduction does not guarantee an outcome, but it changed who can plausibly call whom later.`, 64, { valence: 0.55, permanent: true });
    return ok(world, `You introduced ${target.firstName} to ${contact.firstName}. Their relationship now exists independently of you.`);
  }

  if (action.verb === 'family.family_dinner') {
    if (!isFamilyRole(role)) return blocked(source, 'Choose a family member or partner for a family dinner.');
    const cost = numberParam(action, 'amountCents', 12_000);
    if (actor.cashCents < cost) return blocked(source, `You need ${money(cost)} for the dinner.`);
    const world = clone(source);
    const nextActor = world.characters[actor.id];
    nextActor.cashCents -= cost;
    const familyRelationships = Object.values(world.relationships).filter((item) => item.characterIds.includes(actor.id) && isFamilyRole(roleFor(world, item.characterIds.find((id) => id !== actor.id)!, item)));
    const participants = [actor.id];
    for (const item of familyRelationships) {
      const otherId = item.characterIds.find((id) => id !== actor.id)!;
      const other = world.characters[otherId];
      if (!other?.isAlive || other.cityId !== actor.cityId) continue;
      item.affection = clamp(item.affection + 2.5);
      item.trust = clamp(item.trust + 1.5);
      item.resentment = clamp(item.resentment - 1);
      item.lastInteractionWeek = world.calendar.week;
      other.mood = clamp(other.mood + 1.5);
      participants.push(other.id);
    }
    addTransaction(world, 'family-dinner', -cost, 'Family dinner', actor.id);
    upsertMemory(world, 'Family · Dinner', participants.slice(0, 8), `The family managed to be in one place without turning it into a logistics meeting. Nobody solved the family. They simply accumulated another ordinary shared night.`, 48, { valence: 0.55 });
    return ok(world, `You spent ${money(cost)} bringing the family together. ${Math.max(0, participants.length - 1)} people actually showed up.`);
  }

  if (action.verb === 'family.help_school') {
    if (role !== 'child' && !['sibling', 'relative'].includes(role)) return blocked(source, 'Choose a child or younger family member.');
    const education = activeEducation(source, target.id);
    if (!education) return blocked(source, `${target.firstName} is not currently in an active school or training program.`);
    const world = clone(source);
    const nextTarget = world.characters[target.id];
    const nextRelationship = world.relationships[relationship.id];
    const nextEducation = world.education[education.id];
    const help = 1.2 + actor.knowledge / 70 + actor.empathy / 110;
    nextEducation.recordedGrade = clamp(nextEducation.recordedGrade + help);
    nextTarget.knowledge = clamp(nextTarget.knowledge + 0.6);
    nextTarget.stress = clamp(nextTarget.stress - (actor.empathy >= 60 ? 1.5 : 0.2));
    nextRelationship.trust = clamp(nextRelationship.trust + 4);
    nextRelationship.respect = clamp(nextRelationship.respect + 3);
    nextRelationship.lastInteractionWeek = world.calendar.week;
    world.characters[actor.id].stress = clamp(world.characters[actor.id].stress + 1);
    upsertMemory(world, 'Family · School support', [actor.id, target.id], `You helped ${target.firstName} with school without making the whole interaction about the grade. That kind of support can affect both academic confidence and the adult relationship later.`, 58, { valence: 0.65 });
    return ok(world, `You helped ${target.firstName} with school. Their grade improved a little, and the relationship gained more than the grade did.`);
  }

  if (action.verb === 'family.teach_money') {
    if (!isFamilyRole(role) || targetAge < 10) return blocked(source, 'Choose a family member old enough to understand the lesson.');
    const world = clone(source);
    const nextTarget = world.characters[target.id];
    const nextRelationship = world.relationships[relationship.id];
    nextTarget.discipline = clamp(nextTarget.discipline + 1.2);
    nextTarget.knowledge = clamp(nextTarget.knowledge + 0.7);
    nextTarget.riskTolerance = clamp(nextTarget.riskTolerance + (actor.riskTolerance - nextTarget.riskTolerance) * 0.02);
    nextRelationship.respect = clamp(nextRelationship.respect + 3);
    nextRelationship.lastInteractionWeek = world.calendar.week;
    upsertMemory(world, 'Family · Money lesson', [actor.id, target.id], `You talked with ${target.firstName} about money as something connected to choices, time, risk, and responsibility—not merely a number adults refuse to explain.`, 50, { valence: 0.45 });
    return ok(world, `${target.firstName} picked up a little financial judgment from you. Whether they use it later will still be their choice.`);
  }

  if (action.verb === 'family.attend_event') {
    if (!isFamilyRole(role)) return blocked(source, 'Choose a family member whose event you could reasonably attend.');
    const world = clone(source);
    const nextTarget = world.characters[target.id];
    const nextRelationship = world.relationships[relationship.id];
    nextRelationship.affection = clamp(nextRelationship.affection + 6);
    nextRelationship.trust = clamp(nextRelationship.trust + 4);
    nextRelationship.resentment = clamp(nextRelationship.resentment - 2.5);
    nextRelationship.lastInteractionWeek = world.calendar.week;
    nextTarget.mood = clamp(nextTarget.mood + 4);
    world.characters[actor.id].stress = clamp(world.characters[actor.id].stress + 1.2);
    upsertMemory(world, 'Family · You showed up', [actor.id, target.id], `There were easier ways to use the time, but ${target.firstName} looked up and you were there. Being present for somebody else's important day has a way of becoming more memorable than the day looked on your calendar.`, 72, { valence: 0.85, permanent: true });
    return ok(world, `You showed up for ${target.firstName}. It cost time and gave the relationship a memory that can matter later.`);
  }

  if (action.verb === 'family.caregiving') {
    if (!isFamilyRole(role) || (targetAge < 55 && target.health >= 65)) return blocked(source, `${target.firstName} is not currently in a stage where caregiving makes much sense.`);
    const cost = numberParam(action, 'amountCents', 20_000);
    if (actor.cashCents < cost) return blocked(source, `You need ${money(cost)} for the practical costs of helping this week.`);
    const world = clone(source);
    const nextActor = world.characters[actor.id];
    const nextTarget = world.characters[target.id];
    const nextRelationship = world.relationships[relationship.id];
    nextActor.cashCents -= cost;
    nextActor.stress = clamp(nextActor.stress + 2.5);
    nextTarget.health = clamp(nextTarget.health + 1.3);
    nextTarget.mood = clamp(nextTarget.mood + 4);
    nextRelationship.trust = clamp(nextRelationship.trust + 6);
    nextRelationship.affection = clamp(nextRelationship.affection + 4);
    nextRelationship.resentment = clamp(nextRelationship.resentment - 2);
    nextRelationship.lastInteractionWeek = world.calendar.week;
    addTransaction(world, 'family-care', -cost, `Care for ${target.firstName} ${target.lastName}`, actor.id, target.id);
    upsertMemory(world, 'Family · Caregiving', [actor.id, target.id], `You helped care for ${target.firstName} when age or health made ordinary independence harder. Caregiving added stress to your life and safety to theirs, which is exactly why family obligations become complicated instead of simply noble.`, 78, { valence: 0.45, permanent: true });
    return ok(world, `You helped care for ${target.firstName}. Their health and mood improved a little; your own week got heavier.`);
  }

  if (action.verb === 'family.set_expectations') {
    if (role !== 'child' || targetAge >= 25) return blocked(source, 'This is intended for a child or young adult you are actively parenting.');
    const world = clone(source);
    const nextTarget = world.characters[target.id];
    const nextRelationship = world.relationships[relationship.id];
    const approach = actor.empathy * 0.44 + actor.discipline * 0.34 + nextRelationship.trust * 0.22;
    nextTarget.discipline = clamp(nextTarget.discipline + (approach >= 58 ? 1.8 : 0.5));
    nextRelationship.respect = clamp(nextRelationship.respect + (approach >= 58 ? 3 : 1));
    nextRelationship.resentment = clamp(nextRelationship.resentment + (approach >= 58 ? 0.5 : 5));
    nextRelationship.trust = clamp(nextRelationship.trust + (approach >= 58 ? 1.5 : -2));
    nextRelationship.lastInteractionWeek = world.calendar.week;
    upsertMemory(world, 'Family · Expectations', [actor.id, target.id], approach >= 58 ? `You set expectations with ${target.firstName} clearly enough that the rules felt connected to responsibility rather than control.` : `You tried to set expectations with ${target.firstName}, but the conversation landed more like control than guidance. The rule may survive even if the trust took a hit.`, approach >= 58 ? 54 : 66, { valence: approach >= 58 ? 0.3 : -0.45, unresolved: approach < 58 });
    return ok(world, approach >= 58 ? `${target.firstName} understood what you expected and why.` : `${target.firstName} heard the expectation, but not the reasoning behind it. Resentment rose.`);
  }

  if (action.verb === 'family.invite_business') {
    if (!isFamilyRole(role) || targetAge < 16) return blocked(source, 'Choose a family member old enough to work in the business.');
    const requestedBusinessId = typeof action.parameters.businessId === 'string' ? action.parameters.businessId : action.targetIds[1];
    const business = requestedBusinessId ? source.businesses[requestedBusinessId] : Object.values(source.businesses).find((item) => item.active && (item.ownerId ?? item.founderId) === actor.id && item.playerOwnershipBps > 0);
    if (!business || !business.active || (business.ownerId ?? business.founderId) !== actor.id) return blocked(source, 'Choose an active business you own.');
    const organization = source.organizations[business.organizationId];
    if (organization?.memberIds.includes(target.id)) return blocked(source, `${target.firstName} is already part of ${business.name}.`);
    const salary = numberParam(action, 'salaryWeeklyCents', Math.round(90_000 + target.knowledge * 900 + target.discipline * 500));
    if (business.cashCents < Math.max(250_000, salary * 8)) return blocked(source, `${business.name} needs more runway before bringing family onto payroll.`);
    const world = clone(source);
    const nextBusiness = world.businesses[business.id];
    const nextOrganization = world.organizations[nextBusiness.organizationId];
    const nextRelationship = world.relationships[relationship.id];
    Object.values(world.careers).forEach((career) => { if (career.characterId === target.id) career.active = false; });
    const careerId = allocateId(world, 'career');
    const title = target.knowledge + target.discipline >= 125 ? 'Family operations lead' : 'Family business associate';
    world.careers[careerId] = { id: careerId, characterId: target.id, employerId: nextBusiness.organizationId, title, sector: nextBusiness.sector, weeklySalaryCents: salary, performance: clamp(42 + target.discipline * 0.25 + target.knowledge * 0.18), satisfaction: 64, weeksInRole: 0, active: true };
    if (nextOrganization && !nextOrganization.memberIds.includes(target.id)) nextOrganization.memberIds.push(target.id);
    nextBusiness.employees += 1;
    nextBusiness.capacity += 7;
    nextRelationship.trust = clamp(nextRelationship.trust + 2);
    nextRelationship.respect = clamp(nextRelationship.respect + 4);
    nextRelationship.resentment = clamp(nextRelationship.resentment + 1);
    nextRelationship.lastInteractionWeek = world.calendar.week;
    upsertMemory(world, 'Family · Joined the business', [actor.id, target.id, business.id], `${target.firstName} joined ${business.name} as ${title}. Family and work are now entangled: good performance can deepen trust, bad performance can become personal, and succession is no longer an abstract future problem.`, 84, { valence: 0.35, permanent: true, unresolved: true });
    recordHistory(world, 'business', `${target.firstName} joined ${business.name}`, `You brought family into the company. That can create loyalty, continuity, favoritism, resentment, competence, or all of them at once.`, { subjectIds: [actor.id, target.id, business.id], important: true });
    return ok(world, `${target.firstName} now works at ${business.name}. The relationship and the company can affect each other from here.`);
  }

  if (action.verb === 'family.discuss_inheritance') {
    if (!isFamilyRole(role) || actorAge < 18 || targetAge < 16) return blocked(source, 'Choose a family member old enough for an inheritance conversation.');
    const world = clone(source);
    const nextRelationship = world.relationships[relationship.id];
    const heir = world.dynasty.activeHeirId === target.id;
    nextRelationship.trust = clamp(nextRelationship.trust + 3.5);
    nextRelationship.respect = clamp(nextRelationship.respect + 2.5);
    nextRelationship.resentment = clamp(nextRelationship.resentment - (heir ? 2 : 1));
    nextRelationship.lastInteractionWeek = world.calendar.week;
    upsertMemory(world, 'Family · Inheritance conversation', [actor.id, target.id], heir ? `You told ${target.firstName} directly that they are currently the preferred successor. That clarity can reduce uncertainty while creating its own expectations, pressure, and sibling politics.` : `You and ${target.firstName} talked about inheritance without pretending money and control are emotionally neutral. No promise of succession was made, but ambiguity is lower than it was before.`, 82, { valence: 0.25, permanent: true, unresolved: false });
    return ok(world, heir ? `${target.firstName} now knows they are the preferred successor.` : `You discussed inheritance with ${target.firstName} without promising them control.`);
  }

  return null;
}
