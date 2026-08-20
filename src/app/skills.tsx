import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { COMPETENCIES, competency, topCompetencies } from '@/engine/competencies';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, ProgressBar, SectionHeader, StatusPill } from '@/ui/components';
import { spacing } from '@/ui/theme';

function tier(value: number): string {
  if (value >= 88) return 'Elite';
  if (value >= 76) return 'Expert';
  if (value >= 62) return 'Strong';
  if (value >= 46) return 'Capable';
  if (value >= 30) return 'Developing';
  return 'Raw';
}

export default function SkillsScreen() {
  const { world } = useGame();
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const top = topCompetencies(world, actor.id, 5);

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Experience compounds" title="Skills & competence" subtitle="Credentials can open doors. Reputation can get you considered. These are the underlying abilities that decide whether you can actually do the thing once you are inside." />

      <Card accent>
        <SectionHeader title="What you are actually good at" />
        <View style={styles.topWrap}>{top.map((skill) => <StatusPill key={skill.key} tone={skill.value >= 76 ? 'success' : 'accent'}>{skill.label} {Math.round(skill.value)}</StatusPill>)}</View>
        <Body secondary>Skills grow by doing relevant work, studying, competing, running organizations, investing, parenting, governing, and deliberate practice. Strong unused skills can slowly soften over long stretches.</Body>
      </Card>

      <View style={styles.section}>
        <SectionHeader title="The full skill stack" />
        {COMPETENCIES.map((definition) => {
          const value = competency(world, actor.id, definition.id);
          return <Card key={definition.id}>
            <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{definition.label}</Heading><Body secondary>{definition.detail}</Body></View><StatusPill tone={value >= 76 ? 'success' : value >= 55 ? 'accent' : 'neutral'}>{tier(value)} · {Math.round(value)}</StatusPill></View>
            <ProgressBar value={value} tone={value >= 76 ? 'success' : 'accent'} />
            <EngineActionButton title={`Practice ${definition.label}`} action={{ verb: 'skills.practice', targetIds: [], parameters: { skill: definition.id } }} />
          </Card>;
        })}
      </View>

      <Card><Heading size="small">Why this matters</Heading><Body secondary>A degree in finance and ten years allocating capital are no longer the same thing. A founder can become an excellent manager through experience. A famous athlete can enter politics with public recognition but still be bad at coalition building. The game can now distinguish access from competence.</Body></Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  topWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
