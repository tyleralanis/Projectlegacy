import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { actionDefinition } from '@/content/actionCatalog';
import { lifeSystemActionDefinition } from '@/content/lifeSystemsActionCatalog';
import { classifyIntentConfidence } from '@/engine/intentConfidence';
import type { Domain, IntentAction } from '@/engine/types';
import { interpretPlayerIntent } from '@/services/lifeIntentBridge';
import { useGame } from '@/state/GameProvider';
import { Body, Card, Eyebrow, PrimaryButton } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

function actionLabel(verb: string): string {
  return actionDefinition(verb)?.label ?? lifeSystemActionDefinition(verb)?.label ?? verb;
}

export function OtherActionComposer({ domains, placeholder = 'Describe another action…' }: { domains: Domain[]; placeholder?: string }) {
  const { world, performAction, logIntent } = useGame();
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [mode, setMode] = useState<'baseline' | 'foundation_models' | null>(null);
  const [pending, setPending] = useState<{ action: IntentAction; requiresConfirmation: boolean; confidence: number; diagnostics: string[]; auditMode: 'baseline' | 'foundation_models' } | null>(null);

  const execute = async (action: IntentAction, requiresConfirmation: boolean, confidence: number, diagnostics: string[], auditMode: 'baseline' | 'foundation_models') => {
    const result = await performAction(action, requiresConfirmation);
    setFeedback(result.message);
    await logIntent({ input: text.trim(), mode: auditMode, confidence, status: result.completed ? (requiresConfirmation ? 'confirmed' : 'executed') : 'rejected', proposedVerb: action.verb, targetIds: action.targetIds, diagnostics: [...diagnostics, result.message] });
    if (result.completed) {
      setText('');
      setPending(null);
    }
  };

  const interpret = async () => {
    if (!world || !text.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await interpretPlayerIntent(world, text.trim(), domains);
      setMode(response.modeUsed);
      const diagnostics = response.diagnostics ? Object.entries(response.diagnostics).map(([key, value]) => `${key}: ${JSON.stringify(value)}`) : [];
      if (response.status === 'proposal' && response.actions[0]) {
        const proposal = response.actions[0];
        const parameters: IntentAction['parameters'] = {};
        for (const [key, value] of Object.entries(proposal.parameters)) {
          if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) parameters[key] = value as string | number | boolean | null;
        }
        const action = { verb: proposal.verb, targetIds: proposal.targetIds, parameters, destructive: proposal.destructive };
        const confidencePolicy = classifyIntentConfidence(response.confidence);
        if (confidencePolicy === 'act') await execute(action, response.requiresConfirmation, response.confidence, diagnostics, response.modeUsed);
        else if (confidencePolicy === 'confirm-meaning') {
          setPending({ action, requiresConfirmation: response.requiresConfirmation, confidence: response.confidence, diagnostics, auditMode: response.modeUsed });
          setFeedback(`I think you mean “${actionLabel(action.verb)}.”`);
          await logIntent({ input: text.trim(), mode: response.modeUsed, confidence: response.confidence, status: 'clarified', proposedVerb: action.verb, targetIds: action.targetIds, diagnostics });
        } else {
          setPending(null);
          setFeedback('I could not confidently understand that. Try naming the action, person, business, property, or amount more directly.');
          await logIntent({ input: text.trim(), mode: response.modeUsed, confidence: response.confidence, status: 'fallback', proposedVerb: action.verb, targetIds: action.targetIds, diagnostics });
        }
      } else {
        setPending(null);
        setFeedback(response.clarification ?? 'I could not map that request to something this character can do yet.');
        await logIntent({ input: text.trim(), mode: response.modeUsed, confidence: response.confidence, status: response.confidence < 0.55 ? 'fallback' : 'clarified', targetIds: [], diagnostics: [...diagnostics, response.clarification ?? response.status] });
      }
    } catch (caught) {
      setFeedback(caught instanceof Error ? caught.message : 'I could not process that request.');
      await logIntent({ input: text.trim(), mode: mode ?? 'unavailable', confidence: 0, status: 'error', targetIds: [], diagnostics: [caught instanceof Error ? caught.message : 'Unknown interpreter error'] });
    } finally {
      setBusy(false);
    }
  };

  if (!expanded) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setExpanded(true)} style={[styles.collapsed, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
        <Text style={[styles.collapsedText, { color: colors.accent }]}>Do something else</Text>
        <Text style={[styles.collapsedHint, { color: colors.textSecondary }]}>Type an action</Text>
      </Pressable>
    );
  }

  return (
    <Card accent>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 3 }}>
          <Eyebrow>DO SOMETHING ELSE</Eyebrow>
          <Body secondary>Describe what you want to try. The world will decide whether it can happen.</Body>
        </View>
      </View>
      <TextInput
        accessibilityLabel="Describe another action"
        multiline
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      {feedback ? <Body>{feedback}</Body> : null}
      {pending ? <PrimaryButton title={`Use “${actionLabel(pending.action.verb)}”`} onPress={() => { void execute(pending.action, pending.requiresConfirmation, pending.confidence, pending.diagnostics, pending.auditMode); }} /> : null}
      <View style={styles.actions}>
        <PrimaryButton title="Close" tone="neutral" style={{ flex: 1 }} onPress={() => setExpanded(false)} />
        <PrimaryButton title={busy ? 'Thinking…' : 'Try it'} disabled={busy || !text.trim()} style={{ flex: 1.5 }} onPress={() => { void interpret(); }} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  collapsed: { minHeight: 48, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  collapsedText: { fontSize: 15, fontWeight: '700' },
  collapsedHint: { fontSize: 12, fontWeight: '600' },
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  input: { minHeight: 92, maxHeight: 170, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 12, fontSize: 15, lineHeight: 21, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
