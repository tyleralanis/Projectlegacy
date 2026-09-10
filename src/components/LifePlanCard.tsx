import { router } from 'expo-router';
import React from 'react';

import { lifePlans, personalProjects } from '@/engine/lifeJourney';
import { useGame } from '@/state/GameProvider';
import { Body, Card, Eyebrow, Heading, PrimaryButton, ProgressBar } from '@/ui/components';

export function LifePlanCard() {
  const { world } = useGame();
  if (!world) return null;
  const plans = lifePlans(world);
  if (!plans.length) return <Card><Heading size="small">A life starts with small steps</Heading><Body secondary>Your caregivers handle the big decisions for now. Advance a week or a month to see your world grow.</Body><PrimaryButton title="How to play" tone="neutral" onPress={() => router.push('/guide' as never)} /></Card>;
  const plan = plans.find((item) => item.id === world.journey?.activePlans[world.playerCharacterId]);
  const project = personalProjects(world).find((item) => item.status === 'active' || item.status === 'paused');
  const next = plan?.steps.find((step) => !step.done);
  return <Card accent>
    <Eyebrow>YOUR NEXT CHAPTER</Eyebrow>
    <Heading size="small">{plan ? plan.title : 'What would make this life yours?'}</Heading>
    {plan ? <><Body secondary>{plan.completed ? 'A milestone reached. Your next direction is up to you.' : `${plan.steps.filter((step) => step.done).length} of ${plan.steps.length} steps reached`}</Body><ProgressBar value={plan.completed ? 100 : plan.steps.filter((step) => step.done).length / plan.steps.length * 100} label="Life plan progress" />{!plan.completed && next ? <><Body>Next: {next.label}</Body><Body secondary>{next.hint}</Body><PrimaryButton title={next.route === '/plans' ? 'Choose your next step' : 'Take the next step'} onPress={() => router.push(next.route as never)} /></> : null}</> : <Body secondary>Build independence, make something, care for your people, or leave a lasting legacy. Choose a direction and see the next step.</Body>}
    {project ? <Body secondary>{project.status === 'paused' ? 'Project paused' : 'Project underway'} · {project.completedWeeks}/{project.durationWeeks} weeks · {project.hoursPerWeek}h per week</Body> : null}
    <PrimaryButton title={plan ? 'Life plans & projects' : 'Find a direction'} tone={plan ? 'neutral' : 'accent'} onPress={() => router.push('/plans' as never)} />
  </Card>;
}
