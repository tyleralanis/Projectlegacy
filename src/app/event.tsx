import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OtherActionComposer } from '@/components/OtherActionComposer';
import { WhyCard } from '@/components/WhyCard';
import { getActiveEvent } from '@/engine/simulation';
import { useGame } from '@/state/GameProvider';
import { Body, Card, Eyebrow, Heading, PrimaryButton, StatusPill } from '@/ui/components';
import { spacing, useAppTheme } from '@/ui/theme';

export default function EventScreen() {
  const { world, busy, resolveActiveEvent } = useGame();
  const { colors } = useAppTheme();
  const event = world ? getActiveEvent(world) : undefined;
  if (!event) {
    return <SafeAreaView style={[styles.screen, { backgroundColor: colors.canvas }]}><Heading>No active decision</Heading><PrimaryButton title="Return to life" onPress={() => router.back()} /></SafeAreaView>;
  }
  const choose = async (choiceId: string) => {
    await resolveActiveEvent(event.id, choiceId);
    router.back();
  };
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <View style={styles.topBar}><PrimaryButton title="Back" tone="neutral" onPress={() => router.back()} /><StatusPill tone={event.severity === 'S4' ? 'danger' : 'warning'}>{event.severity === 'S4' ? 'Big decision' : 'Needs you'}</StatusPill></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 7 }}><Eyebrow>{event.domain.toUpperCase()} · THIS CHANGES THINGS</Eyebrow><Heading size="large">{event.title}</Heading><Body>{event.narrative}</Body></View>
        <WhyCard explanation={event.explanation} />
        <View style={styles.choices}>
          {event.choices.map((choice) => (
            <Card key={choice.id}>
              <Heading size="small">{choice.label}</Heading>
              <Body secondary>{choice.detail}</Body>
              <PrimaryButton title="Do it" tone={choice.tone === 'danger' ? 'danger' : 'accent'} disabled={busy} onPress={() => { void choose(choice.id); }} />
            </Card>
          ))}
        </View>
        {event.otherActionFamilies.length > 0 ? <OtherActionComposer domains={[event.domain]} placeholder="Try something else…" /> : null}
        <Body secondary>The world can still say no. Money, skills, relationships, timing, and past choices all get a vote.</Body>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 18 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  content: { flexGrow: 1, gap: 18, paddingBottom: spacing.xl },
  choices: { gap: 10 },
});
