import React from 'react';
import { Alert, type StyleProp, type ViewStyle } from 'react-native';

import type { IntentAction } from '@/engine/types';
import { useGame } from '@/state/GameProvider';
import { PrimaryButton } from '@/ui/components';

export function EngineActionButton({ title, action, tone = 'neutral', style }: { title: string; action: IntentAction; tone?: 'accent' | 'danger' | 'neutral' | 'warning'; style?: StyleProp<ViewStyle> }) {
  const { busy, performAction } = useGame();
  const run = async (confirmed = false) => {
    const result = await performAction(action, confirmed);
    if (result.requiresConfirmation) {
      Alert.alert(`${title}?`, 'This action will take effect immediately.', [
        { text: 'Cancel', style: 'cancel' },
        { text: title, style: action.destructive ? 'destructive' : 'default', onPress: () => { void run(true); } },
      ]);
    } else if (!result.completed) Alert.alert('Action unavailable', result.message);
  };
  return <PrimaryButton title={title} tone={tone === 'warning' ? 'neutral' : tone} style={style} disabled={busy} onPress={() => { void run(); }} />;
}
