import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { PERSONAL_PROJECTS } from '@/content/journeyCatalog';
import { playerAgeYears } from '@/engine/createWorld';
import { lifePlans, personalProjects, projectStartReason } from '@/engine/lifeJourney';
import { formatMoney } from '@/engine/money';
import { getDeepTimeBudget } from '@/engine/timeSystem';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Eyebrow, Heading, PrimaryButton, ProgressBar, SectionHeader, StatusPill } from '@/ui/components';

export default function PlansScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const plans = lifePlans(world);
  const projects = personalProjects(world);
  const active = projects.find((project) => project.status === 'active' || project.status === 'paused');
  const definition = PERSONAL_PROJECTS.find((project) => project.id === active?.catalogId);
  const waiting = world.events.find((event) => !event.resolved && event.templateId === `project.checkpoint:${active?.id}`);
  const budget = getDeepTimeBudget(world);
  return <AppScreen>
    <View style={styles.section}><Eyebrow>CHOOSE YOUR NEXT CHAPTER</Eyebrow><Heading size="large">Life plans</Heading><Body secondary>Small steps, bigger stories. Follow a goal, or pick a project simply because it matters to you.</Body><PrimaryButton title="How goals and projects work" tone="neutral" onPress={() => router.push('/guide' as never)} /></View>
    {active && definition ? <Card accent>
      <Eyebrow>YOUR PROJECT</Eyebrow><Heading>{definition.title}</Heading>
      <View style={styles.row}><StatusPill tone={active.status === 'paused' ? 'warning' : 'accent'}>{active.status === 'paused' ? 'Paused' : 'Underway'}</StatusPill><Body secondary>{active.completedWeeks}/{active.durationWeeks} weeks · {active.hoursPerWeek}h each week</Body></View>
      <ProgressBar value={active.completedWeeks / active.durationWeeks * 100} label={`${definition.title} progress`} />
      <Body>{active.update}</Body>
      {waiting ? <PrimaryButton title="Choose the project's direction" onPress={() => router.push('/event' as never)} /> : <>
        <EngineActionButton title={active.status === 'paused' ? 'Resume project' : 'Pause and free up time'} action={{ verb: active.status === 'paused' ? 'life.project_resume' : 'life.project_pause', targetIds: [active.id], parameters: {} }} />
        <EngineActionButton title="Leave this project" action={{ verb: 'life.project_leave', targetIds: [active.id], parameters: {}, destructive: true }} />
      </>}
      <PrimaryButton title="Review your weekly schedule" tone="neutral" onPress={() => router.push('/time' as never)} />
    </Card> : null}
    <SectionHeader title="A direction to follow" />
    {!plans.length ? <Card><Body>Your first personal plans open at age 8. For now, family and development shape each new week.</Body></Card> : null}
    {plans.map((plan) => {
      const selected = world.journey?.activePlans[actor.id] === plan.id;
      const reached = plan.steps.filter((step) => step.done).length;
      return <Card key={plan.id} accent={selected}>
        <View style={styles.row}><Heading size="small">{plan.title}</Heading><StatusPill tone={plan.completed ? 'success' : selected ? 'accent' : 'neutral'}>{plan.completed ? 'Milestone reached' : selected ? 'Following' : `${reached}/3`}</StatusPill></View>
        <Body secondary>{plan.detail}</Body>
        {plan.steps.map((step) => <View key={step.label} style={styles.step}><Body>{step.done || plan.completed ? '✓ ' : '○ '}{step.label}</Body>{selected && !step.done && !plan.completed ? <Body secondary>{step.hint}</Body> : null}</View>)}
        <EngineActionButton title={selected ? 'Set this plan aside' : plan.completed ? 'Revisit this direction' : 'Follow this plan'} tone={selected ? 'neutral' : 'accent'} action={{ verb: selected ? 'life.clear_plan' : 'life.choose_plan', targetIds: [], parameters: { planId: plan.id } }} />
      </Card>;
    })}
    <SectionHeader title="Make time for something" />
    <Body secondary>One project at a time. Costs are paid once; hours belong to your weekly schedule. Halfway through, you choose how the story develops. An unsustainable schedule or very low health can delay progress.</Body>
    {PERSONAL_PROJECTS.filter((project) => playerAgeYears(world) >= project.minimumAge).map((project) => {
      const reason = projectStartReason(world, project);
      return <Card key={project.id}>
        <Heading size="small">{project.title}</Heading><Body secondary>{project.detail}</Body>
        <View style={styles.row}><StatusPill>{project.weeks} weeks</StatusPill><StatusPill>{project.hours}h / week</StatusPill><StatusPill tone="success">{project.costCents ? `${formatMoney(project.costCents)} once` : 'No cash needed'}</StatusPill></View>
        {!active && budget.freeHours < project.hours ? <Body secondary>This needs more time than you currently have free. Review your schedule before committing.</Body> : null}
        {reason ? <Body secondary>{reason}</Body> : <EngineActionButton title={`Start: ${project.title}`} tone="accent" action={{ verb: 'life.project_start', targetIds: [], parameters: { projectId: project.id } }} />}
      </Card>;
    })}
    {projects.some((project) => project.status === 'completed') ? <Card><Heading size="small">Things you followed through on</Heading>{projects.filter((project) => project.status === 'completed').slice(0, 6).map((project) => <Body key={project.id}>✓ {PERSONAL_PROJECTS.find((item) => item.id === project.catalogId)?.title} · completed week {project.completedWeek}</Body>)}<PrimaryButton title="Open your life history" tone="neutral" onPress={() => router.push('/history' as never)} /></Card> : null}
  </AppScreen>;
}

const styles = StyleSheet.create({ section: { gap: 8 }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, step: { gap: 3 } });
