import React from 'react';

import { DetailScreen } from '@/components/DetailScreen';
import { useGame } from '@/state/GameProvider';
import { Body, Card, Eyebrow, Heading, StatusPill } from '@/ui/components';

export default function InterpreterLogScreen() {
  const { world } = useGame();
  if (!world) return null;
  return (
    <DetailScreen title="Interpreter Log" eyebrow="LOCAL QA · NOT PLAYER-FACING BY DEFAULT">
      <Body secondary>Exact inputs, confidence, proposed engine actions, targets, and parser diagnostics. This log stays inside the selected save.</Body>
      {world.intentHistory.map((entry) => <Card key={entry.id}><StatusPill tone={entry.status === 'executed' || entry.status === 'confirmed' ? 'success' : entry.status === 'error' || entry.status === 'rejected' ? 'danger' : 'warning'}>{entry.status} · {Math.round(entry.confidence * 100)}%</StatusPill><Heading size="small">“{entry.input}”</Heading><Body secondary>{entry.mode} · week {entry.week} · {entry.proposedVerb ?? 'no action'} · targets {entry.targetIds.join(', ') || 'none'}</Body>{entry.diagnostics.length > 0 ? <><Eyebrow>DIAGNOSTICS</Eyebrow>{entry.diagnostics.map((detail, index) => <Body key={`${entry.id}-${index}`} secondary>• {detail}</Body>)}</> : null}</Card>)}
      {world.intentHistory.length === 0 ? <Card><Body secondary>No free-form interpretation has been attempted in this save.</Body></Card> : null}
    </DetailScreen>
  );
}
