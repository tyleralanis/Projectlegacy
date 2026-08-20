import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EngineActionButton } from '@/components/EngineActionButton';
import { SubviewHeader } from '@/components/MenuTile';
import { WORLD_CONTENT } from '@/content/worldContent';
import { formatMoney } from '@/engine/money';
import { useGame } from '@/state/GameProvider';
import { AppScreen, Body, Card, Heading, SectionHeader, Stat, StatusPill } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

export default function CollegeScreen() {
  const { world } = useGame();
  const { colors } = useAppTheme();
  const [sportsOpen, setSportsOpen] = useState(false);
  if (!world) return null;
  const actor = world.characters[world.playerCharacterId];
  const records = Object.values(world.education).filter((record) => record.characterId === actor.id);
  const current = records.find((record) => ['accepted', 'higher', 'trade'].includes(record.status));

  if (sportsOpen) {
    return (
      <AppScreen>
        <SubviewHeader eyebrow="College" title="Sports & clubs" subtitle="Athletics can build fitness, friends, campus reputation, and time pressure." />
        <Pressable onPress={() => setSportsOpen(false)} style={[styles.inlineBack, { backgroundColor: colors.secondary }]}><Text style={[styles.inlineBackText, { color: colors.text }]}>‹ College menu</Text></Pressable>
        <Card><Heading size="small">Intramural league</Heading><Body secondary>Low pressure. Good social upside and modest fitness gains.</Body><EngineActionButton title="Join intramurals" action={{ verb: 'education.sports', targetIds: current ? [current.id] : [], parameters: { intensity: 'casual' } }} tone="accent" /></Card>
        <Card><Heading size="small">Club team</Heading><Body secondary>More practice and stronger network effects, with a bigger time commitment.</Body><EngineActionButton title="Join a club team" action={{ verb: 'education.sports', targetIds: current ? [current.id] : [], parameters: { intensity: 'club' } }} tone="accent" /></Card>
        <Card><Heading size="small">Varsity tryout</Heading><Body secondary>Harder to sustain alongside academics. Strong fitness can make this path more valuable later.</Body><EngineActionButton title="Try out" action={{ verb: 'education.sports', targetIds: current ? [current.id] : [], parameters: { intensity: 'varsity' } }} tone="accent" /></Card>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <SubviewHeader eyebrow="Work" title="College" subtitle="Apply, enroll, study, socialize, play sports, pay tuition, or leave. Credentials and actual competence stay separate." />

      {current ? (
        <Card accent>
          <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading>{current.level}</Heading><Body secondary>{WORLD_CONTENT.universities.find((school) => school.id === current.institutionId)?.name ?? current.institutionId}</Body></View><StatusPill tone={current.status === 'accepted' ? 'warning' : 'success'}>{current.status}</StatusPill></View>
          <View style={styles.stats}><Stat label="Grades" value={Math.round(current.recordedGrade).toString()} /><Stat label="Knowledge" value={Math.round(current.knowledgeGain).toString()} /><Stat label="Network" value={Math.round(current.network).toString()} /><Stat label="Tuition / yr" value={formatMoney(current.tuitionCentsPerYear, true)} /></View>
          {current.status === 'accepted' ? <EngineActionButton title="Enroll" action={{ verb: 'education.enroll', targetIds: [current.id], parameters: {} }} tone="accent" /> : (
            <>
              <Body secondary>Tuition is billed automatically in weekly installments while enrolled, so you never accidentally skip a required payment.</Body>
              <View style={styles.actions}>
                <EngineActionButton title="Study" action={{ verb: 'education.study', targetIds: [current.id], parameters: {} }} tone="accent" style={{ flex: 1 }} />
                <EngineActionButton title="Go out" action={{ verb: 'education.party', targetIds: [current.id], parameters: {} }} style={{ flex: 1 }} />
              </View>
              <Pressable onPress={() => setSportsOpen(true)} style={[styles.menuButton, { borderColor: colors.border, backgroundColor: colors.secondary }]}><Text style={styles.menuEmoji}>🏀</Text><View style={{ flex: 1 }}><Heading size="small">Sports & clubs</Heading><Body secondary>Open athletics menu</Body></View><Text style={[styles.chevron, { color: colors.accent }]}>›</Text></Pressable>
              <EngineActionButton title="Drop out" action={{ verb: 'education.withdraw', targetIds: [current.id], parameters: {}, destructive: true }} tone="danger" />
            </>
          )}
        </Card>
      ) : <Card><Heading size="small">Not currently enrolled</Heading><Body secondary>Schools below weigh knowledge, reputation, and selectivity. An acceptance is not the same as enrollment.</Body></Card>}

      {!current ? <View style={styles.section}>
        <SectionHeader title="Schools accepting applications" action={<StatusPill>{WORLD_CONTENT.universities.length}</StatusPill>} />
        {WORLD_CONTENT.universities.map((school) => {
          const city = WORLD_CONTENT.cities.find((item) => item.id === school.cityId);
          return (
            <Card key={school.id}>
              <View style={styles.row}><View style={{ flex: 1, gap: 3 }}><Heading size="small">{school.name}</Heading><Body secondary>{city?.name ?? 'Unknown city'} · prestige {school.prestige} · network {school.network}</Body></View><StatusPill tone={actor.knowledge >= school.admissionKnowledge ? 'success' : 'warning'}>{formatMoney(school.tuitionCentsPerYear, true)}/yr</StatusPill></View>
              <Body secondary>Typical academic bar: knowledge {school.admissionKnowledge}+ · professional reputation {school.admissionReputation}+.</Body>
              <EngineActionButton title={`Apply to ${school.name}`} action={{ verb: 'education.apply', targetIds: [], parameters: { universityId: school.id } }} tone="accent" />
            </Card>
          );
        })}
      </View> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.sm },
  menuButton: { minHeight: 72, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 12, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  menuEmoji: { fontSize: 24 },
  chevron: { fontSize: 30 },
  inlineBack: { alignSelf: 'flex-start', minHeight: 38, borderRadius: radius.pill, paddingHorizontal: 12, justifyContent: 'center' },
  inlineBackText: { fontSize: 13, fontWeight: '700' },
});
