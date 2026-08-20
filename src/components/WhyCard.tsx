import React, { useState } from 'react';

import type { OutcomeExplanation } from '@/engine/types';
import { Body, Card, Eyebrow, PrimaryButton, StatusPill } from '@/ui/components';

export function WhyCard({ explanation }: { explanation?: OutcomeExplanation }) {
  const [open, setOpen] = useState(false);
  if (!explanation) return null;
  return (
    <Card>
      <Eyebrow>OUTCOME TRANSPARENCY</Eyebrow>
      <PrimaryButton title={open ? 'Hide why this happened' : 'Why did this happen?'} tone="neutral" onPress={() => setOpen((value) => !value)} />
      {open ? <><Body>{explanation.summary}</Body>{explanation.factors.map((factor) => <Card key={`${factor.label}-${factor.detail}`} accent><StatusPill tone={factor.impact === 'positive' ? 'success' : factor.impact === 'negative' ? 'danger' : 'neutral'}>{factor.impact.toUpperCase()} · {factor.label}</StatusPill><Body secondary>{factor.detail}</Body></Card>)}</> : null}
    </Card>
  );
}
