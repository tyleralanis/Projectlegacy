import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Eyebrow, Heading, PrimaryButton } from '@/ui/components';
import { spacing, useAppTheme } from '@/ui/theme';

export function DetailScreen({ title, eyebrow, children }: React.PropsWithChildren<{ title: string; eyebrow: string }>) {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <View style={styles.top}><View style={{ flex: 1, gap: 3 }}><Eyebrow>{eyebrow}</Eyebrow><Heading size="large">{title}</Heading></View><PrimaryButton title="Done" tone="neutral" onPress={() => router.back()} /></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { padding: spacing.xl, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
});
