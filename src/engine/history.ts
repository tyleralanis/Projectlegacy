import { allocateId } from './createWorld';
import type { Domain, OutcomeExplanation, TimelineCategory, WorldState } from './types';

const categoryForDomain: Record<Domain, TimelineCategory> = {
  life: 'dynasty',
  family: 'relationship',
  education: 'education',
  career: 'career',
  business: 'business',
  property: 'property',
  markets: 'wealth',
  relationship: 'relationship',
  health: 'world',
  legal: 'legal',
  reputation: 'world',
  organization: 'world',
  politics: 'politics',
  geopolitics: 'world',
  dynasty: 'dynasty',
};

export function recordHistory(
  world: WorldState,
  domain: Domain,
  title: string,
  detail: string,
  options: {
    important?: boolean;
    importance?: 1 | 2 | 3 | 4 | 5;
    category?: TimelineCategory;
    subjectIds?: string[];
    explanation?: OutcomeExplanation;
  } = {},
): void {
  const important = options.important ?? false;
  world.feed.unshift({ id: allocateId(world, 'feed'), week: world.calendar.week, domain, title, detail, important });
  if (world.feed.length > 220) world.feed.length = 220;
  world.timeline.unshift({
    id: allocateId(world, 'timeline'),
    week: world.calendar.week,
    generation: world.dynasty.generation,
    category: options.category ?? categoryForDomain[domain],
    title,
    detail,
    subjectIds: options.subjectIds ?? [world.playerCharacterId],
    importance: options.importance ?? (important ? 4 : 2),
    explanation: options.explanation,
  });
  const limit = world.performance.timelineLimit;
  if (world.timeline.length > limit) {
    const permanent = world.timeline.filter((entry) => entry.importance >= 4);
    const ordinary = world.timeline.filter((entry) => entry.importance < 4).slice(0, Math.max(0, limit - permanent.length));
    world.timeline = [...permanent, ...ordinary].sort((a, b) => b.week - a.week).slice(0, limit);
  }
}

export function explain(summary: string, factors: OutcomeExplanation['factors']): OutcomeExplanation {
  return { summary, factors };
}
