import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { actionDefinition } from '@/content/actionCatalog';
import { classifyIntentConfidence } from '@/engine/intentConfidence';
import type { Domain, IntentAction } from '@/engine/types';
import { interpretPlayerIntent } from '@/services/intentService';
import { useGame } from '@/state/GameProvider';
import { Body, Card, Eyebrow, PrimaryButton, StatusPill } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

export function OtherActionComposer({ domains, placeholder = 'Describe an unusual action…' }: { domains: Domain[]; placeholder?: string }) {
  const { world, performAction, logIntent } = useGame();
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [mode, setMode] = useState<'baseline' | 'foundation_models' | null>(null);
  const [pending, setPending] = useState<{ action: IntentAction; requiresConfirmation: boolean; confidence: number; diagnostics: string[]; auditMode: 'baseline' | 'foundation_models' } | null>(null);

  const execute = async (action: IntentAction, requiresConfirmation: boolean, confidence: number, diagnostics: string[], auditMode: 'baseline' | 'foundation_models') => {
    const run = async (confirmed: boolean) => {
      const result = await performAction(action, confirmed);
      setFeedback(result.message);
      await logIntent({ input: text.trim(), mode: auditMode, confidence, status: result.completed ? (confirmed ? 'confirmed' : 'executed') : 'rejected', proposedVerb: action.verb, targetIds: action.targetIds, diagnostics: [...diagnostics, result.message] });
      if (result.completed) {
        setText('');
        setPending(null);
      }
    };
    if (requiresConfirmation) {
      Alert.alert('Confirm proposed action', 'The local interpreter has proposed an irreversible, destructive, or sensitive action. The engine will validate it again before execution.', [
        { text: 'Cancel', style: 'cancel', onPress: () => { void logIntent({ input: text.trim(), mode: auditMode, confidence, status: 'rejected', proposedVerb: action.verb, targetIds: action.targetIds, diagnostics: [...diagnostics, 'Player cancelled confirmation.'] }); } },
        { text: 'Confirm', style: action.destructive ? 'destructive' : 'default', onPress: () => { void run(true); } },
      ]);
    } else await run(false);
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
          setFeedback(`I think you mean “${actionDefinition(action.verb)?.label ?? action.verb}.” Review it before anything changes.`);
          await logIntent({ input: text.trim(), mode: response.modeUsed, confidence: response.confidence, status: 'clarified', proposedVerb: action.verb, targetIds: action.targetIds, diagnostics });
        } else {
          setPending(null);
          setFeedback('I’m not confident enough to act. Use the normal action buttons on this screen so the game does not guess.');
          await logIntent({ input: text.trim(), mode: response.modeUsed, confidence: response.confidence, status: 'fallback', proposedVerb: action.verb, targetIds: action.targetIds, diagnostics });
        }
      } else {
        setPending(null);
        setFeedback(response.confidence < 0.55 ? 'I’m not confident enough to act. Use the normal action buttons on this screen.' : response.clarification ?? 'That request is outside the supported local action catalog.');
        await logIntent({ input: text.trim(), mode: response.modeUsed, confidence: response.confidence, status: response.confidence < 0.55 ? 'fallback' : 'clarified', targetIds: [], diagnostics: [...diagnostics, response.clarification ?? response.status] });
      }
    } catch (caught) {
      setFeedback(caught instanceof Error ? caught.message : 'The local interpreter could not process that request.');
      await logIntent({ input: text.trim(), mode: mode ?? 'unavailable', confidence: 0, status: 'error', targetIds: [], diagnostics: [caught instanceof Error ? caught.message : 'Unknown interpreter error'] });
    } finally {
      setBusy(false);
    }
  };

  if (!expanded) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setExpanded(true)} style={[styles.collapsed, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
        <Text style={[styles.collapsedText, { color: colors.accent }]}>Other…</Text>
        <Text style={[styles.collapsedHint, { color: colors.textSecondary }]}>Optional local intent</Text>
      </Pressable>
    );
  }

  return (
    <Card accent>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 3 }}>
          <Eyebrow>OTHER ACTION</Eyebrow>
          <Body secondary>Interpreted on this device. The engine—not the AI—decides what can happen.</Body>
        </View>
        {mode ? <StatusPill tone="accent">{mode === 'foundation_models' ? 'Enhanced local' : 'Baseline local'}</StatusPill> : null}
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
      {pending ? <PrimaryButton title={`Use “${actionDefinition(pending.action.verb)?.label ?? pending.action.verb}”`} onPress={() => { void execute(pending.action, pending.requiresConfirmation, pending.confidence, pending.diagnostics, pending.auditMode); }} /> : null}
      <View style={styles.actions}>
        <PrimaryButton title="Close" tone="neutral" style={{ flex: 1 }} onPress={() => setExpanded(false)} />
        <PrimaryButton title={busy ? 'Interpreting…' : 'Propose action'} disabled={busy || !text.trim()} style={{ flex: 1.5 }} onPress={() => { void interpret(); }} />
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
