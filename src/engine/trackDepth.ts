import { allocateId, playerAgeYears } from './createWorld';
import { recordHistory } from './history';
import { nextRandom } from './random';
import type { ActionResult, IntentAction, MemoryRecord, WorldState } from './types';

const TRACK_VERBS = new Set([
  'markets.research',
  'markets.set_strategy',
  'markets.rebalance',
  'business.set_growth_posture',
  'business.invest_quality',
  'business.invest_rd',
  'business.reward_staff',
  'business.expand_location',
  'education.choose_major',
  'education.office_hours',
  'education.join_club',
  'education.internship',
  'education.sports_train',
  'education.sports_compete',
  'education.sports_seek_scholarship',
  'career.work_hard',
  'career.network',
  'career.train',
  'career.seek_promotion',
  'career.office_politics',
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

function amount(action: IntentAction, fallback: number): number {
  const value = action.parameters.amountCents;
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;
}

function activeEducation(world: WorldState) {
  const actor = world.characters[world.playerCharacterId];
  return actionTargetEducation(world, actor.id, []);
}

function actionTargetEducation(world: WorldState, actorId: string, targetIds: string[]) {
  return targetIds.map((id) => world.education[id]).find((record) => record?.characterId === actorId && ['school', 'higher', 'trade'].includes(record.status))
    ?? Object.values(world.education).find((record) => record.characterId === actorId && ['school', 'higher', 'trade'].includes(record.status));
}

function currentCareer(world: WorldState) {
  const actor = world.characters[world.playerCharacterId];
  return Object.values(world.careers).find((career) => career.characterId === actor.id && career.active);
}

function ownedBusiness(world: WorldState, targetIds: string[]) {
  const actor = world.characters[world.playerCharacterId];
  return targetIds.map((id) => world.businesses[id]).find((business) => business?.active && (business.ownerId ?? business.founderId) === actor.id)
    ?? Object.values(world.businesses).find((business) => business.active && (business.ownerId ?? business.founderId) === actor.id);
}

function upsertTrackMemory(world: WorldState, category: string, narrative: string, importance = 55): MemoryRecord {
  const actor = world.characters[world.playerCharacterId];
  const existing = Object.values(world.memories).find((memory) => memory.category === category && memory.participantIds.includes(actor.id));
  if (existing) {
    existing.narrative = narrative;
    existing.week = world.calendar.week;
    existing.importance = Math.max(existing.importance, importance);
    existing.unresolved = false;
    return existing;
  }
  const id = allocateId(world, 'memory');
  const memory: MemoryRecord = {
    id,
    participantIds: [actor.id],
    category,
    week: world.calendar.week,
    valence: 0.25,
    importance,
    permanent: false,
    unresolved: false,
    visibility: 'private',
    narrative,
  };
  world.memories[id] = memory;
  return memory;
}

function addTransaction(world: WorldState, kind: string, amountCents: number, memo: string, fromId?: string, toId?: string): void {
  world.transactions.push({ id: allocateId(world, 'transaction'), week: world.calendar.week, kind, amountCents, memo, fromId, toId });
  if (world.transactions.length > 1_200) world.transactions.splice(0, world.transactions.length - 1_200);
}

export function getTrackMemory(world: WorldState, category: string): string | undefined {
  const actorId = world.playerCharacterId;
  return Object.values(world.memories).find((memory) => memory.category === category && memory.participantIds.includes(actorId))?.narrative;
}

export function executeTrackDepth(source: WorldState, action: IntentAction): ActionResult | null {
  if (!TRACK_VERBS.has(action.verb)) return null;
  const actor = source.characters[source.playerCharacterId];

  if (action.verb === 'markets.research') {
    const security = source.securities[action.targetIds[0]];
    if (!security) return blocked(source, 'Choose a listed company to research.');
    const world = clone(source);
    const nextActor = world.characters[world.playerCharacterId];
    const nextSecurity = world.securities[security.id];
    nextActor.knowledge = clamp(nextActor.knowledge + 0.9);
    nextActor.stress = clamp(nextActor.stress + 0.4);
    const conviction = clamp(nextSecurity.quality * 0.52 + (100 - nextSecurity.volatility) * 0.2 + nextActor.knowledge * 0.28);
    upsertTrackMemory(world, `Investing · ${nextSecurity.symbol} thesis`, `${nextSecurity.name} currently looks like a ${conviction >= 72 ? 'high-conviction' : conviction >= 56 ? 'mixed' : 'speculative'} idea to you. Quality is ${Math.round(nextSecurity.quality)}/100, volatility ${Math.round(nextSecurity.volatility)}/100, and the thesis can become stale as the world changes.`, 52);
    return ok(world, `You researched ${nextSecurity.name}. Your knowledge improved and the game now remembers a current investment thesis instead of treating the ticker like a button.`);
  }

  if (action.verb === 'markets.set_strategy') {
    const strategy = typeof action.parameters.strategy === 'string' ? action.parameters.strategy : 'balanced';
    const allowed = ['index', 'value', 'growth', 'income', 'concentrated', 'speculative'];
    if (!allowed.includes(strategy)) return blocked(source, 'Choose index, value, growth, income, concentrated, or speculative.');
    const world = clone(source);
    const descriptions: Record<string, string> = {
      index: 'Broad diversification is the default. You are trying to own the market instead of outsmart it every week.',
      value: 'You are looking for quality and cash generation at prices that leave room for disappointment.',
      growth: 'You are willing to accept higher volatility for businesses with stronger growth and reinvestment potential.',
      income: 'Cash yield and durable distributions matter more than chasing the highest possible upside.',
      concentrated: 'You are deliberately accepting concentration risk because you want a few researched positions to matter.',
      speculative: 'You are accepting that large upside comes with large drawdowns and a meaningful chance of being wrong.',
    };
    upsertTrackMemory(world, 'Track · Investing strategy', `${strategy}:${descriptions[strategy]}`, 64);
    recordHistory(world, 'markets', `Investment strategy: ${strategy}`, descriptions[strategy], { importance: 3 });
    return ok(world, `Your investing strategy is now ${strategy}. Future decisions can be judged against an actual philosophy instead of disconnected buys and sells.`);
  }

  if (action.verb === 'markets.rebalance') {
    const holdings = Object.values(source.holdings).filter((holding) => holding.ownerId === actor.id);
    if (holdings.length < 2) return blocked(source, 'You need at least two market positions before rebalancing means anything.');
    const world = clone(source);
    const nextHoldings = Object.values(world.holdings).filter((holding) => holding.ownerId === actor.id);
    const totalValue = nextHoldings.reduce((sum, holding) => {
      const security = world.securities[holding.securityId];
      return sum + (security ? Math.round(holding.unitsMilli * security.priceCents / 1000) : 0);
    }, 0);
    const perPosition = Math.floor(totalValue / nextHoldings.length);
    for (const holding of nextHoldings) {
      const security = world.securities[holding.securityId];
      if (!security || security.priceCents <= 0) continue;
      holding.unitsMilli = Math.max(0, Math.floor(perPosition * 1000 / security.priceCents));
      holding.costBasisCents = perPosition;
    }
    upsertTrackMemory(world, 'Investing · Last rebalance', `You rebalanced ${nextHoldings.length} positions toward equal weight in week ${world.calendar.week}. Rebalancing reduced concentration without guaranteeing better returns.`, 44);
    return ok(world, `You rebalanced ${nextHoldings.length} positions toward equal weight. Risk is spread more evenly, but the market still gets to disagree with you.`);
  }

  if (action.verb.startsWith('business.')) {
    const business = ownedBusiness(source, action.targetIds);
    if (!business) return blocked(source, 'Choose an active business you own.');

    if (action.verb === 'business.set_growth_posture') {
      const posture = typeof action.parameters.posture === 'string' ? action.parameters.posture : 'balanced';
      if (!['conservative', 'balanced', 'aggressive'].includes(posture)) return blocked(source, 'Choose conservative, balanced, or aggressive growth.');
      const world = clone(source);
      const next = world.businesses[business.id];
      next.growthPosture = posture as typeof next.growthPosture;
      next.demand = clamp(next.demand + (posture === 'aggressive' ? 4 : posture === 'conservative' ? -2 : 1), 1, 1_000_000);
      recordHistory(world, 'business', `${business.name} changed growth posture`, `${posture === 'aggressive' ? 'Growth is being prioritized over comfort and spare capacity.' : posture === 'conservative' ? 'Cash preservation and execution quality matter more than maximum growth.' : 'The company is trying to grow without making every week an emergency.'}`, { subjectIds: [business.id], importance: 2 });
      return ok(world, `${business.name} is now running a ${posture} growth posture.`);
    }

    const nextCost = amount(action, action.verb === 'business.expand_location' ? 5_000_000 : action.verb === 'business.reward_staff' ? 500_000 : 1_000_000);
    if (nextCost <= 0) return blocked(source, 'Choose a positive company investment.');
    if (business.cashCents < nextCost) return blocked(source, `${business.name} does not have enough company cash for that move.`);
    const world = clone(source);
    const next = world.businesses[business.id];
    next.cashCents -= nextCost;
    addTransaction(world, 'business-investment', -nextCost, `${action.verb} at ${next.name}`, next.organizationId);

    if (action.verb === 'business.invest_quality') {
      const gain = clamp(4 + Math.log10(Math.max(10, nextCost / 100)) * 1.5, 4, 16);
      next.quality = clamp(next.quality + gain);
      next.reputation = clamp(next.reputation + gain * 0.55);
      next.demand = clamp(next.demand + gain * 0.35, 1, 1_000_000);
      return ok(world, `${next.name} spent ${(nextCost / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} on quality. Customers may notice gradually; the cash is gone immediately.`);
    }
    if (action.verb === 'business.invest_rd') {
      const gain = clamp(3 + Math.log10(Math.max(10, nextCost / 100)) * 1.2, 3, 14);
      next.quality = clamp(next.quality + gain * 0.55);
      next.capacity = clamp(next.capacity + gain * 0.9, 1, 1_000_000);
      next.valuationCents = Math.round(next.valuationCents * (1 + gain / 350));
      upsertTrackMemory(world, `Business · ${next.id} R&D`, `${next.name} has an active product/process investment story. The spending improved capability, but returns still depend on demand and execution.`, 58);
      return ok(world, `${next.name} invested in R&D. Capability and long-term valuation improved a little without pretending every project becomes a hit.`);
    }
    if (action.verb === 'business.reward_staff') {
      const gain = clamp(2 + nextCost / Math.max(1, next.employees) / 120_000, 2, 10);
      next.reputation = clamp(next.reputation + gain);
      next.quality = clamp(next.quality + gain * 0.35);
      actor.reputation.employee = clamp(actor.reputation.employee + gain * 0.45);
      upsertTrackMemory(world, `Business · ${next.id} culture`, `${next.name} recently put real money behind employee rewards instead of treating culture as copy on a careers page.`, 48);
      return ok(world, `${next.name} rewarded the team. Employee reputation and execution quality improved, but payroll generosity still has to be funded.`);
    }
    if (action.verb === 'business.expand_location') {
      if (next.employees < 3) return blocked(source, 'The company is too small for another location to be a sensible next step.');
      const hires = Math.max(2, Math.round(next.employees * 0.18));
      next.employees += hires;
      next.capacity = clamp(next.capacity + Math.max(12, hires * 7), 1, 1_000_000);
      next.demand = clamp(next.demand + 8, 1, 1_000_000);
      next.valuationCents = Math.round(next.valuationCents * 1.045);
      recordHistory(world, 'business', `${next.name} opened another location`, `Expansion added capacity and fixed costs. The company is physically larger now, which creates more upside and more ways for management quality to matter.`, { subjectIds: [next.id], importance: 3 });
      return ok(world, `${next.name} expanded. Capacity, headcount, and valuation rose, and the company has more operational surface area to manage.`);
    }
  }

  if (action.verb.startsWith('education.')) {
    const education = actionTargetEducation(source, actor.id, action.targetIds);
    if (!education) return blocked(source, 'You need an active school, college, or training path for that action.');
    const world = clone(source);
    const nextActor = world.characters[world.playerCharacterId];
    const nextEducation = world.education[education.id];

    if (action.verb === 'education.choose_major') {
      if (nextEducation.status !== 'higher') return blocked(source, 'Choosing a major is for an active college program.');
      const major = typeof action.parameters.major === 'string' && action.parameters.major.trim() ? action.parameters.major.trim().slice(0, 30) : 'General studies';
      nextEducation.level = `Undergraduate · ${major}`;
      nextEducation.knowledgeGain = clamp(nextEducation.knowledgeGain + 2);
      upsertTrackMemory(world, 'Track · College major', `major:${major}`, 62);
      recordHistory(world, 'education', `Declared ${major}`, `The degree now has a direction. Major choice affects the story, network, and which future career moves feel plausible even though competence still has to be built.`, { importance: 3 });
      return ok(world, `You declared ${major}. The credential now has a specialization instead of being a generic college checkbox.`);
    }
    if (action.verb === 'education.office_hours') {
      nextEducation.recordedGrade = clamp(nextEducation.recordedGrade + 2.4 + nextActor.knowledge / 180);
      nextEducation.network = clamp(nextEducation.network + 1.4);
      nextActor.knowledge = clamp(nextActor.knowledge + 0.7);
      nextActor.stress = clamp(nextActor.stress + 0.5);
      return ok(world, 'You went to office hours and actually engaged with the material. Grades, knowledge, and faculty familiarity moved a little.');
    }
    if (action.verb === 'education.join_club') {
      const id = allocateId(world, 'organization');
      const label = typeof action.parameters.club === 'string' && action.parameters.club.trim() ? action.parameters.club.trim().slice(0, 30) : 'Campus society';
      world.organizations[id] = { id, kind: 'club', name: label, resourcesCents: 50_000, influence: 22, stability: 68, memberIds: [nextActor.id], history: [`Joined by ${nextActor.firstName} ${nextActor.lastName} in week ${world.calendar.week}.`] };
      nextEducation.network = clamp(nextEducation.network + 5);
      nextActor.charisma = clamp(nextActor.charisma + 0.6);
      recordHistory(world, 'education', `Joined ${label}`, `Campus life gained a recurring group with its own people and future networking value.`, { subjectIds: [id], importance: 2 });
      return ok(world, `You joined ${label}. The club is now a persistent organization in the world instead of a one-time social bonus.`);
    }
    if (action.verb === 'education.internship') {
      if (nextEducation.status !== 'higher') return blocked(source, 'Internships are currently tied to an active college program.');
      const existingJob = currentCareer(world);
      if (existingJob) return blocked(source, 'You already have an active job. Leave it before taking a structured internship.');
      const careerId = allocateId(world, 'career');
      const sector = nextEducation.level.includes('Finance') ? 'Finance' : nextEducation.level.includes('Technology') || nextEducation.level.includes('Computer') ? 'Technology' : 'Operations';
      world.careers[careerId] = { id: careerId, characterId: nextActor.id, employerId: 'organization-northstar-logistics', title: `${sector} intern`, sector, weeklySalaryCents: 42_000, performance: 48 + nextActor.discipline * 0.2, satisfaction: 64, weeksInRole: 0, active: true };
      nextEducation.network = clamp(nextEducation.network + 4);
      nextActor.reputation.professional = clamp(nextActor.reputation.professional + 3);
      recordHistory(world, 'career', 'Started an internship', `School now overlaps with real work. The internship adds experience and network value while competing for the same limited week as classes and everything else.`, { importance: 3 });
      return ok(world, `You started a ${sector.toLowerCase()} internship. It is real career experience now, not flavor text.`);
    }
    if (action.verb === 'education.sports_train') {
      nextActor.fitness = clamp(nextActor.fitness + 3.2);
      nextActor.discipline = clamp(nextActor.discipline + 0.6);
      nextActor.stress = clamp(nextActor.stress + 1.3);
      nextEducation.recordedGrade = clamp(nextEducation.recordedGrade - 0.6);
      upsertTrackMemory(world, 'Track · Athlete development', `training:${Math.round(nextActor.fitness)}:${world.calendar.week}`, 52);
      return ok(world, 'You trained seriously. Fitness and discipline improved, and academics gave up a little space to make room for it.');
    }
    if (action.verb === 'education.sports_compete') {
      const strength = nextActor.fitness * 0.48 + nextActor.discipline * 0.24 + nextActor.health * 0.18 + nextActor.mood * 0.1;
      const resultRoll = strength + roll(world) * 35;
      const resultLabel = resultRoll >= 88 ? 'won a standout result' : resultRoll >= 70 ? 'performed well' : resultRoll >= 54 ? 'held your own' : 'had a rough competition';
      nextActor.reputation.public = clamp(nextActor.reputation.public + (resultRoll >= 88 ? 5 : resultRoll >= 70 ? 2.5 : resultRoll < 54 ? -1 : 0.5));
      nextEducation.network = clamp(nextEducation.network + (resultRoll >= 70 ? 3 : 1));
      nextActor.fitness = clamp(nextActor.fitness + 1.1);
      nextActor.stress = clamp(nextActor.stress + 2);
      recordHistory(world, 'education', `Competition: ${resultLabel}`, `Athletic results now become part of reputation and school history rather than only a fitness stat.`, { importance: resultRoll >= 88 ? 3 : 2 });
      return ok(world, `You ${resultLabel}. Coaches, classmates, and future opportunities can now react to an actual athletic record.`);
    }
    if (action.verb === 'education.sports_seek_scholarship') {
      if (nextActor.fitness < 74) return blocked(source, 'Your fitness and athletic profile are not strong enough for a serious scholarship push yet.');
      const chance = clamp((nextActor.fitness + nextActor.discipline + nextActor.reputation.public) / 300, 0.12, 0.82);
      if (roll(world) > chance) return ok(world, 'You pushed for athletic aid, but the current profile did not win funding. The attempt still added visibility.');
      const liability = Object.values(world.liabilities).find((item) => item.debtorId === nextActor.id && item.kind === 'student' && item.securedById === nextEducation.id);
      const award = Math.min(1_500_000, liability?.principalCents ?? 1_500_000);
      if (liability) liability.principalCents = Math.max(0, liability.principalCents - award);
      nextActor.reputation.public = clamp(nextActor.reputation.public + 4);
      upsertTrackMemory(world, 'Athletics · Scholarship', `Athletic performance earned ${Math.round(award / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} in education support.`, 72);
      return ok(world, `Your athletic profile earned ${Math.round(award / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} in scholarship support.`);
    }
  }

  if (action.verb.startsWith('career.')) {
    const career = currentCareer(source);
    if (!career) return blocked(source, 'You need an active job for that career move.');
    const world = clone(source);
    const nextActor = world.characters[world.playerCharacterId];
    const nextCareer = world.careers[career.id];

    if (action.verb === 'career.work_hard') {
      nextCareer.performance = clamp(nextCareer.performance + 3.2 + nextActor.discipline / 150);
      nextCareer.satisfaction = clamp(nextCareer.satisfaction - 0.8);
      nextActor.stress = clamp(nextActor.stress + 2.6);
      nextActor.reputation.employee = clamp(nextActor.reputation.employee + 1.2);
      return ok(world, 'You pushed hard at work. Performance and employee reputation improved; stress took the bill.');
    }
    if (action.verb === 'career.network') {
      nextActor.reputation.professional = clamp(nextActor.reputation.professional + 2.2);
      nextCareer.performance = clamp(nextCareer.performance + 0.8);
      nextCareer.satisfaction = clamp(nextCareer.satisfaction + 0.7);
      upsertTrackMemory(world, 'Track · Career network', `Your professional network is being cultivated intentionally in ${nextCareer.sector}, not left to random encounters.`, 50);
      return ok(world, 'You invested in professional relationships. Reputation rose more than raw job performance.');
    }
    if (action.verb === 'career.train') {
      nextActor.knowledge = clamp(nextActor.knowledge + 1.4);
      nextActor.discipline = clamp(nextActor.discipline + 0.3);
      nextCareer.performance = clamp(nextCareer.performance + 1.3);
      nextActor.stress = clamp(nextActor.stress + 1.1);
      return ok(world, 'You trained for the job instead of only doing the job. Knowledge and performance improved together.');
    }
    if (action.verb === 'career.seek_promotion') {
      if (nextCareer.weeksInRole < 26) return blocked(source, 'You have not been in the role long enough to make a credible promotion case.');
      const score = nextCareer.performance * 0.42 + nextActor.reputation.professional * 0.25 + nextActor.charisma * 0.15 + nextActor.discipline * 0.18;
      const chance = clamp((score - 35) / 80, 0.08, 0.88);
      if (roll(world) > chance) {
        nextCareer.satisfaction = clamp(nextCareer.satisfaction - 2);
        nextActor.reputation.professional = clamp(nextActor.reputation.professional + 0.5);
        return ok(world, 'You made the promotion case and did not get it. The no is now part of your career story, not a silent button failure.');
      }
      nextCareer.title = nextCareer.title.startsWith('Senior ') ? `Lead ${nextCareer.title.replace('Senior ', '')}` : `Senior ${nextCareer.title}`;
      nextCareer.weeklySalaryCents = Math.round(nextCareer.weeklySalaryCents * 1.18);
      nextCareer.satisfaction = clamp(nextCareer.satisfaction + 5);
      nextActor.stress = clamp(nextActor.stress + 2);
      recordHistory(world, 'career', 'Promotion earned', `${nextCareer.title} came with more money, authority, and expectations.`, { important: true, importance: 4 });
      return ok(world, `You earned a promotion to ${nextCareer.title}. Pay rose 18%, and the job expects more from you now.`);
    }
    if (action.verb === 'career.office_politics') {
      const professional = Object.values(world.relationships).find((relationship) => relationship.kind === 'professional' && relationship.characterIds.includes(nextActor.id));
      const chance = clamp((nextActor.charisma + nextActor.empathy + nextActor.reputation.professional) / 300, 0.15, 0.8);
      if (roll(world) < chance) {
        nextCareer.performance = clamp(nextCareer.performance + 2);
        nextActor.reputation.professional = clamp(nextActor.reputation.professional + 2);
        if (professional) professional.respect = clamp(professional.respect + 3);
        return ok(world, 'You read the room well and built support around your work. The career moved because people, not only output, matter inside organizations.');
      }
      nextCareer.satisfaction = clamp(nextCareer.satisfaction - 3);
      nextActor.reputation.professional = clamp(nextActor.reputation.professional - 2);
      if (professional) professional.resentment = clamp(professional.resentment + 4);
      return ok(world, 'You misread the politics around the job. The work still exists, but somebody now remembers the maneuver differently than you do.');
    }
  }

  return null;
}

export function applyTrackDepthAdvance(before: WorldState, source: WorldState): WorldState {
  const weeks = Math.max(0, source.calendar.week - before.calendar.week);
  if (weeks <= 0) return source;
  const world = clone(source);
  const actor = world.characters[world.playerCharacterId];
  const strategy = getTrackMemory(world, 'Track · Investing strategy');
  if (strategy && weeks >= 13) {
    if (strategy.startsWith('speculative:')) actor.stress = clamp(actor.stress + Math.min(4, weeks / 26));
    if (strategy.startsWith('income:')) actor.stress = clamp(actor.stress - Math.min(2, weeks / 52));
  }
  const career = currentCareer(world);
  if (career && career.weeksInRole >= 104 && career.performance >= 72 && weeks >= 13) {
    upsertTrackMemory(world, 'Career · Growing leverage', `${career.title} has lasted long enough, and gone well enough, that staying put now has an opportunity cost. Promotion, a better employer, leadership, or entrepreneurship are all becoming more plausible exits.`, 64);
  }
  return world;
}
